// Dados mock ricos para silvanobarbosa@gmail.com (login Google). Rodar: npm run seed:silvano
import { runSeed } from "./seedCore";

runSeed({
  email: "silvanobarbosa@gmail.com",
  name: "Silvano Barbosa",
  bookingSlug: "silvano-barbosa",
  months: 24,
  active: 30,
  paused: 12,
  inactive: 30,
  prospects: 18,
})
  .then(() => process.exit(0))
  .catch((e) => { console.error("❌", e); process.exit(1); });
