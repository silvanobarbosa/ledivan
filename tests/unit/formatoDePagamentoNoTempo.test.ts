import { describe, expect, it } from "vitest";
import { linhaDoFechamento, type PrecoVigente, type SessaoDoPacote } from "@/lib/fechamento";

/**
 * O FORMATO DE PAGAMENTO NÃO TEM DATA — E POR ISSO ELE REESCREVE O PASSADO.
 *
 * A regra do dono (15/09/2026): "Gratuito" significa que **naquele momento** não há cobrança. Não
 * é condição definitiva: o paciente pode sair de gratuito para qualquer formato, e voltar. "A
 * forma de pagamento atualmente selecionada deve sempre prevalecer sobre a configuração
 * anterior."
 *
 * A primeira metade disso funciona: medido no banco, trocar o formato GRAVA — o paciente de teste
 * tem quatro trocas registradas (sessao → gratuito → sessao → gratuito → sessao) e o cadastro bate
 * com a última.
 *
 * A segunda metade é que falha, e de um jeito que não aparece na tela do cadastro. `patients`
 * guarda UM `payment_format`, sem data de vigência, e o fechamento aplica esse valor único a
 * TODOS os meses da história. O preço não tem esse problema: `patient_price_history` tem
 * `dataEfetiva`, e `precoNaData` respeita. O formato não tem equivalente.
 *
 * Consequência — é o que estes testes provam:
 *
 *   - quem foi gratuito por meses e passa a pagar hoje **fica devendo os meses em que foi
 *     gratuito**, retroativamente;
 *   - quem pagava e passa a gratuito **tem as cobranças passadas apagadas**, e o que já foi pago
 *     vira crédito.
 *
 * Isso explica o relato de "o Financeiro não salva": salva sim — mas a tela do mês passado muda
 * junto, e quem vê isso conclui que a troca fez coisa errada e desfaz. Foi exatamente o padrão
 * encontrado no banco.
 *
 * Estes testes descrevem o comportamento ATUAL. Quando o formato passar a ter vigência, eles
 * viram o contrário — e é isso que se quer.
 */

const preco: PrecoVigente[] = [{ valor: 200, desde: new Date(2026, 0, 1) }];

/** Quatro sessões realizadas em agosto, todas contadas. */
const sessoesDeAgosto: SessaoDoPacote[] = [4, 11, 18, 25].map((dia) => ({
  id: `s${dia}`,
  date: new Date(2026, 7, dia, 9, 0, 0),
  status: "realizada",
}));

const linha = (formato: string, pagamentos: { valor: number; data: Date }[] = []) =>
  linhaDoFechamento({
    paciente: { id: "p1", nome: "Paciente", formato, valorDaSessao: 200 },
    sessoes: sessoesDeAgosto,
    precos: preco,
    pagamentos: pagamentos.map((p) => ({ pacienteId: "p1", status: "paid", ...p })),
    ano: 2026,
    mes: 7, // agosto
  });

describe("agosto já aconteceu — e muda conforme o formato de HOJE", () => {
  it("como gratuito, agosto não cobra nada", () => {
    expect(linha("gratuito").cobradoNoMes).toBe(0);
  });

  it("como 'a cada sessão', o MESMO agosto cobra as quatro sessões", () => {
    expect(linha("sessao").cobradoNoMes).toBe(800);
  });

  it("A FALHA: trocar o formato hoje reescreve o que agosto cobrou", () => {
    // Nada mudou em agosto: mesmas sessões, mesmo preço, mesma data. Só o campo do cadastro.
    const comoGratuito = linha("gratuito").cobradoNoMes;
    const comoPagante = linha("sessao").cobradoNoMes;
    expect(comoGratuito).not.toBe(comoPagante);
    expect(comoPagante - comoGratuito).toBe(800);
  });

  it("quem era gratuito e passa a pagar fica DEVENDO um mês que era de graça", () => {
    // Agosto foi atendido de graça; em setembro combina-se pagar. O saldo de agosto deveria
    // seguir zero, e não segue.
    const depoisDaTroca = linha("sessao");
    expect(depoisDaTroca.saldo).toBe(800);
    expect(depoisDaTroca.situacao).toBe("a_receber");
  });

  it("quem pagava e passa a gratuito vira CREDOR do que já tinha pago", () => {
    // Pagou os R$ 800 de agosto. Ao virar gratuito, a cobrança do mês desaparece e o pagamento
    // fica sobrando.
    const pago = [{ valor: 800, data: new Date(2026, 7, 30) }];
    const antes = linha("sessao", pago);
    expect(antes.saldo).toBe(0);
    expect(antes.situacao).toBe("pago");

    const depois = linha("gratuito", pago);
    expect(depois.cobradoNoMes).toBe(0);
    expect(depois.saldo).toBe(-800);
    // E aqui é pior do que "pago a mais": o saldo é de R$ 800 A DEVOLVER, mas a situação sai
    // como "sem cobrança" — a tela não mostra que há crédito. O dinheiro some da leitura sem
    // sumir do banco, que é o modo de falha mais caro: ninguém procura o que não aparece.
    expect(depois.situacao).toBe("sem_cobranca");
  });
});

describe("o preço, ao contrário do formato, respeita a data", () => {
  it("reajuste em setembro não muda o que agosto cobrou", () => {
    const comReajuste: PrecoVigente[] = [
      { valor: 200, desde: new Date(2026, 0, 1) },
      { valor: 300, desde: new Date(2026, 8, 1) }, // setembro
    ];
    const agosto = linhaDoFechamento({
      paciente: { id: "p1", nome: "Paciente", formato: "sessao", valorDaSessao: 200 },
      sessoes: sessoesDeAgosto,
      precos: comReajuste,
      pagamentos: [],
      ano: 2026,
      mes: 7,
    });
    // 4 × 200, não 4 × 300: `precoNaData` olha a vigência. É o modelo que falta ao formato.
    expect(agosto.cobradoNoMes).toBe(800);
  });
});
