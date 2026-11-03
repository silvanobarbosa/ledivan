/**
 * O QUE FAZER, DEPENDENDO DO QUE O MUNICÍPIO RESPONDEU (doc 76).
 *
 * O documento pede que o app apresente "uma alternativa oficial" quando não houver integração —
 * e proíbe simular emissão. Então a consulta não termina num sim/não: termina num ROTEIRO, que é
 * o que a terapeuta (ou a contadora dela) consegue executar.
 *
 * Os roteiros dizem o que é PASSO DELA e o que é PASSO DA CONTADORA, porque metade disso é
 * decisão tributária e não configuração de software — e porque o dono pediu que ela possa levar
 * isto para a contadora resolver.
 *
 * Nada aqui afirma obrigação fiscal. O app não sabe o regime dela, e dizer "você é obrigada a"
 * seria uma afirmação que o Ledivan não tem como sustentar. O texto diz o que é preciso PARA
 * EMITIR, e manda confirmar com a contadora o que é preciso NO CASO DELA.
 *
 * Funções puras — o texto é dado, não tela.
 */

import type { SituacaoDoMunicipio } from "./municipioNfse";

export type Passo = {
  titulo: string;
  detalhe: string;
  /** Quem resolve: a profissional, a contadora, ou a prefeitura. */
  quem: "voce" | "contadora" | "prefeitura";
  /** Link oficial, quando existe. Nunca link de intermediário. */
  link?: { texto: string; url: string };
};

export type Tutorial = {
  /** O veredito em uma frase, sem rodeio. */
  resumo: string;
  /** O que o Ledivan consegue fazer neste cenário — dito antes de pedir qualquer configuração. */
  oQueOLedivanFaz: string;
  passos: Passo[];
};

const GOV_NFSE = { texto: "Portal Nacional da NFS-e", url: "https://www.nfse.gov.br/EmissorNacional" };
const GOV_CADASTRO = { texto: "Cadastro no Emissor Nacional", url: "https://www.nfse.gov.br/EmissorNacional/Contribuinte" };
const GOV_BR = { texto: "Conta gov.br (nível prata ou ouro)", url: "https://www.gov.br/governodigital/pt-br/identidade/conta-gov-br" };
const RECEITA_SAUDE = { texto: "Receita Saúde (app Receita Federal)", url: "https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/receita-saude" };
const LISTA_MUNICIPIOS = { texto: "Lista oficial de municípios aderentes", url: "https://www.gov.br/nfse/pt-br/municipios-aderentes/municipios-aderentes" };

/** O passo que vale em TODO cenário: a identidade digital é a porta de entrada de tudo. */
const CONTA_GOVBR: Passo = {
  titulo: "Tenha a conta gov.br no nível prata ou ouro",
  detalhe:
    "É a porta de entrada do Portal Nacional. Nível bronze não abre a emissão. Dá para subir de nível pelo aplicativo gov.br, por banco credenciado ou com o aplicativo de biometria.",
  quem: "voce",
  link: GOV_BR,
};

const FALE_COM_A_CONTADORA: Passo = {
  titulo: "Confirme com a sua contadora o que vale para você",
  detalhe:
    "Se você atende como pessoa física, a emissão de NFS-e depende de regra do seu município e da sua situação cadastral — e nem toda profissional precisa emitir. Quem responde isso é a contabilidade, não o aplicativo. Leve esta tela para a conversa: ela já diz em que situação o seu município está.",
  quem: "contadora",
};

const RECEITA_SAUDE_PASSO: Passo = {
  titulo: "Atendimento a paciente pessoa física: confira o Receita Saúde",
  detalhe:
    "Para profissionais de saúde que atendem pessoas físicas, o recibo eletrônico do Receita Saúde é emitido no aplicativo da Receita Federal e alimenta o Imposto de Renda do paciente. Ele é independente da NFS-e e não substitui nem é substituído por ela. O Ledivan já tem a tela Receita Saúde, com os campos prontos para copiar.",
  quem: "voce",
  link: RECEITA_SAUDE,
};

