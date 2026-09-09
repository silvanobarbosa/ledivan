# Compara pixel a pixel os PNGs de _visual/antes com os de _visual/depois.
# Imprime, por página, o percentual de pixels que mudaram e a caixa que os contém.
# Uso: python scripts/_diff_visual.py

import os
from PIL import Image, ImageChops

ANTES = os.environ.get("ANTES", "_visual/antes")
DEPOIS = os.environ.get("DEPOIS", "_visual/depois")
LIMIAR = 12  # diferença por canal abaixo disso é ruído de compressão/antialias

for nome in sorted(os.listdir(ANTES)):
    a_path, d_path = os.path.join(ANTES, nome), os.path.join(DEPOIS, nome)
    if not os.path.exists(d_path):
        print(f"{nome}: SEM PAR no depois")
        continue
    a = Image.open(a_path).convert("RGB")
    d = Image.open(d_path).convert("RGB")
    if a.size != d.size:
        print(f"{nome}: TAMANHO MUDOU {a.size} -> {d.size}")
        continue
    dif = ImageChops.difference(a, d).convert("L").point(lambda p: 255 if p > LIMIAR else 0)
    caixa = dif.getbbox()
    mudados = sum(dif.histogram()[1:])
    total = a.size[0] * a.size[1]
    pct = 100.0 * mudados / total
    print(f"{nome}: {a.size[0]}x{a.size[1]} diferentes={pct:.3f}% caixa={caixa}")
