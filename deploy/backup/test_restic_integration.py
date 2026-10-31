"""Real encrypted repository on synthetic data. Never connects to Supabase or S3."""
import json
import os
from pathlib import Path
import random
import secrets
import subprocess
import tempfile
import unittest


@unittest.skipUnless(os.environ.get('RESTIC_TEST_BINARY'), 'Set RESTIC_TEST_BINARY for real restic test')
class ResticIntegrationTests(unittest.TestCase):
    def test_deleted_file_survives_in_old_snapshot_and_retention_preserves_new_ones(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / 'source'
            source.mkdir()
            # Incompressible, unchanged bytes demonstrate deduplication rather than compression.
            (source / 'image.bin').write_bytes(random.Random(7).randbytes(512 * 1024))
            (source / 'removed.txt').write_text('synthetic manuscript, never production data')
            env = dict(os.environ)
            # Ignore any real repository/password configuration on the developer's machine.
            for key in list(env):
                if key.startswith('RESTIC_'):
                    env.pop(key)
            env['RESTIC_PASSWORD'] = secrets.token_hex(24)
            env['RESTIC_REPOSITORY'] = str(root / 'repository')
            env['RESTIC_CACHE_DIR'] = str(root / 'cache')
            binary = os.environ['RESTIC_TEST_BINARY']

            def restic(*args):
                result = subprocess.run([binary, *args], cwd=source, env=env,
                                        capture_output=True, timeout=90, check=False)
                self.assertEqual(result.returncode, 0, result.stderr.decode(errors='replace'))
                return result.stdout

            restic('init', '--repository-version', '2')
            ids = []
            for day in range(1, 4):
                (source / 'database.dump').write_text(f'synthetic database revision {day}')
                if day == 2:
                    (source / 'removed.txt').unlink()
                output = restic('backup', '.', '--host', 'synthetic-test', '--tag', 'test',
                                '--time', f'2026-10-0{day} 03:00:00', '--json')
                summary = next(row for line in output.splitlines()
                               if (row := json.loads(line)).get('message_type') == 'summary')
                ids.append(summary['snapshot_id'])

            restic('check', '--read-data')
            stats = json.loads(restic('stats', '--mode', 'raw-data', '--json'))
            self.assertLess(stats['total_size'], 2 * (512 * 1024))
            restored = root / 'restored'
            restic('restore', ids[0], '--target', str(restored))
            self.assertEqual((restored / 'removed.txt').read_text(), 'synthetic manuscript, never production data')
            self.assertEqual((restored / 'image.bin').read_bytes(), (source / 'image.bin').read_bytes())
            restic('forget', '--host', 'synthetic-test', '--tag', 'test', '--keep-daily', '2', '--prune')
            remaining = json.loads(restic('snapshots', '--json'))
            self.assertEqual({row['id'] for row in remaining}, set(ids[1:]))
            restic('check', '--read-data')
            latest = root / 'latest'
            restic('restore', ids[-1], '--target', str(latest))
            self.assertEqual((latest / 'database.dump').read_text(), 'synthetic database revision 3')
            self.assertFalse((latest / 'removed.txt').exists())


if __name__ == '__main__':
    unittest.main()
