// src/scripts/fetchStitch.mts
import { stitch } from "@google/stitch-sdk";
import path from "node:path";

/**
 * Baixa os assets (HTML, CSS e screenshot) de um projeto Stitch.
 */
async function fetchStitchAssets() {
  const projectId = process.env.STITCH_PROJECT_ID;

  if (!projectId) {
    console.error("⚠️  STITCH_PROJECT_ID é obrigatório no .env.local.");
    process.exit(1);
  }

  console.log(`🚀 Iniciando download de assets para o projeto: ${projectId}...`);

  try {
    // Obtém a referência ao projeto
    const project = await stitch.project(projectId);

    // Diretório de saída
    const outDir = path.resolve(process.cwd(), "src", "stitch");

    // Usa o método nativo do SDK para baixar e organizar os assets
    const result = await project.downloadAssets(outDir);

    console.log(`✅ Download concluído! ${result.screens.length} telas baixadas.`);
    result.screens.forEach(t => {
      console.log(`   - Screen ID: ${t.screenId} -> ${t.filePath}`);
    });

    console.log("\n🎉 Todos os assets Stitch foram integrados com sucesso!");
  } catch (error) {
    console.error("❌ Erro durante o download dos assets:", error);
    process.exit(1);
  }
}

fetchStitchAssets().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});
