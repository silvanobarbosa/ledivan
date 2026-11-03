/**
 * CONFERE OS TRÊS ITENS DO DASHBOARD (doc 76) CONTRA O BANCO — SOMENTE LEITURA.
 *
 * Nenhum INSERT/UPDATE/DELETE: o script só compara o que a consulta ANTIGA trazia com o que a
 * nova traz, sobre dados reais. É a diferença entre dizer "corrigi" e mostrar o número que mudou.
 *
 * Como "hoje" e "esta semana" podem estar vazios na base em que o script roda, ele mede o dia e a
 * semana de MAIOR movimento — que é onde a diferença aparece.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

for (const linha of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linha.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
}

const sql = neon(process.env.DATABASE_URL);
const FORA = ["cancelada", "realocada", "prof_desmarcou", "atestado"];

const contas = await sql`
  select u.id, u.name, count(t.id)::int as n from "user" u
  join therapy_sessions t on t.user_id = u.id
  group by u.id, u.name order by n desc`;
console.log(`contas com sessões: ${contas.map((c) => `${c.name} (${c.n})`).join(" · ")}\n`);

for (const dono of contas) {
  console.log(`=== ${dono.name} ===`);

  const [semana] = await sql`
    select date_trunc('week', date) as semana,
           count(*)::int as antes,
           count(*) filter (where status <> all(${FORA}))::int as depois
    from therapy_sessions where user_id = ${dono.id}
    group by 1 order by antes desc limit 1`;
  if (semana) {
    const dia = new Date(semana.semana).toLocaleDateString("pt-BR");
    console.log(`SESSÕES NA SEMANA  semana de ${dia}:  antes ${semana.antes}  ·  depois ${semana.depois}  (${semana.antes - semana.depois} desfeitas saíram)`);
  }

  const [diaCheio] = await sql`
    select date_trunc('day', date) as dia,
           count(*) filter (where status = 'agendada' and pending_confirmation = false)::int as antes,
           count(*)::int as depois
    from therapy_sessions where user_id = ${dono.id}
    group by 1 order by depois desc limit 1`;
  if (diaCheio) {
    const dia = new Date(diaCheio.dia).toLocaleDateString("pt-BR");
    console.log(`SESSÕES DO DIA     dia ${dia}:  antes ${diaCheio.antes}  ·  depois ${diaCheio.depois}`);
  }

  const [escondidas] = await sql`select count(*)::int as n from therapy_sessions
    where user_id = ${dono.id} and status = 'agendada' and pending_confirmation = true and recurring = true`;
  console.log(`recorrentes 'agendada' que o filtro pending=false escondia: ${escondidas.n}`);

  const [st] = await sql`select
      count(*) filter (where status = 'cancelada')::int as cancelada,
      count(*) filter (where status = 'realocada')::int as realocada,
      count(*) filter (where status = 'prof_desmarcou')::int as prof,
      count(*) filter (where status = 'atestado')::int as atestado
    from therapy_sessions where user_id = ${dono.id}`;
  console.log(`desfeitas no histórico: cancelada ${st.cancelada} · realocada ${st.realocada} · prof ${st.prof} · atestado ${st.atestado}\n`);
}
