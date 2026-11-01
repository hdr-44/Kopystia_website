#!/usr/bin/env python3
"""Turn the design canvas pages (design/**/*.dc.html) into a static clickable prototype (prototype/).

Template features become Alpine.js (loaded from a CDN):
  {{x}} -> x-text / :attr, <sc-for> -> <template x-for>, <sc-if> -> <template x-if>, onClick -> @click.
shortcut: handles only the template features these pages use; extend it if new ones appear.
Usage: python3 tools/export_prototype.py   (exits 1 if any link points to a missing page)
"""
import glob, json, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'design'), os.path.join(ROOT, 'prototype')
ALPINE = 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js'

TOKEN = re.compile(r'<!--.*?-->|<(/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:="[^"]*"|=\'[^\']*\')?)*)\s*(/?)>', re.S)
ATTR = re.compile(r'([^\s=]+)(?:=("[^"]*"|\'[^\']*\'))?')
HOLE = re.compile(r'\{\{\s*(.*?)\s*\}\}')
SHIM = ('class DCLogic{constructor(){this.props={};this.state=null}'
        'setState(p){this.state=Object.assign({},this.state,p);this.__r&&this.__r()}'
        'forceUpdate(){this.__r&&this.__r()}}')
BOOT = ("document.addEventListener('alpine:init',()=>Alpine.data('dc',()=>{const c=new Component();"
        "return{v:c.renderVals(),init(){c.__r=()=>{this.v=c.renderVals()}}}}))")


def expr(e, scope):
    """Map a {{dotted.path}} to an Alpine expression: loop vars stay, everything else reads from v."""
    if re.fullmatch(r'true|false|-?\d+(\.\d+)?', e) or e.split('.')[0] in scope or e.startswith('$index'):
        return e
    return 'v.' + e


def convert_attrs(raw, scope):
    out = []
    for name, val in ATTR.findall(raw):
        if name.startswith('hint-'):
            continue
        if not val:
            out.append(name)
            continue
        q, body = val[0], val[1:-1]
        if name == 'href':
            body = body.replace('.dc.html', '.html')
        holes = HOLE.findall(body)
        if not holes:
            out.append(f'{name}={q}{body}{q}')
        elif name.lower() == 'onclick':
            out.append(f'@click={q}{expr(holes[0], scope)}(){q}')
        elif HOLE.fullmatch(body):
            out.append(f':{name}={q}{expr(holes[0], scope)}{q}')
        else:
            tpl = HOLE.sub(lambda m: '${' + expr(m.group(1), scope) + '}', body.replace('`', '\\`'))
            out.append(f':{name}={q}`{tpl}`{q}')
    return (' ' + ' '.join(out)) if out else ''


def convert_body(src):
    scope, stack, out, pos = [], [], [], 0
    for m in TOKEN.finditer(src):
        text = src[pos:m.start()]
        out.append(HOLE.sub(lambda h: f'<span x-text="{expr(h.group(1), scope)}"></span>', text))
        pos = m.end()
        closing, tag, attrs, selfclose = m.groups()
        if tag is None:  # comment
            continue
        if tag in ('x-dc', 'helmet'):
            continue
        if tag == 'sc-for':
            if closing:
                stack.pop(); scope.pop(); out.append('</div></template>')
            else:
                a = dict((k, v[1:-1]) for k, v in ATTR.findall(attrs) if v)
                var, lst = a['as'], HOLE.fullmatch(a['list']).group(1)
                out.append(f'<template x-for="({var}, $index) in {expr(lst, scope)}"><div style="display: contents">')
                scope.append(var); stack.append(tag)
            continue
        if tag == 'sc-if':
            if closing:
                stack.pop(); out.append('</div></template>')
            else:
                a = dict((k, v[1:-1]) for k, v in ATTR.findall(attrs) if v)
                out.append(f'<template x-if="{expr(HOLE.fullmatch(a["value"]).group(1), scope)}"><div style="display: contents">')
                stack.append(tag)
            continue
        out.append(f'</{tag}>' if closing else f'<{tag}{convert_attrs(attrs, scope)}{" /" if selfclose else ""}>')
    out.append(src[pos:])
    assert not stack, f'unclosed {stack}'
    return ''.join(out)


def convert(path):
    src = open(path).read()
    title = re.search(r'<title>(.*?)</title>', src, re.S).group(1)
    logic = re.search(r'<script type="text/x-dc"[^>]*>(.*?)</script>', src, re.S).group(1)
    body = re.search(r'<x-dc>(.*)</x-dc>', src, re.S).group(1)
    return f'''<!doctype html>
<html lang="{re.search(r'<html lang="([^"]+)"', src).group(1)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<script>{SHIM}
{logic}
{BOOT}</script>
<script defer src="{ALPINE}"></script>
</head>
<body>
<div x-data="dc">{convert_body(body)}</div>
</body>
</html>
'''


