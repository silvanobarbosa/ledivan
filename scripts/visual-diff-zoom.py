# Recorte 1:1 da mesma região em duas capturas, empilhado, para comparar tipografia de perto.
# Uso: ANTES=_visual/a DEPOIS=_visual/b python scripts/_diff_zoom.py <arquivo.png> x0 y0 x1 y1

import os
import sys
from PIL import Image

nome, x0, y0, x1, y1 = sys.argv[1], *map(int, sys.argv[2:6])
a = Image.open(os.path.join(os.environ.get("ANTES", "_visual/antes"), nome)).convert("RGB").crop((x0, y0, x1, y1))
d = Image.open(os.path.join(os.environ.get("DEPOIS", "_visual/depois"), nome)).convert("RGB").crop((x0, y0, x1, y1))
larg, alt = a.size
par = Image.new("RGB", (larg, alt * 2 + 8), "magenta")
par.paste(a, (0, 0))
par.paste(d, (0, alt + 8))
os.makedirs("_visual/diff", exist_ok=True)
saida = f"_visual/diff/zoom-{nome[:-4]}-{x0}x{y0}.png"
par.save(saida)
print(saida, par.size)
