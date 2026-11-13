// Conta DEMO "apoiador@ledivan.com.br" (login por senha). Rodar: npm run seed:apoiador
import { runSeed } from "./seedCore";

runSeed({
  email: "apoiador@ledivan.com.br",
  name: "Dra. Helena Moraes",
  // A senha vem do ambiente: repositório é público, e senha literal aqui vira credencial
  // publicada. Sem a variável, o seed para e diz o que falta — melhor do que criar uma conta com
  // senha conhecida por quem passar o olho no repo.
  password: process.env.SEED_PASSWORD ?? "",
  bookingSlug: "helena-moraes",
  months: 24,
  active: 25,
  paused: 10,
  inactive: 25,
  prospects: 14,
})
  .then(() => process.exit(0))
  .catch((e) => { console.error("❌", e); process.exit(1); });
