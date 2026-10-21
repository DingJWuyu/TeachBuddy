"""Regenerate the current overlay and approved legacy changes from this checkout."""
from pathlib import Path
import re
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True

from patch_approved_ui import main as patch_approved_ui
from scope_css import process


def main():
    layer = Path(__file__).resolve().parents[1]
    repository = next(parent for parent in layer.parents if (parent / "package-lock.json").is_file())
    esbuild = repository / "node_modules/.bin/esbuild"
    if not esbuild.is_file():
        raise SystemExit("Run npm ci in the repository before building the prototype.")
    subprocess.run([str(esbuild), str(layer / "src/index.js"), "--bundle", "--format=iife",
                    "--target=es2020", "--jsx=transform", "--jsx-factory=h", "--jsx-fragment=Fragment",
                    "--outfile=" + str(layer.parent / "tbx.js")], cwd=repository, check=True)
    styles = layer / "styles"
    with tempfile.TemporaryDirectory(prefix="teachbuddy-prototype-css-") as directory:
        temporary = Path(directory)
        index = (styles / "index.css").read_text(encoding="utf-8")
        for name in re.findall(r'@import "\./([^"\n]+)";', index):
            css = (styles / name).read_text(encoding="utf-8")
            if name not in {"tokens.css", "base.css", "auth.css", "shell.css"}:
                css = process(css, ":is(.wb-shell, .tbx-portal-host)")
            (temporary / name).write_text(css, encoding="utf-8")
        (temporary / "index.css").write_text(index, encoding="utf-8")
        # stdin keeps generated source comments independent of the temporary path.
        subprocess.run([str(esbuild), "--bundle", "--loader=css", "--sourcefile=index.css",
                        "--outfile=" + str(layer.parent / "tbx.css")], cwd=temporary,
                       input=index, text=True, check=True)
    patch_approved_ui()


if __name__ == "__main__":
    main()
