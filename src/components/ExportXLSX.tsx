"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";

/**
 * Botão "Exportar XLS" — gera um arquivo Excel de verdade (.xlsx), não um CSV renomeado.
 *
 * A biblioteca `xlsx` pesa ~400 KB e só serve a quem clica, então entra por **import
 * dinâmico**: o bundle da página continua do mesmo tamanho e o custo só aparece no clique.
 *
 * Quem chama passa exatamente o que está na tela (cabeçalho + linhas já formatados). É de
 * propósito: a planilha não recalcula nada, então ela nunca diverge da tabela que o usuário
 * está vendo — se a tela filtra ou esconde coluna, a planilha sai igual.
 */
export function ExportXLSX({
  cabecalho,
  linhas,
  nomeArquivo,
  aba = "Dados",
  titulo = "Exportar XLS",
  className,
}: {
  cabecalho: string[];
  linhas: (string | number)[][];
  nomeArquivo: string;
  aba?: string;
  titulo?: string;
  className?: string;
}) {
  const [ocupado, setOcupado] = useState(false);
  const vazio = linhas.length === 0 || cabecalho.length === 0;

  async function exportar() {
    if (vazio || ocupado) return;
    setOcupado(true);
    try {
      const XLSX = await import("xlsx");
      const dados = [cabecalho, ...linhas];
      const planilha = XLSX.utils.aoa_to_sheet(dados);

      // Largura por coluna pelo conteúdo mais longo — sem isso o Excel abre tudo em 8
      // caracteres e toda data/valor vira "####".
      planilha["!cols"] = cabecalho.map((titulo, i) => {
        const maior = Math.max(
          String(titulo).length,
          ...linhas.map((l) => String(l[i] ?? "").length),
        );
        return { wch: Math.min(48, Math.max(10, maior + 2)) };
      });

      const livro = XLSX.utils.book_new();
      // O Excel recusa aba com mais de 31 caracteres ou com : \ / ? * [ ]
      XLSX.utils.book_append_sheet(livro, planilha, aba.replace(/[:\\/?*[\]]/g, "-").slice(0, 31));

      const hoje = new Date();
      const carimbo = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
      XLSX.writeFile(livro, `${nomeArquivo}-${carimbo}.xlsx`);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={vazio || ocupado}
      title={vazio ? "Nada para exportar neste recorte" : titulo}
      className={
        className ??
        "inline-flex items-center gap-2 text-sm font-semibold text-primary border border-border rounded-xl px-4 py-2 hover:bg-surface cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition"
      }
    >
      {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
      {ocupado ? "Gerando…" : titulo}
    </button>
  );
}
