# Onde estão as diferenças: divide a página em faixas horizontais e lista as mais alteradas.
# Depois recorta essa faixa do antes e do depois, lado a lado, para inspeção humana.
# Uso: python scripts/_diff_bandas.py <arquivo.png> [altura-da-faixa]

import os
import sys
from PIL import Image, ImageChops

nome = sys.argv[1] if len(sys.argv) > 1 else "landing-desktop.png"
FAIXA = int(sys.argv[2]) if len(sys.argv) > 2 else 200
LIMIAR = 12

a = Image.open(os.path.join(os.environ.get("ANTES", "_visual/antes"), nome)).convert("RGB")
d = Image.open(os.path.join(os.environ.get("DEPOIS", "_visual/depois"), nome)).convert("RGB")
dif = ImageChops.difference(a, d).convert("L").point(lambda p: 255 if p > LIMIAR else 0)

larg, alt = a.size
bandas = []
for topo in range(0, alt, FAIXA):
    base = min(topo + FAIXA, alt)
    recorte = dif.crop((0, topo, larg, base))
    mudados = sum(recorte.histogram()[1:])
    pct = 100.0 * mudados / (larg * (base - topo))
    bandas.append((pct, topo, base))

bandas.sort(reverse=True)
os.makedirs("_visual/diff", exist_ok=True)
for i, (pct, topo, base) in enumerate(bandas[:5]):
    if pct < 0.01:
        continue
    print(f"faixa y={topo}-{base}: {pct:.2f}% diferentes")
    par = Image.new("RGB", (larg * 2 + 20, base - topo), "magenta")
    par.paste(a.crop((0, topo, larg, base)), (0, 0))
    par.paste(d.crop((0, topo, larg, base)), (larg + 20, 0))
    saida = f"_visual/diff/{nome[:-4]}-y{topo}.png"
    par.save(saida)
    print("  ->", saida)
