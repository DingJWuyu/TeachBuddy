#!/usr/bin/env python3
"""Install the single fixed OCR profile into a new, user-owned tool directory."""
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tarfile
import urllib.request
from pathlib import Path


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("home", type=Path, help="New OCR tool home; existing profiles are never overwritten")
    args = parser.parse_args()
    home = args.home.expanduser().resolve()
    source = Path(__file__).resolve().parent
    manifest = json.loads((source / "manifest.json").read_text())
    if home.exists() and any(home.iterdir()):
        parser.error("Tool home must be empty; use a new directory instead of an existing Paddle profile")
    for binary in ("uv", "bwrap", "systemd-run", "nvidia-smi", "bsdtar"):
        if not shutil.which(binary):
            parser.error(f"Required host tool is missing: {binary}")
    home.mkdir(parents=True, exist_ok=True)
    staging = home / "install-downloads"
    staging.mkdir()
    environment = os.environ.copy()
    environment["UV_PYTHON_INSTALL_DIR"] = str(home / "python")
    subprocess.run(["uv", "python", "install", "3.12.14", "--no-bin", "--no-cache"], check=True, env=environment)
    pythons = list((home / "python").glob("cpython-3.12.14-*/bin/python3.12"))
    if len(pythons) != 1:
        raise RuntimeError("Expected one managed Python 3.12.14")
    subprocess.run(["uv", "venv", "--python", str(pythons[0]), str(home / "venv")], check=True, env=environment)
    shutil.copyfile(source / "requirements.freeze.txt", home / "requirements.freeze.txt")
    # Jieba publishes a source archive. Seed its fixed build backend explicitly
    # instead of letting build isolation download an unpinned setuptools.
    setuptools = next(line for line in (home / 'requirements.freeze.txt').read_text().splitlines()
                      if line.startswith('setuptools=='))
    (staging / 'build-requirement.txt').write_text(setuptools + '\n')
    subprocess.run(['uv', 'pip', 'install', '--python', str(home / 'venv/bin/python'), '--require-hashes',
                    '--no-cache', '-r', str(staging / 'build-requirement.txt')], check=True, env=environment)
    subprocess.run(["uv", "pip", "install", "--python", str(home / "venv/bin/python"), "--require-hashes",
                    "--no-cache", '--no-build-isolation', "-r", str(home / "requirements.freeze.txt")], check=True, env=environment)
    subprocess.run(["uv", "pip", "check", "--python", str(home / "venv/bin/python")], check=True, env=environment)

    def download(item, destination):
        destination.parent.mkdir(parents=True, exist_ok=True)
        partial = destination.with_name(destination.name + ".part")
        with urllib.request.urlopen(item["url"], timeout=60) as response, partial.open("wb") as stream:
            shutil.copyfileobj(response, stream, 1024 * 1024)
        if partial.stat().st_size != item["bytes"] or digest(partial) != item["sha256"]:
            raise RuntimeError("Fixed download checksum mismatch")
        partial.replace(destination)

    for item in manifest["downloads"]:
        print(f"Downloading {item['file']}", flush=True)
        download(item, home / item["file"])
    for folder in manifest["models"]:
        (home / "models" / folder / ".mineru_complete").write_bytes(b"")
    # Official local ensure() takes a repo lock even with complete models.
    # Runtime mounts only this empty lock directory as namespace-local tmpfs.
    (home / 'models/.locks').mkdir()
    package = staging / 'fonts.pkg.tar.zst'
    download(manifest['fontPackage'], package)
    font_source = staging / 'font-source'
    font_source.mkdir()
    subprocess.run(['bsdtar', '-xf', str(package), '-C', str(font_source),
                    manifest['fontPackage']['font'], manifest['fontPackage']['license']], check=True)
    (home / 'fonts').mkdir()
    shutil.copyfile(font_source / manifest['fontPackage']['font'], home / 'fonts/DejaVuSans.ttf')
    shutil.copyfile(font_source / manifest['fontPackage']['license'], home / 'fonts/LICENSE-DejaVu.txt')
    for item in manifest["archives"]:
        archive = staging / item["url"].rsplit("/", 1)[1]
        print(f"Downloading {archive.name}", flush=True)
        download(item, archive)
        folder = "cudart" if archive.name.startswith("cudart-") else "llama"
        unpack = staging / folder
        unpack.mkdir()
        with tarfile.open(archive) as stream:
            stream.extractall(unpack, filter="data")
        entries = list(unpack.iterdir())
        payload = entries[0] if len(entries) == 1 and entries[0].is_dir() else unpack
        shutil.copytree(payload, home / folder, symlinks=True)
    site = home / "venv/lib/python3.12/site-packages"
    for name, expected in {**manifest["sourceFiles"], **manifest["resourceFiles"]}.items():
        if digest(site / name) != expected:
            raise RuntimeError(f"Fixed package source/resource mismatch: {name}")
    for name, expected in manifest["files"].items():
        if digest(home / name) != expected:
            raise RuntimeError(f"Fixed runtime inventory mismatch: {name}")
    for folder in ("llama", "cudart"):
        for file in sorted((home / folder).rglob("*")):
            if file.is_file():
                manifest["files"][file.relative_to(home).as_posix()] = digest(file)
    # Runtime needs no network and no install staging files. Its manifest
    # contains only the exact installed inventory and fixed configuration.
    manifest.pop("downloads")
    manifest.pop("archives")
    manifest.pop("wheelArtifacts")
    manifest.pop('fontPackage')
    temporary = home / "manifest.json.tmp"
    temporary.write_text(json.dumps(manifest, indent=2) + "\n")
    temporary.replace(home / "manifest.json")
    shutil.rmtree(staging)
    print(f"Installed fixed OCR profile. Set MATERIALS_OCR_HOME={home}")


if __name__ == "__main__":
    main()
