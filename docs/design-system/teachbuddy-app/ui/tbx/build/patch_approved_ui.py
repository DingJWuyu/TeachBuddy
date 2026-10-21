"""Apply approved source changes to the supplied legacy prototype bundle.

These components have no JSX source in the design input. Keep their narrowly
scoped changes here, then generate app.js without the historical build machine.
The checked-in bundle is the input; already-applied changes remain unchanged.
"""

from pathlib import Path


PATCHES = (
    (
        "feedback file selection snapshot",
        r'''    const addFiles = (list3) => setFiles((current) => [...current, ...[...list3].map((file) => ({ name: file.name || t67("\u622A\u56FE"), size: file.size }))].slice(0, 5));''',
        r'''    const addFiles = (list3) => {
      const added = Array.from(list3 || [], (file) => ({ name: file.name || t67("\u622A\u56FE"), size: file.size }));
      setFiles((current) => [...current, ...added].slice(0, 5));
    };''',
    ),
    (
        "localized material count",
        r'''        materials.length,
        " ",
        t67("\u4EFD\u6750\u6599")''',
        '''        t67("{{count}} 份材料", { count: materials.length })''',
    ),
    (
        "distinct category dialog opening",
        "          setNewCategory({ kind, onAssign });",
        "          setNewCategory({ openingId: crypto.randomUUID(), kind, onAssign });",
    ),
    (
        "category dialog React identity",
        """          ] }) }) })
        ]
      }
    );
  }
  function Taxonomy""",
        """          ] }) }, newCategory.openingId) })
        ]
      }
    );
  }
  function Taxonomy""",
    ),
)


def main():
    bundle = Path(__file__).resolve().parents[2] / "app.js"
    original = bundle.read_text(encoding="utf-8")
    updated = original
    for name, before, after in PATCHES:
        if updated.count(after) == 1:
            continue
        if updated.count(before) != 1:
            raise SystemExit(f"Cannot locate the expected prototype source: {name}")
        updated = updated.replace(before, after, 1)
    if updated != original:
        bundle.write_text(updated, encoding="utf-8")
    print("Approved feedback and question UI changes are applied.")


if __name__ == "__main__":
    main()
