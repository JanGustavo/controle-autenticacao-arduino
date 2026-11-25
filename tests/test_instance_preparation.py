import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('provision', Path(__file__).resolve().parents[1] / 'scripts/prepare_instance.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PreparationTests(unittest.TestCase):
    def test_isolated_secrets_networks_and_storage_without_demo(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = [module.prepare(s, s, k, p, tmp) for s, k, p in [('office', 'empresa', 8081), ('show', 'evento', 8082)]]
            configs = [json.loads((p / 'compose.json').read_text()) for p in paths]
            self.assertNotEqual(configs[0]['name'], configs[1]['name'])
            self.assertNotEqual((paths[0] / '.env').read_text(), (paths[1] / '.env').read_text())
            for p, c in zip(paths, configs):
                self.assertEqual((p / '.env').stat().st_mode & 0o777, 0o600)
                self.assertNotIn('INSERT INTO', (p / 'init.sql').read_text())
                self.assertIn('CREATE TABLE tentativa_acesso', (p / 'init.sql').read_text())
                for service in c['services'].values():
                    self.assertNotIn('container_name', service)
                self.assertNotIn('ports', c['services']['db'])
                self.assertNotIn('ports', c['services']['backend'])
                self.assertTrue(c['services']['frontend']['ports'][0].startswith('127.0.0.1:'))
            with self.assertRaises(FileExistsError):
                module.prepare('office', 'Office', 'empresa', 8081, tmp)

    def test_bad_inputs_do_not_create_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            for slug, kind, port in [('../escape', 'empresa', 8080), ('ok', 'other', 8080), ('ok', 'evento', 80)]:
                with self.assertRaises(ValueError):
                    module.prepare(slug, 'Client', kind, port, tmp)
            self.assertEqual(list(Path(tmp).iterdir()), [])


if __name__ == '__main__':
    unittest.main()
