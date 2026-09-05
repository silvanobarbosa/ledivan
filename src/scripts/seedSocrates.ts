// Conta de DEMONSTRAÇÃO pública "Dr. Sócrates" — persistente e SOMENTE LEITURA.
// 3 anos de uso, ~100 pacientes (30 ativos), exercitando 100% das telas do sistema.
// Rodar: npm run seed:socrates
//
// A demo é READ-ONLY (o proxy bloqueia escrita quando a sessão é demo), então os dados NÃO são
// recriados a cada visita — ficam persistidos. Re-rodar este script atualiza/reconstrói a demo.
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { runSeed, seedExtras, seedDionisia } from "./seedCore";
import { FEATURES } from "../lib/features";

const EMAIL = "socrates@ledivan.com.br";

async function main() {
  const userId = await runSeed({
    email: EMAIL,
    name: "Dr. Sócrates",
    password: "demo-ledivan",   // login da conta demo (não é segredo — conta pública de leitura)
    bookingSlug: "dr-socrates",
    months: 36,                 // 3 anos
    active: 30,                 // 30 ativos (pedido do dono)
    paused: 18,
    inactive: 42,
    prospects: 12,              // total: 102 pacientes, 30 ativos
  });

  await seedExtras(userId);
  await seedDionisia(userId); // paciente-modelo do "outro lado" (app/portal do paciente)

  // Todos os recursos do paciente LIGADOS (modo "all") para a demo mostrar 100% do app do
  // paciente. + Pix estático (pagamento no app), cronômetro visível, transcrição on.
  const features = Object.fromEntries(FEATURES.map((f) => [f.key, "all"]));
  const preferences = {
    features,
    timerShowToPatient: true,
    transcriptionEnabled: true,
    meetingProvider: "jitsi",
    bookingAutoConfirm: false,
    autoCobranca: false,
    pix: { key: "socrates@ledivan.com.br", name: "Dr. Sócrates", city: "SAO PAULO" },
  };

  // Perfil completo + marca como DEMO persistente. isDemo=true mantém a conta fora das métricas
  // reais (o painel admin exclui contas demo). Termos aceitos p/ não travar no 1º acesso.
  await db.update(users).set({
    isDemo: true,
    demoExpires: null,          // persistente (não expira)
    role: "user",
    acceptedTermsAt: new Date(),
    acceptedPrivacyAt: new Date(),
    emailConfigured: true,
    whatsappConnected: true,
    whatsappInstance: "ledivan_demo_socrates",
    preferences: JSON.stringify(preferences),
    // São Paulo/SP (IBGE 3550308) → feriados aparecem na agenda
    holidayCities: JSON.stringify([{ ibge: 3550308, nome: "São Paulo", uf: "SP" }]),
  }).where(eq(users.id, userId));

  console.log(`\n✅ Dr. Sócrates pronto (${userId}). Login demo: ${EMAIL}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("❌", e); process.exit(1); });
