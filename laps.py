"""Extrai volta a volta de todas as provas e casa cada piloto com o nome canônico da base de resultados."""
import re, glob, os, csv, sys, html, unicodedata
from collections import defaultdict
from pypdf import PdfReader
root, rescsv, outcsv = sys.argv[1:4]
sys.stdout.reconfigure(encoding='utf-8')

def key(s): return re.sub(r'[^A-Z]', '', ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').upper())
def secs(t):
    p = t.split(':'); return round(sum(float(x) * 60 ** i for i, x in enumerate(reversed(p))), 3)
def rd(f):
    b = open(f, 'rb').read()
    try: return b.decode('utf-8')
    except UnicodeDecodeError: return b.decode('cp1252')
def pdftext(f): return '\n'.join(pg.extract_text() for pg in PdfReader(f).pages)
folder = {int(os.path.basename(p)[:2]): p for p in glob.glob(os.path.join(root, '[0-9][0-9] - *')) if os.path.isdir(p)}

# ---- base de resultados (canônica) e nomes crus da folha de resultado, por posição ----
base = defaultdict(list)
for r in csv.DictReader(open(rescsv, encoding='utf-8')): base[int(r['corrida'])].append(r)
raw = {}
for n, p in folder.items():
    hs = glob.glob(os.path.join(p, 'Prova*.html'))
    if hs:
        t = re.sub(r'<td([^>]*)/>', r'<td\1></td>', rd(hs[0]))
        hdr = [h.strip() for h in re.findall(r'<th[^>]*>(.*?)</th>', t, re.S)]
        i = hdr.index('Nome'); rows = {}
        for tr in re.findall(r'<tr>(.*?)</tr>', t, re.S):
            c = [html.unescape(re.sub('<[^>]+>', '', x)).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)]
            if c and c[0].isdigit(): rows[int(c[0])] = re.sub(r'^\[\d+\]\s*', '', c[i])
        raw[n] = rows
    elif n in (9, 10, 13):
        t = pdftext(glob.glob(os.path.join(p, 'Prova*.pdf'))[0]); rows = {}
        for m in re.finditer(r'(?:^| )(\d{1,2}) (\d{3}) (?:\[\d+\] )?([A-ZÀ-Ü][A-ZÀ-Ü .]+?) RENTAL (\d{1,2}) (\d:\d\d\.\d{3})', re.sub(r'\s+', ' ', t)):
            rows[int(m.group(1))] = m.group(3)
        if not rows:
            for ln in t.splitlines():
                m = re.match(r'^(\d{1,2})(\d{3})(.+?) ?RENTAL ?(\d{1,2})(\d:\d\d\.\d{3})', ln)
                if m: rows[int(m.group(1))] = m.group(3)
        raw[n] = rows
canon = {}
for n, rs in base.items():
    for r in rs:
        canon[(n, key(r['piloto']))] = r['piloto']
        if n in raw and int(r['pos']) in raw[n]: canon[(n, key(raw[n][int(r['pos'])]))] = r['piloto']
canon[(4, key('Lucas Pinheiro Moreno'))] = 'Lucas Pinheiro'

# ---- volta a volta ----
laps = []   # (corrida, piloto_cru, volta, tempo, s1, s2, s3)
for n, p in sorted(folder.items()):
    fs = glob.glob(os.path.join(p, 'Volta a Volta*'))
    if not fs: continue
    f = fs[0]
    if f.endswith('.html'):
        t = re.sub(r'<td([^>]*)/>', r'<td\1></td>', rd(f))
        hdr = [h.strip() for h in re.findall(r'<th[^>]*>(.*?)</th>', t, re.S)]
        who = None
        for tr in re.findall(r'<tr>(.*?)</tr>', t, re.S):
            c = [html.unescape(re.sub('<[^>]+>', '', x)).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)]
            if len(c) == 1:
                m = re.match(r'\d+ - (?:\[\d+\] )?(.+?) - ', c[0]); who = m.group(1) if m else None
            elif len(c) > 3 and who and c[1].isdigit():
                d = dict(zip(hdr, c))
                s = [d.get(k, '') for k in ('S1', 'S2', 'S3')]
                laps.append((n, who, int(d['Volta']), secs(d['Volta Tm']), *[float(x) if re.fullmatch(r'\d+\.\d+', x or '') else None for x in s]))
    elif n == 4:
        tk = [x.strip() for x in pdftext(f).splitlines()]
        who = tk[1]
        i = tk.index('VM (Km/h)') + 1
        while i + 6 < len(tk) and re.fullmatch(r'\d+', tk[i]) and re.fullmatch(r'\d\d:\d\d\.\d{3}', tk[i + 2]):
            laps.append((n, who, int(tk[i + 1]), secs(tk[i + 2]), None, None, None)); i += 7
    elif n == 7:
        print('P07: volta a volta é foto escaneada com OCR ilegível — ignorada')
    else:
        who = None
        for ln in pdftext(f).splitlines():
            m = re.match(r'^\d{3} - (?:\[\d+\] )?(.+?) - RENTAL', ln.strip())
            if m: who = m.group(1); continue
            m = re.match(r'^\d\d:\d\d:\d\d\.\d{3} (\d+) ?(\d+?) ?(\d:\d\d\.\d{3}) [\d,]+(.*)$', ln.strip())
            if m and who:
                rest = re.findall(r'\d+\.\d{3}', m.group(4))
                sec = [float(x) for x in rest[1:4]] if len(rest) >= 4 else [None] * 3
                laps.append((n, who, int(m.group(1)), secs(m.group(3)), *sec))

