import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('registry', Path(__file__).parents[1] / 'termux/hub-registry.py')
registry = importlib.util.module_from_spec(spec)
spec.loader.exec_module(registry)

class RegistryTest(unittest.TestCase):
    def test_repeat_attach_and_detach_preserve_other_apps(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'apps.json'
            original = {'apps': [{'id':'aycf','port':8080,'custom':'keep'},{'id':'places','port':8084}], 'other':'keep'}
            p.write_text(json.dumps(original))
            registry.update(p, '/test/Form-Fire')
            registry.update(p, '/test/Form-Fire')
            data = json.loads(p.read_text())
            self.assertEqual(len(data['apps']), 3)
            self.assertEqual(data['apps'][0], original['apps'][0])
            registry.update(p, '/test/Form-Fire', detach=True)
            self.assertEqual(json.loads(p.read_text()), original)
    def test_port_collision_leaves_registry_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'apps.json'
            content = '{"apps":[{"id":"other","port":8085}]}'
            p.write_text(content)
            with self.assertRaises(SystemExit): registry.update(p, '/test/Form-Fire')
            self.assertEqual(p.read_text(), content)
    def test_https_origin_is_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'apps.json'
            p.write_text('{"apps":[]}')
            registry.update(p, '/test/Form-Fire', origin='https://127.0.0.1:8085')
            app = json.loads(p.read_text())['apps'][0]
            self.assertEqual(app['open_url'], 'https://127.0.0.1:8085')
            self.assertEqual(app['health_url'], 'https://127.0.0.1:8085/health')
    def test_unsafe_or_mismatched_origin_does_not_change_registry(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / 'apps.json'
            content = '{"apps":[]}'
            p.write_text(content)
            for origin in ['http://evil.test:8085', 'http://127.0.0.1:9999', 'http://u:p@127.0.0.1:8085', 'http://127.0.0.1:8085/path']:
                with self.assertRaises(SystemExit):
                    registry.update(p, '/test/Form-Fire', origin=origin)
                self.assertEqual(p.read_text(), content)

if __name__ == '__main__': unittest.main()
