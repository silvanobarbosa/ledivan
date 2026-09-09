// Imprime o id de um pagamento existente, só para o harness visual poder abrir /recibo/<id>.
// Leitura pura, uma linha. Uso: node scripts/_um_pagamento.mjs

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = readFileSync(".env.local", "utf8");
const url = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="))?.slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "");
if (!url) throw new Error("DATABASE_URL ausente no .env.local");

const sql = neon(url);
const linhas = await sql`select id from session_payments limit 1`;
console.log(linhas[0]?.id ?? "");
