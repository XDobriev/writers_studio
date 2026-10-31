#!/usr/bin/env python3
"""Daily PostgreSQL + Storage snapshot. Secrets come from private files, never argv/logs."""

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request

TAG = 'avtorstudio-backup-v1'
HOST = 'avtorstudio'
PROJECT = 'joaxeoavjvlqmtlepkrr'
TOOLS = ('pg_dump', 'pg_dumpall', 'pg_restore', 'psql', 'rclone', 'restic')


class BackupError(Exception):
    pass


def run(args, *, cwd=None, output=None):
    """Do not print stderr: libpq/rclone can include credentials or private object paths."""
    try:
        env = dict(os.environ)
        if Path(args[0]).name in ('psql', 'pg_dump', 'pg_dumpall', 'pg_restore'):
            env['PGOPTIONS'] = '-c default_transaction_read_only=on'
        result = subprocess.run(args, cwd=cwd, stdout=output or subprocess.PIPE,
                                stderr=subprocess.PIPE, check=False, timeout=7200, env=env)
    except (OSError, subprocess.TimeoutExpired):
        raise BackupError(f'{Path(args[0]).name}: could not complete (details suppressed)') from None
    if result.returncode:
        raise BackupError(f'{Path(args[0]).name}: exit {result.returncode} (details suppressed)')
    return result.stdout if output is None else b''


def json_run(args):
    try:
        return json.loads(run(args))
    except (ValueError, UnicodeError):
        raise BackupError(f'{Path(args[0]).name}: invalid JSON response') from None


def private_file(value):
    path = Path(value)
    if not path.is_absolute() or not path.is_file() or path.is_symlink():
        raise BackupError('Required private file is missing or is a symlink')
    if os.name == 'posix' and path.stat().st_mode & 0o077:
        raise BackupError('Private files must not be accessible to group/others (chmod 600)')
    return path


def required(name):
    value = os.environ.get(name, '')
    if not value or 'CHANGE_ME' in value:
        raise BackupError(f'{name}: not configured')
    return value


def preflight():
    for tool in TOOLS:
        if not shutil.which(tool):
            raise BackupError(f'{tool}: not installed')
    for name in ('PGSERVICEFILE', 'PGPASSFILE', 'RCLONE_CONFIG', 'RESTIC_PASSWORD_FILE'):
        private_file(required(name))
    required('PGSERVICE')
    repository = required('RESTIC_REPOSITORY')
    if not repository.startswith('s3:https://storage.yandexcloud.net/'):
        raise BackupError('Expected a dedicated Yandex S3 repository')
    required('AWS_ACCESS_KEY_ID')
    required('AWS_SECRET_ACCESS_KEY')
    if required('BACKUP_SOURCE') != 'supabase:':
        raise BackupError('BACKUP_SOURCE must be the root of the supabase rclone remote')
    recovery = Path(required('BACKUP_RECOVERY_DIR'))
    if not recovery.is_absolute() or recovery.is_symlink() or not recovery.is_dir():
        raise BackupError('BACKUP_RECOVERY_DIR must be a private absolute directory')
    for path in recovery.rglob('*'):
        if path.is_symlink():
            raise BackupError('Recovery bundle must not contain symlinks')
        if path.is_file():
            private_file(str(path))
    try:
        readiness = json.loads(private_file(str(recovery / 'inventory.json')).read_text())
    except (ValueError, UnicodeError):
        raise BackupError('Invalid recovery inventory') from None
    if readiness.get('project_ref') != PROJECT or readiness.get('reviewed') is not True:
        raise BackupError('Recovery bundle has not been reviewed for the source project')
    for filename in ('auth.json', 'edge.env', 'operations.md'):
        if not private_file(str(recovery / filename)).stat().st_size:
            raise BackupError('Recovery bundle contains an empty required file')
    return recovery


def storage_inventory():
    rows = json_run(['rclone', 'lsjson', 'supabase:', '--recursive', '--files-only', '--hash'])
    if not isinstance(rows, list):
        raise BackupError('Invalid Storage inventory')
    normalized = []
    seen = set()
    for row in rows:
        path = row.get('Path', '')
        # The local mirror must stay inside the snapshot directory on every platform.
        parts = path.replace('\\', '/').split('/')
        if not path or path.startswith(('/', '\\')) or ':' in path or any(p in ('', '.', '..') for p in parts):
            raise BackupError('Storage contains a path that cannot safely be mirrored')
        if path in seen or not isinstance(row.get('Size'), int) or row['Size'] < 0:
            raise BackupError('Invalid or duplicate Storage object')
        seen.add(path)
        normalized.append({key: row.get(key) for key in ('Path', 'Size', 'ModTime', 'Hashes')})
    return sorted(normalized, key=lambda row: row['Path'])


