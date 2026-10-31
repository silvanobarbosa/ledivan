import { describe, it, expect } from "vitest";
import { comandoDaFala } from "@/lib/falaDoDiva";
import { pacienteDaFala } from "@/lib/pacienteDaFala";
import { quandoDaFala } from "@/lib/quandoDaFala";
import { tarefaDaFala } from "@/lib/diva";

describe("a fala que AGE — recortar o pedido", () => {
  it("entende os três verbos como ela fala", () => {
    expect(comandoDaFala("anota na Marcela: dormiu melhor")?.acao).toBe("anotar");
    expect(comandoDaFala("marca a Thais quinta às 16h")?.acao).toBe("reservar");
    expect(comandoDaFala("cancela a sessão da Eloá de amanhã")?.acao).toBe("cancelar");
  });

  it("DESMARCAR nunca vira MARCAR — é o erro mais caro desta lista", () => {
    for (const fala of ["desmarca a Marcela", "desmarcar a sessão da Thais", "desmarcar o atendimento de amanhã"]) {
      expect(comandoDaFala(fala)?.acao, fala).toBe("cancelar");
    }
  });

  it("tira os enfeites do começo", () => {
    expect(comandoDaFala("por favor, marca a Thais quinta 16h")?.acao).toBe("reservar");
    expect(comandoDaFala("eu quero anotar na Marcela: ok")?.acao).toBe("anotar");
    expect(comandoDaFala("preciso cancelar a sessão da Eloá")?.acao).toBe("cancelar");
  });

  it("separa o conteúdo da anotação do nome", () => {
    const c = comandoDaFala("anota na Marcela Damaceno: relatou melhora do sono");
    expect(c?.alvo).toBe("marcela damaceno");
    expect(c?.resto).toBe("relatou melhora do sono");
  });

  it("sem separador, a anotação fica SEM conteúdo — a tela pede, em vez de cortar o nome no chute", () => {
    const c = comandoDaFala("anota na Marcela dormiu melhor");
    expect(c?.acao).toBe("anotar");
    expect(c?.resto).toBe("");
  });

  it("uma pergunta de navegação não vira comando", () => {
    for (const fala of ["quem está devendo?", "me mostra a agenda de hoje", "quanto recebi este mês"]) {
      expect(comandoDaFala(fala), fala).toBeNull();
    }
    // E o catálogo de navegação continua respondendo por elas.
    expect(tarefaDaFala("quem está devendo?")?.id).toBe("devendo");
  });

  it("frase vazia ou sem verbo nenhum não inventa ação", () => {
    for (const fala of ["", "   ", "bom dia", "obrigada"]) expect(comandoDaFala(fala)).toBeNull();
  });
});

