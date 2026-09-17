import { describe, expect, it } from "vitest";
import { linhasDaGeral, type EntradaDaGeral, type LinhaDaGeral } from "@/lib/guiaGeral";

/**
 * As marcas "recibo emitido" / "nota emitida" (onda 4, documento de 17/09).
 *
 * Elas moram na linha do pagamento, ao lado de "Pago" — por isso precisam atravessar o motor de
 * cobranças junto com o pagamento que as carrega. São DUAS marcas independentes: quem emitiu a nota
 * no Receita Saúde pode não ter passado recibo, e o contrário também acontece.
 */

const desde = new Date(2026, 0, 1);
const hoje = new Date(2026, 8, 15, 12);
const sessao = (dia: number) => ({ id: `s${dia}`, date: new Date(2026, 8, dia, 9), status: "realizada" });

function comPagamento(p: Partial<EntradaDaGeral["pagamentos"][number]>): LinhaDaGeral[] {
  return linhasDaGeral({
    vigencias: [{ formato: "sessao", pacoteTipo: "completo", desde }],
    reserva: { formato: "sessao" },
    precos: [{ valor: 130, desde }],
    sessoes: [sessao(1)],
    hoje,
    pagamentos: [
      {
        id: "pg1", valor: 130, data: new Date(2026, 8, 1, 10), status: "paid",
        metodo: "pix", pagoPor: "Maria", cobrancaChave: "sessao:s1",
        ...p,
      },
    ],
  });
}

const pago = (linhas: LinhaDaGeral[]) => {
  const l = linhas.find((x) => x.tipo === "sessao");
  return l && l.tipo === "sessao" ? l.cobranca?.pagamento : null;
};

describe("as marcas de emissão chegam à linha do pagamento", () => {
  it("pagamento sem documento emitido não carrega marca nenhuma", () => {
    expect(pago(comPagamento({}))).toMatchObject({ recibo: false, nota: false });
  });

  it("recibo emitido acende só o recibo", () => {
    expect(pago(comPagamento({ recibo: true }))).toMatchObject({ recibo: true, nota: false });
  });

  it("nota emitida acende só a nota", () => {
    expect(pago(comPagamento({ nota: true }))).toMatchObject({ recibo: false, nota: true });
  });

  it("os dois documentos convivem no mesmo pagamento", () => {
    expect(pago(comPagamento({ recibo: true, nota: true }))).toMatchObject({ recibo: true, nota: true });
  });

  it("o id do pagamento vem junto — é o endereço da página do recibo", () => {
    expect(pago(comPagamento({}))?.id).toBe("pg1");
  });
});
