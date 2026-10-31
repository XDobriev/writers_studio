import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

import backup


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name)
        self.recovery = self.state / 'source-recovery'
        self.recovery.mkdir()
        for filename in ('inventory.json', 'auth.json', 'edge.env', 'operations.md'):
            (self.recovery / filename).write_text('private recovery data')

    def fake_run(self, args, *, cwd=None, output=None):
        self.calls.append(args)
        if args[0] == 'pg_dump':
            Path(args[-1]).write_bytes(b'logical archive')
        if output is not None:
            output.write(b'[]')
            return b''
        if args[:2] == ['restic', 'backup']:
            return b'{"message_type":"summary","snapshot_id":"abc123"}\n'
        return b''

    def exercise_backup(self, *, retention=False, failure=None):
        self.calls = []

        def invoke(args, **kwargs):
            if failure and args[:len(failure)] == failure:
                self.calls.append(args)
                raise backup.BackupError('simulated failure')
            return self.fake_run(args, **kwargs)

        with patch.object(backup, 'run', side_effect=invoke), \
             patch.object(backup, 'storage_inventory', return_value=[]), \
             patch.object(backup, 'database_storage_inventory', return_value=[]), \
             patch.dict(os.environ, {'BACKUP_RETENTION_ENABLED': '1' if retention else '0'}), \
             contextlib.redirect_stdout(io.StringIO()):
            backup.backup(self.state, self.recovery)

    def test_upload_failure_never_prunes_or_advances_success(self):
        old = self.state / 'last-success.json'
        old.write_text('previous success')
        with self.assertRaises(backup.BackupError):
            self.exercise_backup(retention=True, failure=['restic', 'backup'])
        self.assertEqual(old.read_text(), 'previous success')
        self.assertFalse(any(args[:2] == ['restic', 'forget'] for args in self.calls))

    def test_failed_repository_check_does_not_prune(self):
        with self.assertRaises(backup.BackupError):
            self.exercise_backup(retention=True, failure=['restic', 'check'])
        self.assertFalse((self.state / 'last-success.json').exists())
        self.assertFalse(any(args[:2] == ['restic', 'forget'] for args in self.calls))

    def test_retention_disabled_until_restore_drill(self):
        self.exercise_backup()
        self.assertFalse(any(args[:2] == ['restic', 'forget'] for args in self.calls))
        self.assertEqual(json.loads((self.state / 'last-success.json').read_text())['snapshot_id'], 'abc123')

    def test_checks_surround_prune_and_preserve_two_weeks(self):
        self.exercise_backup(retention=True)
        commands = [args[:2] for args in self.calls]
        prune = commands.index(['restic', 'forget'])
        self.assertEqual(commands[prune - 1], ['restic', 'check'])
        self.assertEqual(commands[prune + 1], ['restic', 'check'])
        self.assertIn('--keep-daily', self.calls[prune])
        self.assertIn('14d', self.calls[prune])

    def test_storage_changes_abort_before_upload(self):
        self.calls = []
        obj = {'Path': 'covers/image.png', 'Size': 1, 'ModTime': 'today'}
        with patch.object(backup, 'run', side_effect=self.fake_run), \
             patch.object(backup, 'storage_inventory', side_effect=[[], [obj]]), \
             patch.object(backup, 'database_storage_inventory', side_effect=[[], [obj]]), \
             contextlib.redirect_stdout(io.StringIO()), self.assertRaises(backup.BackupError):
            backup.backup(self.state, self.recovery)
        self.assertFalse(any(args[0] == 'restic' for args in self.calls))

    def test_missing_source_bucket_is_not_an_empty_success(self):
        with self.assertRaises(backup.BackupError):
            backup.compare_objects([{'Path': 'hidden/file.png', 'Size': 10}], [])

    def test_unsafe_source_paths_rejected_before_sync(self):
        for name in ('../secret', '/absolute', 'bucket/../secret', 'C:/secret', 'bucket\\..\\secret'):
            with self.subTest(name=name), patch.object(backup, 'json_run', return_value=[{'Path': name, 'Size': 1}]), \
                 self.assertRaises(backup.BackupError):
                backup.storage_inventory()

    def test_command_failure_does_not_expose_stderr_or_arguments(self):
        result = subprocess.CompletedProcess([], 1, b'', b'password=SECRET private/file')
        with patch.object(subprocess, 'run', return_value=result), self.assertRaises(backup.BackupError) as error:
            backup.run(['rclone', 'SECRET'])
        self.assertNotIn('SECRET', str(error.exception))
        self.assertNotIn('private/file', str(error.exception))

    def test_dump_failure_never_creates_remote_snapshot(self):
        with self.assertRaises(backup.BackupError):
            self.exercise_backup(failure=['pg_dump'])
        self.assertFalse(any(args[0] == 'restic' for args in self.calls))

    def test_verify_rejects_corruption_and_extra_files(self):
        self.exercise_backup()
        root = self.state / 'snapshot'
        with patch.object(backup, 'run', return_value=b''):
            backup.verify(root)
            (root / 'database.dump').write_bytes(b'broken')
            with self.assertRaises(backup.BackupError):
                backup.verify(root)
        self.exercise_backup()
        (root / 'unexpected.txt').write_text('extra')
        with self.assertRaises(backup.BackupError):
            backup.verify(root)

    def test_verify_rejects_path_escape(self):
        self.exercise_backup()
        root = self.state / 'snapshot'
        data = json.loads((root / 'manifest.json').read_text())
        data['files']['../outside'] = {'size': 0, 'sha256': ''}
        (root / 'manifest.json').write_text(json.dumps(data))
        with self.assertRaises(backup.BackupError):
            backup.verify(root)

    def test_nested_manifest_filename_is_included(self):
        root = self.state / 'snapshot'
        nested = root / 'storage' / 'bucket'
        nested.mkdir(parents=True)
        (nested / 'manifest.json').write_text('a user file, not our root manifest')
        files = backup.manifest(root, [])['files']
        self.assertIn('storage/bucket/manifest.json', files)

    def test_postgres_commands_force_read_only_and_do_not_take_password_argv(self):
        result = subprocess.CompletedProcess([], 0, b'[]', b'')
        with patch.object(subprocess, 'run', return_value=result) as invoke:
            backup.run(['psql', '--command', 'SELECT 1'])
        self.assertEqual(invoke.call_args.kwargs['env']['PGOPTIONS'], '-c default_transaction_read_only=on')

    def test_sync_destination_is_local_and_source_is_not_modified(self):
        self.exercise_backup()
        sync = next(args for args in self.calls if args[:2] == ['rclone', 'sync'])
        self.assertEqual(sync[2], 'supabase:')
        self.assertEqual(Path(sync[3]).resolve(), (self.state / 'snapshot' / 'storage').resolve())
        self.assertFalse(any(args[0] in ('psql', 'pg_restore') and '--clean' in args for args in self.calls))


if __name__ == '__main__':
    unittest.main()
