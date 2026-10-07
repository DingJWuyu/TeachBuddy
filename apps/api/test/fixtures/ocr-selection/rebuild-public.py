#!/usr/bin/env python3
"""Download hash-fixed public originals and render the four selected pages.

Usage: python3 rebuild-public.py OUTPUT_DIRECTORY
Requires Python 3 and Poppler pdftoppm. Writes only to OUTPUT_DIRECTORY.
"""
import hashlib
import json
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

directory = Path(__file__).resolve().parent
output = Path(sys.argv[1]).resolve() if len(sys.argv) == 2 else None
if output is None:
    raise SystemExit("Usage: python3 rebuild-public.py OUTPUT_DIRECTORY")
output.mkdir(parents=True, exist_ok=True)
manifest = json.loads((directory / "manifest.json").read_text())
for source in manifest["sources"]:
    if "url" not in source:
        continue
    original = output / (source["id"] + ".pdf")
    request = urllib.request.Request(source["url"], headers={
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://maths.scnu.edu.cn/" if source["id"] == "E-pdf" else "https://csxy.lzmvc.edu.cn/",
    })
    with urllib.request.urlopen(request, timeout=60) as response, original.open("wb") as target:
        shutil.copyfileobj(response, target)
    digest = hashlib.sha256(original.read_bytes()).hexdigest()
    if digest != source["sha256"] or original.stat().st_size != source["bytes"]:
        raise SystemExit(f"Original mismatch: {source['id']}, sha256={digest}")
    for page in manifest["pages"]:
        if page["sourceId"] != source["id"]:
            continue
        destination = output / Path(page["image"]).stem
        subprocess.run([
            "pdftoppm", "-f", str(page["sourcePage"]), "-l", str(page["sourcePage"]),
            "-r", str(source["renderDpi"]), "-png", "-singlefile", str(original), str(destination),
        ], check=True)
        rendered = destination.with_suffix(".png")
        digest = hashlib.sha256(rendered.read_bytes()).hexdigest()
        print(f"{page['id']} sha256={digest} frozenMatch={digest == page['sha256']}")