def database_storage_inventory():
    sql = """SELECT COALESCE(json_agg(json_build_object(
        'Path', bucket_id || '/' || name, 'Size', (metadata->>'size')::bigint,
        'Version', version, 'UpdatedAt', updated_at) ORDER BY bucket_id,name), '[]'::json)
        FROM storage.objects"""
    return json_run(['psql', '-X', '-A', '-t', '--set=ON_ERROR_STOP=1', '--command', sql])


def compare_objects(database, storage):
    expected = {row['Path']: row['Size'] for row in database}
    actual = {row['Path']: row['Size'] for row in storage}
    if expected != actual:
        raise BackupError('S3 object listing differs from database Storage inventory')


def write_command(path, args):
    temporary = path.with_suffix(path.suffix + '.partial')
    with temporary.open('wb') as stream:
        run(args, output=stream)
    temporary.replace(path)


def checksum(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def manifest(root, inventory):
    files = {}
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            raise BackupError('Snapshot must not contain symlinks')
        if path.is_file() and path != root / 'manifest.json':
            files[path.relative_to(root).as_posix()] = {'size': path.stat().st_size, 'sha256': checksum(path)}
    return {'format': 1, 'project_ref': PROJECT,
            'created_at': dt.datetime.now(dt.timezone.utc).isoformat(),
            'storage_objects': len(inventory), 'storage_bytes': sum(row['Size'] for row in inventory),
            'files': files}


def verify(root):
    """Offline verification only; never applies SQL or uploads files to Supabase."""
    root = root.resolve()
    try:
        data = json.loads((root / 'manifest.json').read_text())
        if data['format'] != 1 or data['project_ref'] != PROJECT:
            raise ValueError()
        files = data['files']
        needed = {'database.dump', 'roles.sql', 'vault.json', 'storage.json',
                  'recovery/inventory.json', 'recovery/auth.json', 'recovery/edge.env', 'recovery/operations.md'}
        if not needed.issubset(files):
            raise ValueError()
        for name, expected in files.items():
            path = root / name
            if not path.resolve().is_relative_to(root) or path.is_symlink() or not path.is_file():
                raise ValueError()
            if path.stat().st_size != expected['size'] or checksum(path) != expected['sha256']:
                raise ValueError()
        paths = list(root.rglob('*'))
        if any(p.is_symlink() for p in paths):
            raise ValueError()
        actual = {p.relative_to(root).as_posix() for p in paths if p.is_file() and p != root / 'manifest.json'}
        if actual != set(files):
            raise ValueError()
    except (OSError, KeyError, TypeError, ValueError):
        raise BackupError('Snapshot is incomplete or failed SHA-256 verification') from None
    run(['pg_restore', '--list', str(root / 'database.dump')])
    return data


def backup(state, recovery):
    state = state.resolve()
    root = state / 'snapshot'
    if root.is_symlink() or (root / 'storage').is_symlink():
        raise BackupError('Unsafe staging path')
    root.mkdir(mode=0o700, exist_ok=True)
    mirror = root / 'storage'
    mirror.mkdir(mode=0o700, exist_ok=True)
    before = storage_inventory()
    database_before = database_storage_inventory()
    compare_objects(database_before, before)
    print(f'Storage: {len(before)} objects, {sum(row["Size"] for row in before)} bytes', flush=True)
    # Only the private LOCAL mirror is synchronized; remote objects are never deleted.
    run(['rclone', 'sync', 'supabase:', str(mirror), '--checksum', '--create-empty-src-dirs'])
    run(['rclone', 'check', 'supabase:', str(mirror), '--download'])
    # Restic compresses/deduplicates the uncompressed logical archive. Keep ACLs for restore.
    run(['pg_dump', '--format=custom', '--compress=0', '--no-owner',
         '--file', str(root / 'database.dump.partial')])
    (root / 'database.dump.partial').replace(root / 'database.dump')
    run(['pg_restore', '--list', str(root / 'database.dump')])
    write_command(root / 'roles.sql', ['pg_dumpall', '--roles-only', '--no-role-passwords'])
    # A new project has a different Vault root key. Preserve decrypted values INSIDE the encrypted backup.
    write_command(root / 'vault.json', ['psql', '-X', '-A', '-t', '--set=ON_ERROR_STOP=1', '--command',
        "SELECT COALESCE(json_agg(json_build_object('name',name,'description',description,'secret',decrypted_secret)),'[]'::json) FROM vault.decrypted_secrets"])
    after = storage_inventory()
    database_after = database_storage_inventory()
    compare_objects(database_after, after)
    if before != after or database_before != database_after:
        raise BackupError('Storage changed during capture; no snapshot was uploaded, retry later')
    (root / 'storage.json').write_text(json.dumps(after, ensure_ascii=True) + '\n')
    target = root / 'recovery'
    # This is an owned staging directory, never a source or a remote repository.
    if target.exists():
        if target.is_symlink() or not target.resolve().is_relative_to(root.resolve()):
            raise BackupError('Unsafe recovery staging path')
        shutil.rmtree(target)
    shutil.copytree(recovery, target)
    (root / 'manifest.json').write_text(json.dumps(manifest(root, after), indent=2) + '\n')
    verify(root)
    raw = run(['restic', 'backup', '.', '--host', HOST, '--tag', TAG,
               '--compression', 'auto', '--json'], cwd=root)
    summaries = [row for line in raw.splitlines() if (row := json.loads(line)).get('message_type') == 'summary']
    if len(summaries) != 1 or not summaries[0].get('snapshot_id'):
        raise BackupError('Restic did not confirm a complete snapshot')
    snapshot = summaries[0]['snapshot_id']
    run(['restic', 'check'])
    if os.environ.get('BACKUP_RETENTION_ENABLED', '0') == '1':
        # Enabled only after a successful isolated restore. No S3 lifecycle deletion on this repository.
        run(['restic', 'forget', '--host', HOST, '--tag', TAG, '--group-by', 'host,paths',
             '--keep-daily', '14', '--keep-within', '14d', '--prune'])
        run(['restic', 'check'])
    success = {'snapshot_id': snapshot, 'finished_at': dt.datetime.now(dt.timezone.utc).isoformat()}
    temporary = state / 'last-success.json.partial'
    temporary.write_text(json.dumps(success) + '\n')
    temporary.replace(state / 'last-success.json')
    print(f'Backup verified: {snapshot}', flush=True)


def heartbeat(failed=False):
    url = os.environ.get('BACKUP_HEALTHCHECK_URL', '')
    if not url:
        return
    try:
        with urllib.request.urlopen(url.rstrip('/') + ('/fail' if failed else ''), timeout=15) as response:
            if response.status != 200:
                raise OSError()
    except Exception:
        print('External heartbeat failed (URL suppressed)', file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('preflight', 'backup', 'verify'))
    parser.add_argument('--directory', type=Path, help='Restored snapshot directory, verify only')
    args = parser.parse_args()
    if args.action == 'verify':
        if args.directory is None:
            parser.error('verify requires --directory')
        data = verify(args.directory)
        print(f'SHA-256 and archive directory verified: {len(data["files"])} files')
        return
    if os.name != 'posix':
        raise BackupError('Backup runtime requires Linux; offline verify also works on Windows')
    os.umask(0o077)
    recovery = preflight()
    if args.action == 'preflight':
        print('Configuration checked; no database connection or repository change performed')
        return
    import fcntl
    state = Path(required('BACKUP_STATE_DIR'))
    if not state.is_absolute() or state.is_symlink():
        raise BackupError('BACKUP_STATE_DIR must be an absolute private directory')
    state.mkdir(mode=0o700, parents=True, exist_ok=True)
    if state.stat().st_mode & 0o077:
        raise BackupError('BACKUP_STATE_DIR requires chmod 700')
    if shutil.disk_usage(state).free < 256 * 1024 * 1024:
        raise BackupError('Less than 256 MiB free; capture cancelled before writing staging data')
    with (state / 'backup.lock').open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise BackupError('Another backup is already running') from None
        backup(state, recovery)
    heartbeat()


if __name__ == '__main__':
    try:
        main()
    except BackupError as error:
        print(f'Backup failed: {error}', file=sys.stderr)
        heartbeat(failed=True)
        sys.exit(1)
    except Exception:
        # Never emit raw exceptions or tracebacks: responses may contain secrets.
        print('Backup failed; last successful remote snapshots preserved. Check configuration and dependencies.', file=sys.stderr)
        heartbeat(failed=True)
        sys.exit(1)
