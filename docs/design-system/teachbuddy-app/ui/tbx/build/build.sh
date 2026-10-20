#!/bin/sh
# Rebuild the redesigned prototype: patch the app bundle, remap legacy CSS,
# bundle the overlay JS and CSS, and hook both into index.html.
set -e
APP=/home/claude/teachbuddy
ESB=/opt/npm-tools/node_modules/esbuild/bin/esbuild
STY=$APP/ui/tbx/styles
TMP=/home/claude/build/css
python3 -I /home/claude/build/patch_app.py
python3 -I /home/claude/build/remap_css.py
python3 -I /home/claude/build/patch_agent.py
python3 -I /home/claude/build/patch_data.py
$ESB $APP/ui/tbx/src/index.js --bundle --format=iife --target=es2020 \
  --jsx=transform --jsx-factory=h --jsx-fragment=Fragment \
  --outfile=$APP/ui/tbx.js --log-level=warning
# global sheets go in as written; component sheets are scoped under the shell
rm -rf $TMP && mkdir -p $TMP
: > $TMP/index.css
for f in $(sed -n 's/^@import "\.\/\(.*\)";$/\1/p' $STY/index.css); do
  case "$f" in
    tokens.css|base.css|auth.css|shell.css) cp $STY/$f $TMP/$f ;;
    # .tbx-portal-host marks surfaces the app portals straight into <body>
    # (calendar dialogs, menus, the "more" popover) so they get the same rules;
    # :is() keeps the specificity of a single class.
    *) python3 -I /home/claude/build/scope_css.py ':is(.wb-shell, .tbx-portal-host)' $STY/$f $TMP/$f ;;
  esac
  echo "@import \"./$f\";" >> $TMP/index.css
done
$ESB $TMP/index.css --bundle --outfile=$APP/ui/tbx.css --log-level=warning
python3 -I - <<'PY'
import pathlib
p = pathlib.Path('/home/claude/teachbuddy/index.html')
s = p.read_text()
if 'ui/tbx.css' not in s:
    s = s.replace('<link rel="stylesheet" href="ui/app.css" />',
                  '<link rel="stylesheet" href="ui/app.css" />\n    <link rel="stylesheet" href="ui/tbx.css" />')
    s = s.replace('<script defer src="ui/app.js"></script>',
                  '<script defer src="ui/tbx.js"></script>\n    <script defer src="ui/app.js"></script>')
    p.write_text(s)
s = p.read_text()
if 'data/classroom.js' not in s:
    s = s.replace('<script defer src="data/files.js"></script>', '<script defer src="data/classroom.js"></script>\n    <script defer src="data/files.js"></script>')
    p.write_text(s)
PY
echo built
