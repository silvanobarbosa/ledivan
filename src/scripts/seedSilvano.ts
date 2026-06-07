// Dados mock ricos para silvanobarbosa@gmail.com (login Google). Rodar: npm run seed:silvano
import { runSeed } from "./seedCore";

runSeed({
  email: "silvanobarbosa@gmail.com",
  name: "Silvano Barbosa",
  bookingSlug: "silvano-barbosa",
  months: 24,
  active: 48,
  paused: 6,
  inactive: 12,
  prospects: 16,
})
  .then(() => process.exit(0))
  .catch((e) => { console.error("❌", e); process.exit(1); });
