// Conta DEMO "apoiador@ledivan.com.br" (login por senha). Rodar: npm run seed:apoiador
import { runSeed } from "./seedCore";

runSeed({
  email: "apoiador@ledivan.com.br",
  name: "Dra. Helena Moraes",
  password: "ledivan12345",
  bookingSlug: "helena-moraes",
  months: 30,
  active: 30,
  paused: 4,
  inactive: 8,
  prospects: 12,
})
  .then(() => process.exit(0))
  .catch((e) => { console.error("❌", e); process.exit(1); });