UK = json.load(open(os.path.join(ROOT, 'tools', 'uk.json')))
TOGGLE = re.compile(r'<button type="button" style="([^"]*)">UA / (?:<b>)?EN(?:</b>)?</button>')
TR_ATTR = re.compile(r'(\s:?(?:aria-label|placeholder|alt|title)=")([^"]*)(")')


def lang_toggle(html, name, uk):
    """Turn the dead UA / EN button into links between the two language copies of this page."""
    other = name if uk else name.replace('.html', '.uk.html')
    ua = '<b>UA</b>' if uk else f'<a href="{other}" lang="uk" style="color: inherit">UA</a>'
    en = f'<a href="{other}" lang="en" style="color: inherit">EN</a>' if uk else '<b>EN</b>'
    return TOGGLE.sub(lambda m: f'<span style="{m.group(1)}; display: inline-flex; align-items: center; gap: 4px">{ua} / {en}</span>', html)


def to_uk(html):
    """Ukrainian copy: swap exact-match strings from tools/uk.json in text, labels and the page's JS data; link to .uk pages."""
    def text(m):
        t = m.group(2).strip()
        return m.group(1) + m.group(2).replace(t, UK[t]) + m.group(3) if t in UK else m.group(0)

    def lit(m):
        q, t = m.group(1), m.group(2)
        return q + UK[t].replace(q, '\\' + q) + q if t in UK else m.group(0)

    def href(m):
        h = m.group(2)
        if h.startswith(('http', '#', 'mailto:')) or '.html' not in h:
            return m.group(0)
        return m.group(1) + h.replace('.html', '.uk.html', 1) + m.group(3)

    head, script, rest = re.split(r'(?s)(<script>.*?</script>)', html, maxsplit=1)
    script = re.sub(r"(['\"])((?:(?!\1)[^\\\n])*)\1", lit, script)
    tx = lambda part: re.sub(r'(>)([^<>]+)(<)', text, part)
    out = tx(head) + script + tx(rest)
    out = TR_ATTR.sub(lambda m: m.group(1) + UK.get(m.group(2), m.group(2)) + m.group(3), out)
    out = re.sub(r'(\shref=")([^"]+)(")', href, out)
    return out.replace('<html lang="en">', '<html lang="uk">', 1)


def check_links(out_dir):
    """Self-check: every local href in the output points to an existing file."""
    missing = []
    for f in glob.glob(os.path.join(out_dir, '**', '*.html'), recursive=True):
        for href in re.findall(r'\shref="([^"]+)"', open(f).read()):
            if href.startswith(('http', '#', 'mailto:')):
                continue
            target = os.path.normpath(os.path.join(os.path.dirname(f), href.split('#')[0].split('?')[0]))
            if not os.path.exists(target):
                missing.append(f'{os.path.relpath(f, out_dir)} -> {href}')
    return missing