describe("a fala que AGE — achar o paciente", () => {
  // A base real da Gisele, com as colisões medidas em 31/10.
  const PACIENTES = [
    { id: "1", nome: "Thais Alves" },
    { id: "2", nome: "Thais Duarte" },
    { id: "3", nome: "Eloá Barros de Castro" },
    { id: "4", nome: "Eloah Freitas Barros" },
    { id: "5", nome: "Marcela Damaceno" },
    { id: "6", nome: "Fernanda Jakomulsky" },
    { id: "7", nome: "Fernanda Souza Maia" },
  ];

  it("nome único resolve de primeira", () => {
    const r = pacienteDaFala("marcela", PACIENTES);
    expect(r.tipo).toBe("um");
    if (r.tipo === "um") expect(r.paciente.nome).toBe("Marcela Damaceno");
  });

  it("primeiro nome repetido NÃO escolhe sozinho — pergunta", () => {
    const r = pacienteDaFala("thais", PACIENTES);
    expect(r.tipo).toBe("varios");
    if (r.tipo === "varios") expect(r.candidatos.map((c) => c.nome).sort()).toEqual(["Thais Alves", "Thais Duarte"]);
  });

  it("com o sobrenome, desempata", () => {
    const r = pacienteDaFala("thais duarte", PACIENTES);
    expect(r.tipo).toBe("um");
    if (r.tipo === "um") expect(r.paciente.nome).toBe("Thais Duarte");
  });

  it("Eloá × Eloah: homófonas, então SEMPRE pergunta — nenhuma transcrição separa as duas", () => {
    const r = pacienteDaFala("eloa", PACIENTES);
    expect(r.tipo).toBe("varios");
    if (r.tipo === "varios") expect(r.candidatos.length).toBe(2);
  });

  it("aguenta o acento perdido e uma letra errada na transcrição", () => {
    const a = pacienteDaFala("marcella", PACIENTES); // o Whisper dobrando o L
    expect(a.tipo).toBe("um");
    const b = pacienteDaFala("MARCELA", PACIENTES);
    expect(b.tipo).toBe("um");
  });

  it("ignora 'a', 'da', 'paciente' — são enfeite, não nome", () => {
    const r = pacienteDaFala("a paciente marcela", PACIENTES);
    expect(r.tipo).toBe("um");
  });

  it("nome que não existe não vira o paciente mais parecido", () => {
    expect(pacienteDaFala("joaquina", PACIENTES).tipo).toBe("nenhum");
    expect(pacienteDaFala("", PACIENTES).tipo).toBe("nenhum");
  });
});

describe("a fala que AGE — entender o quando", () => {
  // Uma quarta-feira, 11:00.
  const AGORA = new Date(2026, 10, 4, 11, 0, 0);
  const q = (fala: string) => quandoDaFala(fala, AGORA);

  it("amanhã às 16h", () => {
    const r = q("amanhã às 16h");
    expect(r?.quando.getDate()).toBe(5);
    expect(r?.quando.getHours()).toBe(16);
    expect(r?.porExtenso).toContain("05/11");
  });

  it("o dia da semana é sempre o PRÓXIMO que ainda não chegou", () => {
    const r = q("sexta às 10h"); // quarta 04 → sexta 06
    expect(r?.quando.getDate()).toBe(6);
    expect(r?.quando.getHours()).toBe(10);
  });

  it("'na próxima quinta' pula a desta semana", () => {
    expect(q("quinta às 9h")?.quando.getDate()).toBe(5);
    expect(q("na próxima quinta às 9h")?.quando.getDate()).toBe(12);
  });

  it("dia e mês, por número ou por nome", () => {
    expect(q("dia 20 às 14h")?.quando.getDate()).toBe(20);
    expect(q("dia 5 de dezembro às 8h da manhã")?.quando.getMonth()).toBe(11);
    expect(q("20/12 às 15h")?.quando.getMonth()).toBe(11);
  });

  it("hora com minuto, e meio-dia", () => {
    expect(q("amanhã às 16:30")?.quando.getMinutes()).toBe(30);
    expect(q("amanhã 16h30")?.quando.getMinutes()).toBe(30);
    expect(q("amanhã ao meio-dia")?.quando.getHours()).toBe(12);
  });

  it("'às 4' num consultório é 16h — mas 'às 8 da manhã' é 8h", () => {
    expect(q("amanhã às 4")?.quando.getHours()).toBe(16);
    expect(q("amanhã às 8 da manhã")?.quando.getHours()).toBe(8);
  });

  it("SEM hora não há data: horário presumido é sessão na hora errada", () => {
    expect(q("amanhã")).toBeNull();
    expect(q("quinta")).toBeNull();
  });

  it("o que não entende vira null — a tela pergunta em vez de chutar", () => {
    for (const fala of ["", "qualquer hora", "semana que vem", "às 99h de amanhã"]) {
      expect(q(fala), fala).toBeNull();
    }
  });

  it("devolve por extenso o que entendeu, para ela conferir antes de confirmar", () => {
    expect(q("quinta às 16h")?.porExtenso).toBe("quinta-feira, 05/11, às 16h");
  });
});
