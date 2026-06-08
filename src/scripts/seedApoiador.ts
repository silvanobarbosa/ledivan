// Conta DEMO "apoiador@ledivan.com.br" (login por senha). Rodar: npm run seed:apoiador
import { runSeed } from "./seedCore";

runSeed({
  email: "apoiador@ledivan.com.br",
  name: "Dra. Helena Moraes",
  password: "ledivan12345",
  bookingSlug: "helena-moraes",
  months: 24,
  active: 25,
  paused: 10,
  inactive: 25,
  prospects: 14,
})
  .then(() => process.exit(0))
  .catch((e) => { console.error("❌", e); process.exit(1); });
