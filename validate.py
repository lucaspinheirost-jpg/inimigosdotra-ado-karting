import re, glob, os, csv, sys, html, unicodedata, difflib
from collections import defaultdict, Counter
from html.parser import HTMLParser
from pypdf import PdfReader
root, csvp = sys.argv[1], sys.argv[2]
sys.stdout.reconfigure(encoding='utf-8')

base = defaultdict(list)
for r in csv.DictReader(open(csvp, encoding='utf-8')):
    base[int(r['corrida'])].append(r)

def strip(s): return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').upper()
def secs(t):
    p = t.split(':'); return round(sum(float(x) * 60 ** i for i, x in enumerate(reversed(p))), 3)

# ---------- 1. Fonte independente ----------
src = {}   # corrida -> list of (pos, raw_name, voltas, best_s, id)
class TP(HTMLParser):
    def __init__(s): super().__init__(); s.rows=[]; s.cur=None; s.cell=None
    def handle_starttag(s, t, a):
        if t == 'tr': s.cur = []
        if t == 'td' and s.cur is not None: s.cell = ''
    def handle_startendtag(s, t, a):
        if t == 'td' and s.cur is not None: s.cur.append('')
    def handle_endtag(s, t):
        if t == 'td' and s.cell is not None: s.cur.append(s.cell.strip()); s.cell = None
        if t == 'tr' and s.cur is not None: s.rows.append(s.cur); s.cur = None
    def handle_data(s, d):
        if s.cell is not None: s.cell += d
for f in glob.glob(os.path.join(root, '*', 'Prova*.html')):
    n = int(os.path.basename(os.path.dirname(f))[:2])
    b = open(f, 'rb').read()
    try: t = b.decode('utf-8')
    except UnicodeDecodeError: t = b.decode('cp1252')
    p = TP(); p.feed(t)
    hdr = [html.unescape(re.sub('<[^>]+>', '', h)).strip() for h in re.findall(r'<th[^>]*>(.*?)</th>', t, re.S)]
    iN, iV, iB = hdr.index('Nome'), hdr.index('Voltas'), hdr.index('Melhor Tempo')
    rows = []
    for c in p.rows:
        if c and c[0].isdigit():
            m = re.match(r'\[(\d+)\]\s*(.*)', c[iN]); rid, nm = (m.group(1), m.group(2)) if m else (None, c[iN])
            rows.append((int(c[0]), nm.strip(), int(c[iV]), secs(c[iB]), rid))
    src[n] = rows

def pdftext(f): return '\n'.join(pg.extract_text() for pg in PdfReader(f).pages)
for n in (9, 10, 13):
    f = glob.glob(os.path.join(root, f'{n:02d} - *', 'Prova*.pdf'))[0]
    t = re.sub(r'\s+', ' ', pdftext(f))
    rows = []
    for m in re.finditer(r'(?:^| )(\d{1,2}) (\d{3}) (?:\[(\d+)\] )?([A-ZÀ-Ü][A-ZÀ-Ü .]+?) RENTAL (\d{1,2}) (\d:\d\d\.\d{3})', t):
        rows.append((int(m.group(1)), m.group(4).strip(), int(m.group(5)), secs(m.group(6)), m.group(3)))
    if not rows:  # PDF sem espaços (prova 9)
        for ln in pdftext(f).splitlines():
            m = re.match(r'^(\d{1,2})(\d{3})(.+?) ?RENTAL ?(\d{1,2})(\d:\d\d\.\d{3})', ln)
            if m: rows.append((int(m.group(1)), m.group(3), int(m.group(4)), secs(m.group(5)), None))
    src[n] = rows
f = glob.glob(os.path.join(root, '04 - *', 'Prova*.pdf'))[0]
txt = pdftext(f)
txt = txt[txt.index('UF') + 2:]
rows = []
for chunk in re.split(r'\nSP\b', txt):
    tk = [x.strip() for x in chunk.strip().split('\n') if x.strip()]
    if len(tk) < 10 or not re.fullmatch(r'\d{1,2}|NC', tk[0]): continue
    times = [i for i, x in enumerate(tk) if re.fullmatch(r'\d\d:\d\d\.\d{3}', x)]
    pos = len(rows) + 1 if tk[0] == 'NC' else int(tk[0])
    rows.append((pos, ' '.join(tk[2:times[0] - 1]), int(tk[-2]), secs(tk[times[0]]), None))
src[4] = rows
# Prova 7 (foto): conferida a olho contra a imagem
src[7] = None

# ---------- 2. Comparar ----------
print('== Linhas por prova (fonte x base) ==')
probs = []
for n in sorted(base):
    b = sorted(base[n], key=lambda r: int(r['pos']))
    s = src.get(n)
    if s is None:
        print(f'P{n:02d}: base {len(b)} · fonte = foto (conferida manualmente)'); continue
    s = sorted(s)
    print(f'P{n:02d}: base {len(b)} · fonte {len(s)}' + ('' if len(b) == len(s) else '  <-- DIFERENTE'))
    for rb, rs in zip(b, s):
        if int(rb['pos']) != rs[0] or int(rb['voltas']) != rs[2] or abs(float(rb['melhor_volta_s']) - rs[3]) > 0.0005:
            probs.append((n, rb['pos'], rb['piloto'], rb['voltas'], rb['melhor_volta_s'], '| fonte:', rs))
