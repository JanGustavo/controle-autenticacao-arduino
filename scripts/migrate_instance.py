"""Apply the existing SQL migration chain to an explicitly selected instance."""
import argparse
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    folder = args.directory.resolve()
    if not (folder / 'instance.json').is_file() or not (folder / 'compose.json').is_file():
        parser.error('Selecione uma pasta criada por prepare_instance.py.')
    command = ['docker', 'compose', '--project-directory', str(folder), '--env-file', str(folder / '.env'), '-f', str(folder / 'compose.json')]
    for migration in sorted((ROOT / 'backend/migrations').glob('*.sql')):
        print(f'Aplicando {migration.name}', flush=True)
        subprocess.run(command + ['exec', '-T', 'db', 'psql', '-U', 'guardwalk', '-d', 'guardwalk',
                                  '-v', 'ON_ERROR_STOP=1', '--single-transaction'], input=migration.read_bytes(), check=True)


if __name__ == '__main__':
    main()
