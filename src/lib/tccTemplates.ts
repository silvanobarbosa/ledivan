// Modelos de tarefas terapêuticas (TCC) prontos para preencher a criação de tarefa.
export type TccTemplate = {
  key: string;
  label: string;
  title: string;
  responseType: "texto" | "foto" | "audio" | "video" | "livre";
  instructions: string;
};

export const TCC_TEMPLATES: TccTemplate[] = [
  {
    key: "rpd",
    label: "Registro de Pensamentos (RPD)",
    title: "Registro de Pensamentos Disfuncionais",
    responseType: "texto",
    instructions:
      "Quando notar uma emoção forte, registre:\n1) Situação (o que aconteceu?)\n2) Emoção (qual e intensidade 0–100%)\n3) Pensamento automático (o que passou pela cabeça?)\n4) Evidências a favor e contra esse pensamento\n5) Resposta alternativa mais equilibrada\n6) Como se sente agora (0–100%)",
  },
  {
    key: "gratidao",
    label: "Diário de gratidão",
    title: "Diário de gratidão (7 dias)",
    responseType: "texto",
    instructions:
      "Por 7 dias, ao fim do dia, escreva 3 coisas boas que aconteceram — por menores que sejam — e por que foram importantes para você.",
  },
  {
    key: "ativacao",
    label: "Ativação comportamental",
    title: "Registro de atividades e humor",
    responseType: "texto",
    instructions:
      "Anote suas atividades ao longo do dia e, em cada uma, o humor (0–10) e a sensação de prazer/realização. Vamos identificar o que melhora seu ânimo.",
  },
  {
    key: "respiracao",
    label: "Respiração / relaxamento",
    title: "Prática de respiração diafragmática",
    responseType: "audio",
    instructions:
      "Pratique a respiração diafragmática por 5 minutos, 1x ao dia. Se quiser, grave um áudio curto contando como se sentiu antes e depois.",
  },
  {
    key: "exposicao",
    label: "Exposição gradual",
    title: "Hierarquia de exposição",
    responseType: "texto",
    instructions:
      "Liste situações que você evita por medo/ansiedade e dê uma nota de desconforto (0–100). Vamos montar juntos uma escada do mais fácil ao mais difícil para enfrentar aos poucos.",
  },
  {
    key: "carta",
    label: "Carta para si mesmo(a)",
    title: "Carta de autocompaixão",
    responseType: "livre",
    instructions:
      "Escreva (ou grave um áudio) uma carta para você mesmo(a) como escreveria para um amigo querido que está passando por isso. Pode anexar foto se preferir escrever à mão.",
  },
  {
    key: "gatilhos",
    label: "Registro de gatilhos",
    title: "Mapa de gatilhos",
    responseType: "texto",
    instructions:
      "Quando sentir o sintoma (ansiedade, compulsão, etc.), anote: onde estava, com quem, o que veio antes (gatilho) e o que fez em seguida.",
  },
  {
    key: "sono",
    label: "Diário do sono",
    title: "Diário do sono (7 dias)",
    responseType: "texto",
    instructions:
      "Por 7 dias, registre: horário que deitou, tempo até dormir, despertares, horário que acordou e como se sentiu ao acordar (0–10).",
  },
];
