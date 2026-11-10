"use client";

import { useEffect, useRef } from "react";
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, List } from "lucide-react";
import { comoHtml } from "@/lib/textoRico";

/**
 * A BARRA DE FORMATAÇÃO dos documentos (doc 63) e os campos que ela formata.
 *
 * "Ao selecionar o texto do título ou do texto e alterar uma das opções o mesmo deverá ser
 * alterado" — então a barra é UMA só e vale para os dois campos: ela age sobre a seleção que o
 * navegador tem no momento, seja no nome do documento, seja no corpo.
 *
 * Os comandos são os do `document.execCommand`. Ele está marcado como obsoleto há anos e segue
 * sendo a única forma de aplicar formatação à seleção que funciona em todos os navegadores que
 * esta terapeuta usa; o substituto (Editing Host API) não existe fora do Chrome. Quando ele cair,
 * o lugar de trocar é só este.
 */

const FONTES = [
  { valor: "", rotulo: "Fonte do documento" },
  { valor: "Arial, Helvetica, sans-serif", rotulo: "Arial" },
  { valor: "Georgia, serif", rotulo: "Georgia" },
  { valor: "'Times New Roman', Times, serif", rotulo: "Times New Roman" },
  { valor: "'Courier New', Courier, monospace", rotulo: "Courier New" },
  { valor: "Verdana, Geneva, sans-serif", rotulo: "Verdana" },
];

// O `fontSize` do execCommand trabalha numa escala de 1 a 7; com `styleWithCSS` ligado ele grava
// a palavra equivalente em `font-size`, que é CSS legítimo e imprime igual.
const TAMANHOS = [
  { valor: "", rotulo: "Tamanho" },
  { valor: "2", rotulo: "Pequeno" },
  { valor: "3", rotulo: "Normal" },
  { valor: "5", rotulo: "Grande" },
  { valor: "6", rotulo: "Maior" },
];

const CORES = [
  { valor: "#000000", rotulo: "Preto" },
  { valor: "#dc2626", rotulo: "Vermelho" },
  { valor: "#1d4ed8", rotulo: "Azul" },
];

const ALINHAMENTOS = [
  { comando: "justifyLeft", rotulo: "Alinhar à esquerda", Icone: AlignLeft },
  { comando: "justifyCenter", rotulo: "Centralizar", Icone: AlignCenter },
  { comando: "justifyRight", rotulo: "Alinhar à direita", Icone: AlignRight },
  { comando: "justifyFull", rotulo: "Justificar", Icone: AlignJustify },
];

const botaoCls =
  "inline-flex items-center justify-center w-9 h-9 rounded-lg text-foreground/60 hover:bg-primary/10 hover:text-primary transition cursor-pointer";
const selectCls =
  "h-9 rounded-lg border border-border bg-white/70 px-2 text-xs font-medium text-foreground/70 outline-none focus:border-accent cursor-pointer";

export function BarraDeFormatacao() {
  // `styleWithCSS` faz o navegador gravar `style="…"` em vez das tags antigas (<font>): é o que a
  // faxina do servidor sabe guardar, e o que a impressão sabe respeitar.
  useEffect(() => {
    try { document.execCommand("styleWithCSS", false, "true"); } catch { /* navegador sem suporte */ }
  }, []);

  // O comando dispara `input` no campo editável, e é ele que devolve o HTML novo ao estado; e
  // sair do campo para clicar em Salvar também sincroniza. Nada a avisar daqui.
  function aplicar(comando: string, valor?: string) {
    try { document.execCommand(comando, false, valor); } catch { /* seleção perdida */ }
  }

  return (
    // `onMouseDown` com `preventDefault` em toda a barra: sem isso, clicar nela tira o foco do
    // campo, a seleção some e o comando não acha o que formatar.
    <div
      onMouseDown={(e) => e.preventDefault()}
      className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface/60 px-2 py-1.5 print:hidden"
    >
      <select
        aria-label="Tipo de fonte"
        defaultValue=""
        onChange={(e) => { if (e.target.value) aplicar("fontName", e.target.value); e.target.value = ""; }}
        className={selectCls}
      >
        {FONTES.map((f) => <option key={f.rotulo} value={f.valor}>{f.rotulo}</option>)}
      </select>

      <select
        aria-label="Tamanho da fonte"
        defaultValue=""
        onChange={(e) => { if (e.target.value) aplicar("fontSize", e.target.value); e.target.value = ""; }}
        className={selectCls}
      >
        {TAMANHOS.map((t) => <option key={t.rotulo} value={t.valor}>{t.rotulo}</option>)}
      </select>

      <span className="flex items-center gap-1 px-1">
        {CORES.map((c) => (
          <button
            key={c.valor}
            type="button"
            title={c.rotulo}
            aria-label={`Cor ${c.rotulo.toLowerCase()}`}
            onClick={() => aplicar("foreColor", c.valor)}
            className="w-6 h-6 rounded-full border border-border cursor-pointer"
            style={{ backgroundColor: c.valor }}
          />
        ))}
      </span>

      {ALINHAMENTOS.map(({ comando, rotulo, Icone }) => (
        <button key={comando} type="button" title={rotulo} aria-label={rotulo} onClick={() => aplicar(comando)} className={botaoCls}>
          <Icone className="w-4 h-4" />
        </button>
      ))}

      <button type="button" title="Marcadores" aria-label="Marcadores" onClick={() => aplicar("insertUnorderedList")} className={botaoCls}>
        <List className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * O CAMPO que a barra formata: um campo editável que guarda HTML.
 *
 * É NÃO CONTROLADO de propósito. Reescrever o `innerHTML` a cada tecla jogaria o cursor para o
 * começo do campo a cada letra; então o conteúdo inicial entra uma vez e, dali em diante, quem
 * manda no campo é o navegador. Para trocar o conteúdo de fora (editar outro documento, gerar o
 * relatório) o pai troca a `key` — remontar é o jeito de o campo aceitar texto novo
 * ([[licao-navegar-nao-remonta]]).
 *
 * Colar entra como TEXTO PURO: a formatação do documento é a que a barra aplica, não a da página
 * de onde o texto veio — e assim nenhuma marcação estranha chega ao campo.
 */
export function CampoRico({
  htmlInicial,
  aoMudar,
  placeholder,
  minAltura,
  className = "",
}: {
  htmlInicial: string;
  aoMudar: (html: string) => void;
  placeholder: string;
  minAltura: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={placeholder}
      data-placeholder={placeholder}
      onInput={() => aoMudar(ref.current?.innerHTML ?? "")}
      onBlur={() => aoMudar(ref.current?.innerHTML ?? "")}
      onPaste={(e) => {
        e.preventDefault();
        const texto = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, texto);
      }}
      dangerouslySetInnerHTML={{ __html: comoHtml(htmlInicial) }}
      className={`campo-rico w-full px-4 py-3 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm overflow-auto ${className}`}
      style={{ minHeight: minAltura }}
    />
  );
}
