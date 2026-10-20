"""Prefix every style rule in a stylesheet with a scope selector.

Used for the overlay's component sheets so they outrank the legacy shell rules
such as `.wb-shell :is(button) { color: inherit }`. @keyframes, @property and
@font-face blocks are copied unchanged; @media/@supports/@container recurse.
usage: scope_css.py SCOPE IN OUT
"""
import sys, re

SKIP_AT = ('@keyframes', '@-webkit-keyframes', '@property', '@font-face', '@import')
PASS_PREFIX = (':root', 'html', 'body', '.wb-shell', ':is(.wb-shell', '@', '::view-transition')

def split_selectors(sel):
    parts, depth, cur = [], 0, ''
    for ch in sel:
        if ch in '([':
            depth += 1
        elif ch in ')]':
            depth -= 1
        if ch == ',' and depth == 0:
            parts.append(cur)
            cur = ''
        else:
            cur += ch
    parts.append(cur)
    return parts

def scope_selector(sel, scope):
    out = []
    for s in split_selectors(sel):
        stripped = s.strip()
        if not stripped or stripped.startswith(PASS_PREFIX):
            out.append(s)
        else:
            lead = s[: len(s) - len(s.lstrip())]
            out.append(f'{lead}{scope} {stripped}')
    return ','.join(out)

def find_block_end(text, start):
    depth = 0
    i = start
    while i < len(text):
        c = text[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return i
        elif c in '"\'':
            q = c
            i += 1
            while i < len(text) and text[i] != q:
                i += 2 if text[i] == '\\' else 1
        i += 1
    return len(text) - 1

def process(text, scope):
    out, i = [], 0
    while i < len(text):
        ws = len(text[i:]) - len(text[i:].lstrip())
        if ws:
            out.append(text[i:i + ws]); i += ws; continue
        if text.startswith('/*', i):
            j = text.find('*/', i) + 2
            out.append(text[i:j]); i = j; continue
        brace = text.find('{', i)
        semi = text.find(';', i)
        if brace == -1:
            out.append(text[i:]); break
        if semi != -1 and semi < brace and text[i:semi].strip().startswith('@'):
            out.append(text[i:semi + 1]); i = semi + 1; continue
        head = text[i:brace]
        end = find_block_end(text, brace)
        body = text[brace + 1:end]
        h = head.strip()
        if h.startswith(SKIP_AT):
            out.append(text[i:end + 1])
        elif h.startswith('@'):
            out.append(head + '{' + process(body, scope) + '}')
        else:
            out.append(scope_selector(head, scope) + '{' + body + '}')
        i = end + 1
    return ''.join(out)

if __name__ == '__main__':
    scope, src, dst = sys.argv[1:4]
    text = open(src, encoding='utf-8').read()
    open(dst, 'w', encoding='utf-8').write(process(text, scope))
