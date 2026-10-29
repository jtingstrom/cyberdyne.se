#!/usr/bin/env python3
"""
Bygger webbplatsens färdiga filer från källkoden. Kör från repots rotmapp:

    python3 bygg.py

Skapar:
  kristallgruvan/index.html      spelet
  kristallgruvan/larare.html     lärarsidan
  kristallgruvan/foraldrar.html  information till föräldrar
  stil.css                       gemensam stil för portalen och nya sidor

Källkoden till Kristallgruvan finns i kristallgruvan/kalla/.
Inget behöver installeras, bara Python 3.
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent
K = ROOT / 'kristallgruvan' / 'kalla'
OUT = ROOT / 'kristallgruvan'

page_src = (K / 'page.html').read_text().replace('/*DIGITS*/', (K / 'digits.css').read_text())
css = re.search(r'<style>([\s\S]*?)</style>', page_src).group(1) + '\n' + (K / 'extra.css').read_text()
(ROOT / 'stil.css').write_text('/* Genereras av bygg.py från kristallgruvan/kalla – ändra inte här */\n' + css)

FAVICON = "data:image/svg+xml," + "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 7' shape-rendering='crispEdges'%3E%3Cpath fill='%230b0a10' d='M2 0h4v1h1v1h1v2H7v1H6v1H5v1H3V6H2V5H1V4H0V2h1V1h1z'/%3E%3Cpath fill='%23b58cff' d='M2 1h4v1h1v2H6v1H5v1H3V5H2V4H1V2h1z'/%3E%3Cpath fill='%23fff' d='M2 1h1v1H2zM1 2h1v1H1z'/%3E%3C/svg%3E"
FONTS = '''<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=Nunito:wght@500;700;800&display=swap">'''
KONTO = '<script src="../konto/config.js"></script>\n<script src="../konto/konto.js"></script>'
APP = '<main id="app"></main>\n<div id="toast" class="toast" role="status" aria-live="assertive"></div>\n<noscript><p style="padding:16px">Sidan behöver JavaScript.</p></noscript>'
STAT = (K / 'statcounter.html').read_text()

def page(title, desc, scripts, out, body=APP, head_extra='', konto=True):
    js = ''.join('<script>\n' + (K / f).read_text() + '\n</script>\n' for f in scripts)
    html = f'''<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">{head_extra}
<link rel="icon" href="{FAVICON}">
{FONTS}
<style>{css}</style>
</head>
<body>
{body}
{KONTO if konto else ''}
{js}{STAT}</body>
</html>
'''
    (OUT / out).write_text(html)
    print(OUT.name + '/' + out, len(html), 'tecken')

page('Kristallgruvan', 'Ett mattespel för åk 3–6: lös uppdrag, samla kristaller och varelser, bygg din bas och klättra på topplistan.',
     ['questions.js', 'engine.js', 'game.js', 'public-store.js', 'public-app.js'], 'index.html')
page('Kristallgruvan Lärarsida', 'Anonym statistik över vanliga fel i Kristallgruvan.',
     ['questions.js', 'teacher.js'], 'larare.html', head_extra='\n<meta name="robots" content="noindex">')

MOSSA = ['......pP........','.....pPPP.......','......PPp.......','..KKKKKKKKKKKK..','.KLLLGGGGGgGGGK.','.KLGGGGgGGGGGGK.','.KGGGGGGGGGgGGK.','.KGGWEGGGGWEGGK.','.KGGEEGGGGEEGGK.','.KGBBGGGGGGBBGK.','.KGGGGGMMGGGGGK.','.KGgGGGGGGGGgGK.','.KGGGGgGGGGGGGK.','..KKKKKKKKKKKK..','...KK......KK...','................']
MCOL = {'K':'#1d2b17','G':'#6cbf4a','L':'#93dd6a','g':'#4c9a35','P':'#9b6bff','p':'#d6c2ff','B':'#f08aa0','M':'#2c4a20','W':'#ffffff','E':'#1d2b17'}
rects = ''.join(f'<rect x="{x}" y="{y}" width="1.02" height="1.02" fill="{MCOL[c]}"/>' for y, row in enumerate(MOSSA) for x, c in enumerate(row) if c != '.')
page('Kristallgruvan för föräldrar', 'Information till föräldrar om mattespelet Kristallgruvan.', [], 'foraldrar.html',
     body=(K / 'parents-body.html').read_text().replace('__MOSSA__', rects), konto=False)
