import json, csv, sys
races = json.load(open(sys.argv[1], encoding='utf-8'))
def title(n):
    small = {'DE', 'DA', 'DO', 'DOS', 'DAS'}
    return ' '.join(w.lower() if w in small else (w if w.endswith('.') and len(w) <= 2 else w.capitalize()) for w in n.split())
def secs(t):
    m, s = t.split(':'); return round(int(m) * 60 + float(s), 3)
with open(sys.argv[2], 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(['corrida', 'data', 'kartodromo', 'pos', 'piloto', 'voltas', 'melhor_volta_s'])
    for r in races:
        d, m, y = r['date'].split('-')
        for pos, nm, v, b in r['res']:
            w.writerow([r['n'], f'{y}-{m}-{d}', r['track'], pos, title(nm), v, secs(b)])
bad = [x[1] for r in races for x in r['res'] if '�' in x[1]]
print('bad', bad)
print(open(sys.argv[2], encoding='utf-8').read()[:600].encode('ascii', 'backslashreplace').decode())