# Desktop pages on phones: inline styles need !important to override. shortcut: matches style values these pages use; add selectors if new layouts appear.
PHONE_CSS = '''<style>
.m-burger,.m-extra{display:none}
@media (max-width:700px){
header[style]{display:grid!important;grid-template-columns:48px 1fr 48px;padding:4px!important;gap:0!important;position:relative;background:#F7F2E8}
.m-burger{display:block;grid-column:1;grid-row:1;background:none;border:0;padding:12px;color:#264833;cursor:pointer}
header>a:first-child{grid-column:2;grid-row:1;justify-self:center;font-size:24px!important}
header>div{grid-column:3;grid-row:1;justify-self:end}
header>div>:not([aria-label^="Cart"]){display:none!important}
header>nav[aria-label="Main"]{display:none!important;position:absolute;top:100%;left:0;right:0;z-index:20;min-height:calc(100vh - 57px);box-sizing:border-box;background:#264833;padding:24px!important;flex-direction:column;gap:4px!important;text-transform:none!important;letter-spacing:0!important}
header.open>nav[aria-label="Main"]{display:flex!important}
header>nav[aria-label="Main"]>a{color:#F7F2E8;font-family:'Cormorant Garamond',serif;font-size:34px;padding:6px 0;border:0!important}
.m-extra{display:flex;flex-direction:column;gap:20px;margin-top:24px;padding-top:24px;border-top:1px solid #3B5C46;font-family:'Manrope',system-ui,sans-serif;font-size:15px}
.m-extra a{color:#E3CCA4}
.m-extra div{display:flex;gap:12px}
.m-extra div>*{border:1px solid #E3CCA4!important;padding:12px 16px!important;color:#F7F2E8!important;background:none}
.m-extra div a{color:inherit!important}
[style*="max-width: 1280px"],[style*="padding: 0 40px"]{padding-left:20px!important;padding-right:20px!important;box-sizing:border-box}
[style*="padding: 120px"],[style*="padding: 96px"],[style*="padding: 80px"]{padding-top:56px!important;padding-bottom:56px!important}
[style*="minmax(340px"],[style*="minmax(280px"],[style*="minmax(240px"]{grid-template-columns:1fr!important}
[style*="gap: 64px"]{gap:32px!important}
[style^="display: flex; gap: 20px; padding: 24px 0"]{flex-wrap:wrap!important}
[style*="right center / auto 100%"]{background-position:center top!important;background-size:100% auto!important;padding:calc(129vw + 24px) 0 40px!important;min-height:0!important}
[style*="font-size: 96px"],[style*="font-size: 64px"],[style*="font-size: 56px"]{font-size:44px!important}
[style*="font-size: 48px"],[style*="font-size: 44px"]{font-size:34px!important}
}
</style>'''
BURGER = ('<button type="button" class="m-burger" aria-label="Menu" aria-expanded="false" '
          "onclick=\"this.setAttribute('aria-expanded',this.parentNode.classList.toggle('open'))\">"
          '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">'
          '<path d="M4 7h16M4 12h16M4 17h16"></path></svg></button>')
EXTRA_LINKS = '<a href="Wishlist.html">Wishlist</a><a href="Help.html">Help &amp; FAQ</a><a href="Contact.html">Contact</a>'


def phone_fit(html, name):
    """Desktop page: send phones to the designed mobile twin if one exists, else add phone CSS + hamburger."""
    stem = name[:-5]
    twin = 'HomeMobile' if stem == 'Main' else stem + 'Mobile'
    redirect = ''
    if os.path.exists(os.path.join(SRC, twin + '.dc.html')):
        redirect = f"<script>if(innerWidth<700)location.replace('{twin}'+(location.pathname.endsWith('.uk.html')?'.uk':'')+'.html'+location.hash)</script>"
    html = html.replace('</head>', redirect + PHONE_CSS + '</head>', 1)
    # phone menu matches the designed mobile one: same links plus language/currency (copied from the header bar)
    m = re.search(r'<nav aria-label="Main".*?(</nav>)\s*<div[^>]*>(.*?)</div>\s*</header>', html, re.S)
    if m:
        switches = re.sub(r'(?s)<a href="Cart.html".*?</a>', '', m.group(2))
        extra = f'<div class="m-extra">{EXTRA_LINKS}<div>{switches}</div></div>'
        html = html[:m.start(1)] + extra + html[m.start(1):]
    return html.replace('<nav aria-label="Main"', BURGER + '<nav aria-label="Main"', 1)


def main():
    shutil.rmtree(OUT, ignore_errors=True)
    for path in glob.glob(os.path.join(SRC, '**', '*.dc.html'), recursive=True):
        dest = os.path.join(OUT, os.path.relpath(path, SRC).replace('.dc.html', '.html'))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        html, name = convert(path), os.path.basename(dest)
        if 'width: 390px' not in html:  # mobile designs are already phone-sized
            html = phone_fit(html, name)
        open(dest, 'w').write(lang_toggle(html, name, False))
        open(dest.replace('.html', '.uk.html'), 'w').write(lang_toggle(to_uk(html), name, True))
    shutil.copytree(os.path.join(SRC, 'img'), os.path.join(OUT, 'img'))
    with open(os.path.join(OUT, 'index.html'), 'w') as f:
        f.write('<!doctype html><meta charset="utf-8"><title>Kopytsia prototype</title>'
                '<meta name="viewport" content="width=device-width, initial-scale=1">'
                "<script>location.replace(screen.width < 700 ? 'HomeMobile.html' : 'Main.html')</script>"
                '<a href="Main.html">Open the prototype</a>')
    missing = check_links(OUT)
    n = len(glob.glob(os.path.join(OUT, '**', '*.html'), recursive=True))
    if missing:
        print('Broken links:\n  ' + '\n  '.join(missing)); sys.exit(1)
    print(f'OK: {n} pages in {os.path.relpath(OUT, ROOT)}/, all links resolve')


if __name__ == '__main__':
    main()
