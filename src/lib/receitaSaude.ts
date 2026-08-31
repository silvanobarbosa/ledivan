// Helper do Receita Saúde (recibo eletrônico de serviços de saúde da Receita Federal).
// NÃO emite nada — a emissão é ato pessoal do terapeuta no app gov.br. Aqui só montamos, prontos
// para copiar, os campos exatos que o app pede, a partir do que o Ledivan já guarda.

export type ReceitaSaudePatient = {
  name: string;
  cpf?: string | null;          // CPF do paciente (beneficiário)
  guardianName?: string | null;
  guardianCpf?: string | null;  // CPF do responsável (pagador, quando menor/incapaz)
};

export type ReceitaSaudePayment = {
  amount: string | number;      // valor pago
  date: string | Date;          // data do pagamento
};

export type ReceitaSaudeFields = {
  beneficiaryName: string;
  beneficiaryCpf: string;       // vazio => alerta de dado faltando
  payerName: string;
  payerCpf: string;
  amount: string;               // "150.00"
  amountBRL: string;            // "R$ 150,00"
  date: string;                 // "YYYY-MM-DD"
  dateBR: string;               // "dd/mm/aaaa"
  description: string;
  missing: string[];            // campos obrigatórios ausentes
};

const onlyDigits = (s?: string | null) => (s || "").replace(/\D/g, "");

// Formata CPF 000.000.000-00 quando tiver 11 dígitos; senão devolve o que veio.
function fmtCpf(cpf?: string | null): string {
  const d = onlyDigits(cpf);
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : (cpf || "");
}

function toDate(d: string | Date): Date {
  return d instanceof Date ? d : new Date(d);
}

export function receitaSaudeFields(
  payment: ReceitaSaudePayment,
  patient: ReceitaSaudePatient,
  descriptionDefault = "Atendimento psicológico",
): ReceitaSaudeFields {
  const amountNum = typeof payment.amount === "number" ? payment.amount : Number(payment.amount || 0);
  const dt = toDate(payment.date);

  // Pagador: responsável (se houver CPF de responsável); senão o próprio paciente.
  const hasGuardian = !!onlyDigits(patient.guardianCpf);
  const payerName = hasGuardian ? (patient.guardianName || patient.name) : patient.name;
  const payerCpfRaw = hasGuardian ? patient.guardianCpf : patient.cpf;

  const beneficiaryCpf = fmtCpf(patient.cpf);
  const payerCpf = fmtCpf(payerCpfRaw);

  const missing: string[] = [];
  if (!onlyDigits(patient.cpf)) missing.push("CPF do paciente");
  if (!onlyDigits(payerCpfRaw)) missing.push("CPF do pagador");
  if (!(amountNum > 0)) missing.push("Valor");

  return {
    beneficiaryName: patient.name,
    beneficiaryCpf,
    payerName,
    payerCpf,
    amount: amountNum.toFixed(2),
    amountBRL: amountNum.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    date: dt.toISOString().slice(0, 10),
    dateBR: dt.toLocaleDateString("pt-BR"),
    description: descriptionDefault,
    missing,
  };
}

// Bloco de texto pronto para copiar (o terapeuta cola no app campo a campo).
export function receitaSaudeCopyText(f: ReceitaSaudeFields): string {
  return [
    `Beneficiário: ${f.beneficiaryName}`,
    `CPF do beneficiário: ${f.beneficiaryCpf || "—"}`,
    `Pagador: ${f.payerName}`,
    `CPF do pagador: ${f.payerCpf || "—"}`,
    `Valor: ${f.amountBRL}`,
    `Data: ${f.dateBR}`,
    `Descrição: ${f.description}`,
  ].join("\n");
}
