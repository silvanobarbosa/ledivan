import fc from "fast-check";

/**
 * GERADORES QUE PARECEM COM A PRODUÇÃO.
 *
 * Existem por causa de um bug que custou dois consertos (02/11/2026): a dica mandada ao Whisper
 * estourava o teto do provedor, e os oito testes dela passavam verdes. Usavam
 * `"Paciente 00 xxxx"` — ASCII puro, em que byte e caractere são a mesma coisa. A produção é um
 * app de terapeuta brasileira: "Thaís", "Conceição", "João Víctor". **Teste sem acento não testa
 * um app em português.**
 *
 * A lição mais geral: quando EU escolho os exemplos, escolho os que já tenho na cabeça — e o bug
 * mora justamente no exemplo que não me ocorreu. Estes geradores tiram essa escolha de mim.
 *
 * Use-os em qualquer teste de LIMITE (tamanho, corte, truncagem, formatação).
 */

/** Pedaços de nome real de gente brasileira, com tudo que o teclado daqui produz. */
const PRENOMES = [
  "Ana", "João", "Thaís", "Conceição", "Luís", "Mônica", "Agnès", "Cauã", "Íris", "Estêvão",
  "Maria", "José", "Vitória", "Gonçalo", "Ângela", "Raíssa", "Benício", "Heloísa", "Otávio",
];
const SOBRENOMES = [
  "Gonçalves", "Assunção", "Nóbrega", "Façanha", "Lins D'Ávila", "de Camões", "Sá", "Müller",
  "Paixão", "Xavier", "D'Angelo", "São Paulo", "Araújo", "Çelik", "Nascimento-Júnior",
];

/**
 * Um nome de paciente como os que existem no banco.
 *
 * Inclui de propósito: acento (2 bytes), cedilha, apóstrofo, hífen, espaço, e nomes de uma
 * palavra só — porque a produção tem todos, e cada um já quebrou alguma coisa em algum app.
 */
export const nomeBrasileiro = (): fc.Arbitrary<string> =>
  fc.oneof(
    fc.constantFrom(...PRENOMES),
    fc
      .tuple(fc.constantFrom(...PRENOMES), fc.constantFrom(...SOBRENOMES))
      .map(([a, b]) => `${a} ${b}`),
    fc
      .tuple(fc.constantFrom(...PRENOMES), fc.constantFrom(...PRENOMES), fc.constantFrom(...SOBRENOMES))
      .map(([a, b, c]) => `${a} ${b} ${c}`),
  );

/** A lista de pacientes de uma terapeuta: de vazia a maior do que qualquer agenda real. */
export const listaDePacientes = (max = 70): fc.Arbitrary<string[]> =>
  fc.array(nomeBrasileiro(), { minLength: 0, maxLength: max });

/**
 * Texto hostil de propósito: emoji (4 bytes, par substituto), acento combinante, caractere de
 * largura zero, espaço não-quebrável. Nada disso é exótico — tudo entra por copiar e colar de
 * WhatsApp, que é de onde a terapeuta copia nome de paciente.
 */
export const textoHostil = (): fc.Arbitrary<string> =>
  fc.stringMatching(/^[a-zA-ZÀ-ÿ]{0,8}$/).chain((base) =>
    fc.constantFrom("🙂", "👩‍⚕️", "é", "​", " ", "ç", "ã", "", "—").map((s) => base + s),
  );

/** Uma string qualquer montada de pedaços hostis — para testar corte e truncagem. */
export const textoHostilLongo = (maxPedacos = 60): fc.Arbitrary<string> =>
  fc.array(textoHostil(), { minLength: 1, maxLength: maxPedacos }).map((p) => p.join(" "));
