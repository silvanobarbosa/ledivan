"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2 } from "lucide-react";
import { createRecord } from "../actions";

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

const FIELDS: { key: string; label: string; rows?: number }[] = [
  { key: "identificacao", label: "Identificação (idade, profissão, estado civil, com quem mora)", rows: 2 },
  { key: "queixa", label: "Queixa principal", rows: 2 },
  { key: "historia", label: "História da queixa atual", rows: 3 },
  { key: "pessoal", label: "Histórico pessoal / desenvolvimento", rows: 3 },
  { key: "familiar", label: "Histórico familiar", rows: 2 },
  { key: "medicacoes", label: "Medicações em uso", rows: 2 },
  { key: "tratamentos", label: "Tratamentos anteriores", rows: 2 },
  { key: "objetivos", label: "Objetivos do tratamento", rows: 2 },
];

export function AnamneseForm({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function submit() {
    const content = FIELDS
      .filter((f) => (vals[f.key] || "").trim())
      .map((f) => `**${f.label.split(" (")[0]}**\n${vals[f.key].trim()}`)
      .join("\n\n");
    if (!content) return;
    const fd = new FormData();
    fd.append("type", "anamnese");
    fd.append("title", "Anamnese");
    fd.append("content", content);
    startTransition(async () => {
      await createRecord(patientId, fd);
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="glass-card rounded-[24px] p-5 space-y-3">
      <p className="font-semibold text-primary flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Anamnese estruturada</p>
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="text-xs font-semibold text-foreground/60">{f.label}</label>
          <textarea
            rows={f.rows ?? 2}
            value={vals[f.key] ?? ""}
            onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
            className={inputCls}
          />
        </div>
      ))}
      <button onClick={submit} disabled={pending} className="inline-flex items-center gap-2 bg-primary text-white py-2.5 px-5 rounded-xl font-bold disabled:opacity-50">
        {pending ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : "Salvar anamnese no prontuário"}
      </button>
    </div>
  );
}
