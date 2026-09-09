// Catraca do lint: a CI falha se o número de ERROS crescer.
//
// Por que catraca e não "falhar em qualquer erro": o lint ficou cinco dias sem rodar e voltou
// com 162 erros. Exigir zero hoje bloquearia todo PR e o time desligaria a checagem de novo —
// que foi exatamente como chegamos aqui (a CI já roda um eslint próprio com continue-on-error).
// A catraca deixa trabalhar e impede piorar. Quando o número cai, ela mesma manda apertar.
//
// Uso: node scripts/lint-ratchet.mjs [--atualizar]

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ARQUIVO = "lint-baseline.json";
const atualizar = process.argv.includes("--atualizar");

function contarErros() {
  let saida = "";
  try {
    // chama o eslint local pelo node: `npx` não resolve em spawn no Windows (ENOENT)
    saida = execFileSync(process.execPath, ["node_modules/eslint/bin/eslint.js", "-f", "json"], { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 });
  } catch (e) {
    // eslint sai com 1 quando encontra problema — a saída ainda é o JSON que queremos.
    saida = e.stdout?.toString() ?? "";
    if (!saida.trim().startsWith("[")) {
      console.error("eslint não produziu JSON — o lint está QUEBRADO, não apenas com erros:");
      console.error((e.stderr?.toString() || e.message || "").slice(0, 800));
      process.exit(2);
    }
  }
  const rel = JSON.parse(saida);
  let erros = 0;
  const porRegra = {};
  for (const arq of rel) {
    for (const m of arq.messages) {
      if (m.severity !== 2) continue;
      erros++;
      porRegra[m.ruleId ?? "(sem regra)"] = (porRegra[m.ruleId ?? "(sem regra)"] ?? 0) + 1;
    }
  }
  return { erros, porRegra };
}

const { erros, porRegra } = contarErros();

if (atualizar) {
  writeFileSync(ARQUIVO, JSON.stringify({ erros, porRegra, atualizadoEm: new Date().toISOString().slice(0, 10) }, null, 2) + "\n");
  console.log(`baseline gravado: ${erros} erros`);
  process.exit(0);
}

if (!existsSync(ARQUIVO)) {
  console.error(`${ARQUIVO} não existe. Rode: node scripts/lint-ratchet.mjs --atualizar`);
  process.exit(2);
}

const base = JSON.parse(readFileSync(ARQUIVO, "utf8"));
console.log(`erros agora: ${erros} · teto atual: ${base.erros}`);

if (erros > base.erros) {
  const novas = Object.entries(porRegra)
    .filter(([regra, n]) => n > (base.porRegra?.[regra] ?? 0))
    .map(([regra, n]) => `  ${regra}: ${base.porRegra?.[regra] ?? 0} → ${n}`);
  console.error(`\nO lint PIOROU: ${erros - base.erros} erro(s) a mais que o teto.`);
  if (novas.length) console.error(novas.join("\n"));
  console.error("\nCorrija, ou justifique com eslint-disable-next-line explicando o porquê.");
  process.exit(1);
}

if (erros < base.erros) {
  console.log(`\nMelhorou ${base.erros - erros} erro(s). Aperte a catraca:`);
  console.log("  node scripts/lint-ratchet.mjs --atualizar   (e commite o lint-baseline.json)");
}

process.exit(0);
