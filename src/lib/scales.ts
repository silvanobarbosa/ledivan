// Escalas de desfecho validadas (auto-aplicáveis). Pontuação e interpretação padrão.

export type ScaleType = "phq9" | "gad7";

export type Scale = {
  type: ScaleType;
  name: string;
  short: string;
  intro: string;
  items: string[];
  options: { value: number; label: string }[];
  max: number;
  severity: (score: number) => { label: string; tone: "ok" | "leve" | "alerta" | "grave" };
};

const OPTIONS = [
  { value: 0, label: "Nenhuma vez" },
  { value: 1, label: "Vários dias" },
  { value: 2, label: "Mais da metade dos dias" },
  { value: 3, label: "Quase todos os dias" },
];

export const SCALES: Record<ScaleType, Scale> = {
  phq9: {
    type: "phq9",
    name: "PHQ-9 (sintomas depressivos)",
    short: "PHQ-9",
    intro: "Durante as últimas 2 semanas, com que frequência você foi incomodado(a) por algum dos problemas abaixo?",
    items: [
      "Pouco interesse ou prazer em fazer as coisas",
      "Sentir-se para baixo, deprimido(a) ou sem perspectiva",
      "Dificuldade para pegar no sono, continuar dormindo ou dormir demais",
      "Sentir-se cansado(a) ou com pouca energia",
      "Falta de apetite ou comer demais",
      "Sentir-se mal consigo mesmo(a) — ou achar que é um fracasso ou que decepcionou a si ou a família",
      "Dificuldade para se concentrar (ex: ler, ver televisão)",
      "Lentidão para se mover/falar a ponto de outros notarem — ou o oposto, estar muito agitado(a)",
      "Pensar que seria melhor estar morto(a) ou se machucar de alguma forma",
    ],
    options: OPTIONS,
    max: 27,
    severity: (s) =>
      s >= 20 ? { label: "Grave", tone: "grave" }
      : s >= 15 ? { label: "Moderadamente grave", tone: "alerta" }
      : s >= 10 ? { label: "Moderada", tone: "alerta" }
      : s >= 5 ? { label: "Leve", tone: "leve" }
      : { label: "Mínima", tone: "ok" },
  },
  gad7: {
    type: "gad7",
    name: "GAD-7 (sintomas de ansiedade)",
    short: "GAD-7",
    intro: "Durante as últimas 2 semanas, com que frequência você foi incomodado(a) pelos problemas abaixo?",
    items: [
      "Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)",
      "Não conseguir parar ou controlar as preocupações",
      "Preocupar-se muito com diversas coisas",
      "Dificuldade para relaxar",
      "Ficar tão agitado(a) que se torna difícil permanecer parado(a)",
      "Ficar facilmente aborrecido(a) ou irritado(a)",
      "Sentir medo como se algo terrível fosse acontecer",
    ],
    options: OPTIONS,
    max: 21,
    severity: (s) =>
      s >= 15 ? { label: "Grave", tone: "grave" }
      : s >= 10 ? { label: "Moderada", tone: "alerta" }
      : s >= 5 ? { label: "Leve", tone: "leve" }
      : { label: "Mínima", tone: "ok" },
  },
};

export function severityColor(tone: "ok" | "leve" | "alerta" | "grave"): string {
  switch (tone) {
    case "ok": return "bg-[#ecfdf5] text-[#047857]";
    case "leve": return "bg-[#f3e8ff] text-primary";
    case "alerta": return "bg-[#fffbeb] text-[#b45309]";
    case "grave": return "bg-[#fee2e2] text-[#b91c1c]";
  }
}
