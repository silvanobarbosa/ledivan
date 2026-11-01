import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { ABAS, COLUNAS, FORMATOS, PACOTES, STATUS, MODALIDADES, FORMAS, TETO_DE_LINHAS } from "@/lib/importarPlanilha";

/**
 * A PLANILHA MODELO — gerada na hora, a partir do mesmo contrato que o leitor usa.
 *
 * Decisão do dono (01/11): o modelo é gerado pelo app, não é um arquivo fixo que alguém sobe.
 * Assim modelo e leitor não têm como divergir — e a divergência teria o pior dos sintomas: a
 * planilha que o próprio app entregou voltando recusada.
 *
 * As abas de dados saem SÓ COM O CABEÇALHO. Linha de exemplo dentro delas seria importada junto
 * com os dados de verdade, e a terapeuta só descobriria ao ver um "João da Silva" na agenda. Os
 * exemplos moram na aba "Leia-me", onde não há o que importar.
 */
export const dynamic = "force-dynamic";

const LEIA_ME: (string | number)[][] = [
  ["Planilha de importação — Ledivan"],
  [],
  ["Como usar"],
  ["1.", "Preencha as abas Pacientes, Agenda e Pagamentos. Pode usar só as que precisar."],
  ["2.", "Não mude, não apague e não reordene a linha de cabeçalho de cada aba."],
  ["3.", "Em Ajustes > Importar dados, envie o arquivo. O app CONFERE e mostra o que encontrou."],
  ["4.", "Nada é gravado antes de você confirmar na tela."],
  [],
  ["O que o app faz com cada aba"],
  ["Pacientes", "Cria quem ainda não existe. Quem já existe (mesmo nome) é pulado, nunca sobrescrito."],
  ["Agenda", "Cria os atendimentos. Atendimento no mesmo paciente, dia e hora é pulado."],
  ["Pagamentos", "Lança o que já foi pago. O app encaixa cada pagamento nas cobranças em aberto, da mais antiga para a mais nova."],
  [],
  ["Importante sobre os pagamentos"],
  ["", "São HISTÓRICO: entram como pagamento do paciente, mas não entram no Caixa como dinheiro recebido hoje."],
  [],
  ["Limites"],
  ["", `Até ${TETO_DE_LINHAS} linhas por aba. Linha com problema é ignorada e aparece na conferência; o resto entra.`],
  [],
  ["Opções válidas"],
  ["formato_pagamento", FORMATOS.join(" · ")],
  ["pacote_tipo", PACOTES.join(" · ")],
  ["status", STATUS.join(" · ")],
  ["modalidade", MODALIDADES.join(" · ")],
  ["forma", FORMAS.join(" · ")],
  [],
  ["Exemplo — aba Pacientes"],
  COLUNAS.Pacientes.map((c) => c.chave),
  ["Maria Souza Lima", "12/03/1990", "123.456.789-00", "(11) 99999-0000", "maria@email.com", "", "", "mensal", "completo", "150,00", 4, 10, "05/02/2025"],
  [],
  ["Exemplo — aba Agenda"],
  COLUNAS.Agenda.map((c) => c.chave),
  ["Maria Souza Lima", "05/02/2025", "14:00", 50, "realizada", "presencial"],
  [],
  ["Exemplo — aba Pagamentos"],
  COLUNAS.Pagamentos.map((c) => c.chave),
  ["Maria Souza Lima", "10/02/2025", "600,00", "pix", "Maria Souza Lima"],
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const wb = XLSX.utils.book_new();

  const leiaMe = XLSX.utils.aoa_to_sheet(LEIA_ME);
  leiaMe["!cols"] = [{ wch: 22 }, { wch: 92 }];
  XLSX.utils.book_append_sheet(wb, leiaMe, "Leia-me");

  for (const aba of ABAS) {
    const colunas = COLUNAS[aba];
    const ws = XLSX.utils.aoa_to_sheet([colunas.map((c) => c.chave)]);
    // A ajuda de cada coluna vai como COMENTÁRIO do cabeçalho: fica à mão de quem está
    // preenchendo, sem virar uma linha que o leitor teria de aprender a ignorar.
    colunas.forEach((c, i) => {
      const ref = XLSX.utils.encode_cell({ r: 0, c: i });
      const cel = ws[ref];
      if (cel) cel.c = [{ a: "Ledivan", t: `${c.ajuda}${c.obrigatoria ? " (obrigatório)" : ""}${c.opcoes ? `\nOpções: ${c.opcoes.join(" · ")}` : ""}` }];
    });
    ws["!cols"] = colunas.map((c) => ({ wch: Math.max(14, c.chave.length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, aba);
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="ledivan-modelo-de-importacao.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