export function tutorialDoMunicipio(situacao: SituacaoDoMunicipio, nomeDoMunicipio?: string | null): Tutorial {
  const onde = nomeDoMunicipio ? `em ${nomeDoMunicipio}` : "no seu município";

  if (situacao === "emissor_nacional") {
    return {
      resumo: `A emissão pelo Emissor Nacional está disponível ${onde}.`,
      oQueOLedivanFaz:
        "O Ledivan pode preparar os dados da nota a partir do atendimento — paciente, data, valor e descrição do serviço — para você conferir antes de emitir. A emissão em si acontece no Portal Nacional, com o seu acesso; o Ledivan nunca emite por conta própria nem simula uma nota.",
      passos: [
        CONTA_GOVBR,
        {
          titulo: "Faça o cadastro como contribuinte no Emissor Nacional",
          detalhe:
            "No Portal Nacional, entre com a conta gov.br e conclua o cadastro do contribuinte. É nele que o sistema confere se você está apta a emitir no seu município.",
          quem: "voce",
          link: GOV_CADASTRO,
        },
        {
          titulo: "Verifique a inscrição municipal",
          detalhe:
            "Muitos municípios exigem inscrição municipal do prestador e recusam a nota sem ela. Isso se resolve na prefeitura, não no portal. Se você atende como autônoma, pergunte se existe cadastro de prestador pessoa física.",
          quem: "prefeitura",
        },
        FALE_COM_A_CONTADORA,
        RECEITA_SAUDE_PASSO,
      ],
    };
  }

  if (situacao === "so_ambiente") {
    return {
      resumo: `${nomeDoMunicipio ?? "O município"} participa do ambiente nacional, mas a emissão continua pelo sistema da prefeitura.`,
      oQueOLedivanFaz:
        "O Ledivan pode preparar os dados do atendimento para você copiar no sistema da prefeitura. Não existe caminho nacional de emissão aqui, e o Ledivan não vai fingir que existe.",
      passos: [
        {
          titulo: "Emita pelo sistema da sua prefeitura",
          detalhe:
            "O município manda os dados para o ambiente nacional, mas não aderiu ao Emissor Nacional. Na prática, a nota sai pelo sistema municipal — normalmente no site da prefeitura, com senha própria ou certificado digital.",
          quem: "prefeitura",
        },
        {
          titulo: "Acompanhe a lista oficial",
          detalhe:
            "Municípios entram no Emissor Nacional todo mês, e vários já têm data de início marcada para o futuro. Vale reconferir de tempos em tempos.",
          quem: "voce",
          link: LISTA_MUNICIPIOS,
        },
        FALE_COM_A_CONTADORA,
        RECEITA_SAUDE_PASSO,
      ],
    };
  }

  if (situacao === "fora") {
    return {
      resumo: `${nomeDoMunicipio ?? "O município"} não está no sistema nacional da NFS-e hoje.`,
      oQueOLedivanFaz:
        "Nada de emissão por aqui — não há caminho nacional disponível. O Ledivan continua emitindo recibo simples e preparando os dados do atendimento.",
      passos: [
        {
          titulo: "Procure o sistema de NFS-e da sua prefeitura",
          detalhe:
            "Cada município tem o seu. Pergunte na prefeitura, ou à contadora, qual é o sistema e o que é preciso para se cadastrar como prestadora.",
          quem: "prefeitura",
        },
        FALE_COM_A_CONTADORA,
        RECEITA_SAUDE_PASSO,
      ],
    };
  }

  return {
    resumo: "Não encontrei esse município na lista oficial.",
    oQueOLedivanFaz:
      "Sem saber o município, o Ledivan não tem como dizer qual caminho de emissão existe — e preferimos não dizer nada a dizer algo errado sobre nota fiscal.",
    passos: [
      {
        titulo: "Confira o nome e o estado",
        detalhe:
          "Escolha o estado primeiro e procure o município na lista. A grafia oficial às vezes difere da usual.",
        quem: "voce",
      },
      {
        titulo: "Consulte a lista oficial direto na fonte",
        detalhe:
          "A relação completa fica no portal do gov.br e é atualizada mensalmente.",
        quem: "voce",
        link: LISTA_MUNICIPIOS,
      },
      FALE_COM_A_CONTADORA,
    ],
  };
}

/** O que a contadora precisa receber para configurar, em uma lista só. */
export const PARA_A_CONTADORA: { campo: string; porque: string }[] = [
  { campo: "Nome completo e CPF", porque: "Identificam a prestadora na nota." },
  { campo: "CNPJ técnico, se houver", porque: "Algumas situações de pessoa física passam a exigir inscrição própria no CNPJ. Não é CNPJ de MEI nem de empresa, e o Ledivan não trata como tal." },
  { campo: "Município de atuação", porque: "Define qual caminho de emissão existe — é o que esta tela consulta." },
  { campo: "Inscrição municipal, se o município exigir", porque: "Sem ela, a nota é recusada nos municípios que a cadastram." },
  { campo: "Endereço fiscal", porque: "Vai impresso na nota." },
  { campo: "Código do serviço prestado", porque: "Define a tributação. É escolha da contabilidade, não do aplicativo." },
  { campo: "Regime tributário e retenções aplicáveis", porque: "Muda o valor líquido e as informações tributárias da nota." },
];

export { GOV_NFSE, LISTA_MUNICIPIOS, RECEITA_SAUDE };