# ---- casar nomes e validar contra o resultado oficial ----
out, sem_nome, probs, glitch = [], set(), [], []
# Pista = kartódromo + traçado (cabeçalho da folha) + condição. Provas 3 e 12: mesmo Circuito 101, mas todos os
# setores ~30% mais lentos na mesma proporção (piso molhado/lento) — ficam separadas para não distorcer a volta ideal.
PISTA = {3: 'Granja Viana · Circuito 101 · piso lento', 12: 'Granja Viana · Circuito 101 · piso lento',
         5: 'Granja Viana · Circuito 136', 4: 'Interlagos', 7: 'Aldeia da Serra'}
by = defaultdict(list)
for n, who, v, t, s1, s2, s3 in laps:
    nm = canon.get((n, key(who)))
    if not nm: sem_nome.add((n, who)); continue
    by[(n, nm)].append((v, t, s1, s2, s3))
for (n, nm), ls in by.items():
    res = next(r for r in base[n] if r['piloto'] == nm)
    ls.sort()
    ob = float(res['melhor_volta_s'])
    # volta abaixo da melhor volta oficial = falha de cronometragem (laço perdido / volta partida)
    valid = [(v, t, s1, s2, s3, 0 if t < ob - 0.0005 else 1) for v, t, s1, s2, s3 in ls]
    glitch.extend((n, nm, v, t) for v, t, *_, ok in valid if not ok)
    best = min(t for v, t, *_, ok in valid if ok)
    if len(ls) != int(res['voltas']) or abs(best - ob) > 0.0005:
        probs.append((n, nm, 'voltas', len(ls), 'oficial', res['voltas'], 'melhor', best, 'oficial', res['melhor_volta_s']))
    for v, t, s1, s2, s3, ok in valid:
        # setores só valem quando os três existem e somam o tempo da volta (senão o laço perdeu uma passagem)
        if s1 is None or s2 is None or s3 is None or abs(s1 + s2 + s3 - t) > 0.02:
            s1 = s2 = s3 = None
        out.append((PISTA.get(n, 'Granja Viana · Circuito 101'), n, nm, v, t, s1, s2, s3, ok))
out.sort()
with open(outcsv, 'w', encoding='utf-8', newline='') as fh:
    w = csv.writer(fh); w.writerow(['corrida', 'piloto', 'volta', 'tempo_s', 's1', 's2', 's3', 'valida', 'pista'])
    for r in out: w.writerow(['' if x is None else x for x in r[1:]] + [r[0]])
print('Voltas extraídas:', len(out), '| pilotos-prova:', len(by))
cov = defaultdict(lambda: [0, 0, 0])
for _, n, nm, v, t, s1, *_ in out: cov[n][0] += 1; cov[n][1] += s1 is not None
for n in sorted(folder):
    tot = sum(int(r['voltas']) for r in base[n]); np_ = len({nm for (m, nm) in by if m == n})
    print(f'  P{n:02d}: {cov[n][0]:4d} voltas de {tot:4d} oficiais · {np_:2d}/{len(base[n]):2d} pilotos · setores em {cov[n][1]} voltas')
print('Nomes sem correspondência:', sorted(sem_nome) or 'nenhum')
print('Voltas marcadas como falha de cronometragem:', glitch)
print('Divergências contra o resultado oficial:', len(probs))
for p in probs: print('  ', p)