print('Divergências de posição/voltas/melhor volta:', len(probs))
for p in probs: print('  ', p)

# ---------- 3. Nomes ----------
print('\n== Mesmo código de cadastro com nomes diferentes na base ==')
id2names = defaultdict(set)
for n, rows in src.items():
    if not rows: continue
    b = {int(r['pos']): r['piloto'] for r in base[n]}
    for pos, nm, v, bs, rid in rows:
        if rid: id2names[rid].add(b.get(pos))
bad = {k: v for k, v in id2names.items() if len(v) > 1}
print(bad or 'nenhum')
print('\n== Mesmo nome na base com códigos diferentes ==')
n2ids = defaultdict(set)
for k, v in id2names.items():
    for nm in v: n2ids[nm].add(k)
print({k: v for k, v in n2ids.items() if len(v) > 1} or 'nenhum')
print('\n== Nomes parecidos (possível pessoa repetida) ==')
names = sorted({r['piloto'] for rs in base.values() for r in rs})
for i, a in enumerate(names):
    for c in names[i + 1:]:
        ta, tc = strip(a).split(), strip(c).split()
        sim = difflib.SequenceMatcher(None, strip(a), strip(c)).ratio()
        if sim > 0.8 or (ta[0] == tc[0] and ta[-1] == tc[-1]) or (ta[0] == tc[0] and len(ta) > 1 and len(tc) > 1 and ta[1][:3] == tc[1][:3]):
            ca = sum(r['piloto'] == a for rs in base.values() for r in rs); cc = sum(r['piloto'] == c for rs in base.values() for r in rs)
            ra = sorted({n for n, rs in base.items() for r in rs if r['piloto'] == a}); rc = sorted({n for n, rs in base.items() for r in rs if r['piloto'] == c})
            print(f'  {a} {ra}  ~  {c} {rc}  ({sim:.2f})' + ('  MESMA PROVA' if set(ra) & set(rc) else ''))
print('\n== Piloto repetido dentro da mesma prova ==')
for n, rs in base.items():
    c = Counter(r['piloto'] for r in rs)
    for k, v in c.items():
        if v > 1: print('  ', n, k, v)
print('\n== Posições faltando/duplicadas ==')
for n, rs in sorted(base.items()):
    ps = sorted(int(r['pos']) for r in rs)
    if ps != list(range(1, len(ps) + 1)): print('  ', n, ps)

# ---------- 4. Indicadores independentes ----------
print('\n== Indicadores recalculados ==')
P = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}
st = defaultdict(lambda: Counter())
for n, rs in base.items():
    fast = min(rs, key=lambda r: float(r['melhor_volta_s']))
    for r in rs:
        p = int(r['pos']); s = st[r['piloto']]
        s['provas'] += 1; s['soma'] += p; s['voltas'] += int(r['voltas']); s['pontos'] += P.get(p, 0)
        s['vit'] += p == 1; s['pod'] += p <= 3; s['top5'] += p <= 5
        s['rap'] += r is fast
        s['melhor'] = min(s['melhor'] or 99, p)
grids = {n: len(rs) for n, rs in base.items()}
print('Provas', len(base), '| pilotos', len(st), '| 5+ provas', sum(s['provas'] >= 5 for s in st.values()),
      '| grid médio', round(sum(grids.values()) / len(grids), 1), '| maior grid', max(grids.values()),
      '| voltas', sum(s['voltas'] for s in st.values()), '| kartódromos', len({rs[0]['kartodromo'] for rs in base.values()}))
print('Datas', min(r['data'] for rs in base.values() for r in rs), 'a', max(r['data'] for rs in base.values() for r in rs))
top = sorted(st.items(), key=lambda kv: (-kv[1]['pontos'], -kv[1]['vit'], kv[0]))
print('\nTop 12 pontos:')
for k, s in top[:12]:
    print(f"  {k:24s} pts {s['pontos']:3d} provas {s['provas']:2d} vit {s['vit']} pod {s['pod']} top5 {s['top5']} melhor P{s['melhor']} média {s['soma']/s['provas']:.1f} rápidas {s['rap']} voltas {s['voltas']}")
print('Mais vitórias:', sorted(((s['vit'], k) for k, s in st.items()), reverse=True)[:4])
print('Mais voltas rápidas:', sorted(((s['rap'], k) for k, s in st.items()), reverse=True)[:5])
print('Mais provas:', sorted(((s['provas'], k) for k, s in st.items()), reverse=True)[:10])
print('\nVencedor e volta mais rápida por prova:')
for n, rs in sorted(base.items()):
    w = [r for r in rs if r['pos'] == '1'][0]; f = min(rs, key=lambda r: float(r['melhor_volta_s']))
    print(f"  P{n:02d} {rs[0]['data']} {rs[0]['kartodromo']:16s} grid {len(rs):2d} | {w['piloto']:22s} | {f['piloto']} {f['melhor_volta_s']}")
