# Bygger ett litet pixeltypsnitt med bara siffrorna 0-9 (tydliga 5x7-siffror)
import base64, io
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
D = {
 '0': ['.###.','#...#','#..##','#.#.#','##..#','#...#','.###.'],
 '1': ['..#..','.##..','..#..','..#..','..#..','..#..','.###.'],
 '2': ['.###.','#...#','....#','...#.','..#..','.#...','#####'],
 '3': ['####.','....#','....#','.###.','....#','....#','####.'],
 '4': ['...#.','..##.','.#.#.','#..#.','#####','...#.','...#.'],
 '5': ['#####','#....','####.','....#','....#','#...#','.###.'],
 '6': ['.###.','#....','#....','####.','#...#','#...#','.###.'],
 '7': ['#####','....#','...#.','..#..','.#...','.#...','.#...'],
 '8': ['.###.','#...#','#...#','.###.','#...#','#...#','.###.'],
 '9': ['.###.','#...#','#...#','.####','....#','....#','.###.'],
}
NAMES = {c: n for c, n in zip('0123456789', ['zero','one','two','three','four','five','six','seven','eight','nine'])}
U, ADV, LEFT, BOLD = 104, 690, 60, 42
fb = FontBuilder(1000, isTTF=True)
order = ['.notdef'] + [NAMES[c] for c in '0123456789']
fb.setupGlyphOrder(order)
fb.setupCharacterMap({ord(c): NAMES[c] for c in '0123456789'})
glyphs, metrics = {}, {}
p = TTGlyphPen(None); glyphs['.notdef'] = p.glyph(); metrics['.notdef'] = (ADV, 0)
for c, rows in D.items():
    pen = TTGlyphPen(None)
    for r, row in enumerate(rows):
        y0 = (6 - r) * U
        x = 0
        while x < 5:
            if row[x] == '#':
                s = x
                while x < 5 and row[x] == '#': x += 1
                x0, x1 = LEFT + s * U, LEFT + x * U + BOLD
                pen.moveTo((x0, y0 - 14)); pen.lineTo((x0, y0 + U)); pen.lineTo((x1, y0 + U)); pen.lineTo((x1, y0 - 14)); pen.closePath()
            else: x += 1
    glyphs[NAMES[c]] = pen.glyph(); metrics[NAMES[c]] = (ADV, LEFT)
fb.setupGlyf(glyphs); fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=900, descent=-250)
fb.setupNameTable({'familyName': 'KG Siffror', 'styleName': 'Regular'})
fb.setupOS2(sTypoAscender=900, sTypoDescender=-250, usWinAscent=900, usWinDescent=250, sxHeight=500, sCapHeight=700)
fb.setupPost()
buf = io.BytesIO(); fb.save(buf)
b64 = base64.b64encode(buf.getvalue()).decode()
css = '@font-face { font-family: "KG Siffror"; src: url(data:font/ttf;base64,' + b64 + ') format("truetype"); unicode-range: U+0030-0039; font-weight: 100 900; font-display: block; }\n'
open('/home/claude/kristallgruvan/src/digits.css', 'w').write(css)
print(len(buf.getvalue()), 'bytes')
