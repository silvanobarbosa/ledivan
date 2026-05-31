// src/scripts/checkStitch.ts
import { access } from "node:fs/promises";
import path from "node:path";

/**
 * Verifica se os arquivos baixados pelo fetchStitch.ts existem.
 */
async function checkStitchAssets() {
  const baseDir = path.resolve(process.cwd(), "src", "stitch");
  const requiredFiles = ["index.html", "stitch.css", "screenshot.png"];

  // Verifica o diretório
  try {
    await access(baseDir);
  } catch {
    console.error(`❌ Diretório ${baseDir} não encontrado. Execute 'npm run fetch:stitch' primeiro.`);
    process.exit(1);
  }

  // Verifica cada arquivo
  const missing: string[] = [];
  for (const file of requiredFiles) {
    try {
      await access(path.join(baseDir, file));
    } catch {
      missing.push(file);
    }
  }

  if (missing.length) {
    console.error(
      `❌ Faltam os seguintes assets Stitch: ${missing.join(", ")}`
    );
    process.exit(1);
  }

  console.log("✅ Todos os assets Stitch estão presentes e corretos.");
}

checkStitchAssets().catch((err) => {
  console.error("❌ Erro ao validar assets:", err);
  process.exit(1);
});
