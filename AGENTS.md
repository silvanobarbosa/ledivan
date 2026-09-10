<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Conferência visual antes de dizer "pronto"

Mudança que toca layout, imagem ou fonte **não** se declara pronta com typecheck e lint. Existe
harness de navegador no repo, e ele não pede dependência nova (usa o playwright do
`@playwright/mcp` global; se houver `playwright` local, prefere o local):

```
npm run visual antes      # telas públicas: landing e login, desktop + mobile
# ... faz a mudança ...
npm run visual depois
npm run visual:diff       # % de pixels alterados por página, e a caixa que os contém
npm run visual:dash       # dashboard, drawer mobile — entra pela conta de demonstração
npm run visual:print      # prontuário e recibo com media=print (PAGAMENTO_ID=<id> p/ o recibo)
```

Para saber ONDE mudou, e não só quanto:

```
python scripts/visual-diff-bandas.py landing-desktop.png 300     # faixas mais alteradas
ANTES=_visual/antes DEPOIS=_visual/depois python scripts/visual-diff-zoom.py landing-desktop.png 190 250 800 420
```

Armadilhas já pagas, não repita:

- `waitUntil: "networkidle"` nunca assenta no dev server — o websocket do hot reload mantém a
  rede ocupada e o `goto` pendura até o timeout. Use `domcontentloaded` + prazo próprio.
- Medir largura de texto pelo `getBoundingClientRect()` de um `h1` não mede nada: `h1` é bloco,
  a largura é a do contêiner. Use um `Range` em volta do conteúdo.
- No dashboard da demo o tour de boas-vindas abre por cima e intercepta cliques.

**O screenshot de página inteira mente por padrão.** `fullPage: true` não ROLA a página, só
estica a captura — então tudo que está dentro de `<Reveal>` fica em `opacity-0` (ocupando
espaço, invisível) e imagem em lazy nem chega a ser pedida. Uma comparação antes/depois dá
"idêntico" porque os dois lados estão cegos no mesmo trecho. Por isso o harness chama
`revelarTudo(page)` antes de fotografar, e avisa se sobrar bloco invisível. Foi assim que
apareceu um ícone 404 vivo em produção que a captura cega não mostrava:
`node scripts/visual-imagens.mjs` lista imagem quebrada com o status HTTP.

# Onde paramos

Antes de propor trabalho neste repo, leia o `HISTORICO.md` da raiz. Ele traz o que já foi
entregue, as decisões do dono que continuam valendo e as armadilhas que já custaram tempo.
Ao fechar um bloco (PR mergeado, entrega no ar), acrescente a entrada lá — mais recente em cima.
