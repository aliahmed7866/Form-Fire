"""Attach/detach only FORM & FIRE; leave all other Admin Hub entries intact."""
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile


def update(path, app_dir, port=8085, detach=False):
    path = Path(path).expanduser()
    if not path.exists() and detach:
        return
    if not path.exists():
        raise SystemExit('Admin Hub registry not found. Install AYCF Admin Hub first, or pass its registry path.')
    data = json.loads(path.read_text())
    if not isinstance(data, dict) or not isinstance(data.get('apps'), list):
        raise SystemExit('Invalid Admin Hub registry; nothing changed.')
    apps = data['apps']
    if not detach and any(x.get('id') != 'form-fire' and x.get('port') == port for x in apps):
        raise SystemExit(f'Port {port} is already registered to another app.')
    data['apps'] = [x for x in apps if x.get('id') != 'form-fire']
    if not detach:
        data['apps'].append({
            'id': 'form-fire', 'name': 'FORM & FIRE', 'icon': '🔥', 'accent': 'amber',
            'description': 'Alex’s coaching, meal plans and private dining · local test',
            'service': 'form-fire', 'port': port,
            'health_url': f'http://127.0.0.1:{port}/health',
            'open_url': f'http://127.0.0.1:{port}',
            'install_command': ['bash', str(Path(app_dir).resolve() / 'termux/install.sh')]
        })
    shutil.copy2(path, path.with_suffix(path.suffix + '.before-form-fire'))
    os.chmod(path.with_suffix(path.suffix + '.before-form-fire'), 0o600)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix='.form-fire-')
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(data, f, indent=2)
            f.write('\n')
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--registry', default=os.environ.get('AYCF_ADMIN_REGISTRY', str(Path.home() / '.config/aycf/apps.json')))
    parser.add_argument('--app-dir', default=str(Path(__file__).resolve().parents[1]))
    parser.add_argument('--port', type=int, default=int(os.environ.get('FF_PORT', '8085')))
    parser.add_argument('--detach', action='store_true')
    args = parser.parse_args()
    update(args.registry, args.app_dir, args.port, args.detach)
    print('FORM & FIRE detached from Admin Hub.' if args.detach else 'FORM & FIRE added to Admin Hub. Refresh the hub to see it.')
