// Zera os dados de um usuário (mantém a conta). Uso: npm run wipe -- email@dominio
import { wipeUser } from "./seedCore";

const email = process.argv[2];
if (!email) { console.error("Informe o e-mail: npm run wipe -- email@dominio"); process.exit(1); }
wipeUser(email).then(() => process.exit(0)).catch((e) => { console.error("❌", e); process.exit(1); });
