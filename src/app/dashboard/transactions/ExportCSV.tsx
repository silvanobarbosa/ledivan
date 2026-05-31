"use client";

import { Download } from "lucide-react";

type Row = {
  date: string;
  description: string;
  category: string;
  type: string;
  source: string;
  amount: string;
};

function csvEscape(v: string) {
  if (/[",\n;]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function ExportCSV({ rows }: { rows: Row[] }) {
  const download = () => {
    const header = ["Data", "Descrição", "Categoria", "Tipo", "Origem", "Valor"];
    const lines = rows.map((r) =>
      [r.date, r.description, r.category, r.type, r.source, r.amount].map(csvEscape).join(";")
    );
    const csv = [header.join(";"), ...lines].join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transacoes-ledivan.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={download}
      disabled={rows.length === 0}
      className="flex items-center gap-2 bg-white border border-border text-foreground/70 px-5 py-3 rounded-2xl font-bold hover:border-primary hover:text-primary transition disabled:opacity-40"
    >
      <Download className="w-5 h-5" /> <span>CSV</span>
    </button>
  );
}
