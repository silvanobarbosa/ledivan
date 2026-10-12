"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { AnamneseItem, type CampoAnamnese } from "./AnamneseItem";
import { createAnamnese } from "../actions";

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

/** Os campos do modelo padrão da anamnese. Convivem com os personalizados ("+Adicionar campo"). */
const CAMPOS_PADRAO = [
  "Identificação (idade, profissão, estado civil, com quem mora)",
  "Queixa principal",
  "História da queixa atual",
  "Histórico pessoal / desenvolvimento",
  "Histórico familiar",
  "Medicações em uso",
  "Tratamentos anteriores",
  "Objetivos do tratamento",
];

type Salvo = { id: string; title: string; content: string; custom: boolean; updatedAt: string | null };

export function AnamneseTab({ patientId, campos }: { patientId: string; campos: Salvo[] }) {
  const router = useRouter();
  const [adicionando, setAdicionando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const porTitulo = new Map(campos.filter((c) => !c.custom).map((c) => [c.title, c]));

  // Lista final: os campos padrão (salvos ou virtuais), depois os personalizados, em ordem de posição.
  const padrao: CampoAnamnese[] = CAMPOS_PADRAO.map((title) => {
    const s = porTitulo.get(title);
    return s
      ? { id: s.id, title, content: s.content, custom: false, updatedAt: s.updatedAt }
      : { id: null, title, content: "", custom: false, updatedAt: null };
  });
  const personalizados: CampoAnamnese[] = campos.filter((c) => c.custom).map((c) => ({ id: c.id, title: c.title, content: c.content, custom: true, updatedAt: c.updatedAt }));

  function adicionar() {
    setErro(null);
    if (!titulo.trim()) { setErro("Informe o título do campo."); return; }
    start(async () => {
      const r = await createAnamnese(patientId, titulo, conteudo, true);
      if (r.ok) { setTitulo(""); setConteudo(""); setAdicionando(false); router.refresh(); }
      else setErro(r.error ?? "Não deu para adicionar.");
    });
  }

  return (
    <div className="space-y-3">
      <p className="font-semibold text-primary flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Anamnese</p>
      <p className="text-xs text-foreground/50 -mt-1">Cada campo é salvo e editado por conta própria. Use &ldquo;Adicionar campo&rdquo; para incluir itens à medida do paciente.</p>

      {padrao.map((c) => <AnamneseItem key={`p:${c.title}`} patientId={patientId} campo={c} />)}
      {personalizados.map((c) => <AnamneseItem key={`c:${c.id}`} patientId={patientId} campo={c} />)}

      {adicionando ? (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título do campo" className={inputCls} autoFocus />
          <textarea rows={3} value={conteudo} onChange={(e) => setConteudo(e.target.value)} placeholder="Informações (opcional)" className={inputCls} />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={adicionar} disabled={pending} className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60 cursor-pointer">
              {pending ? "Adicionando…" : "Adicionar"}
            </button>
            <button type="button" onClick={() => { setAdicionando(false); setTitulo(""); setConteudo(""); setErro(null); }} className="text-foreground/50 text-sm px-2 cursor-pointer">Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdicionando(true)} className="inline-flex items-center gap-1.5 text-primary text-sm font-semibold hover:underline cursor-pointer">
          <Plus className="w-4 h-4" /> Adicionar campo
        </button>
      )}
    </div>
  );
}
