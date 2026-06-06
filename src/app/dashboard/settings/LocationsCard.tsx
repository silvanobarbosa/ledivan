"use client";

import { useState, useTransition } from "react";
import { MapPin, Check, Plus, Trash2 } from "lucide-react";
import { saveLocations } from "./actions";
import type { AttendanceLocation } from "@/lib/locations";

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

export function LocationsCard({ initial }: { initial: AttendanceLocation[] }) {
  const [locs, setLocs] = useState<AttendanceLocation[]>(initial.length ? initial : [{ name: "", address: "" }]);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function update(i: number, field: "name" | "address", v: string) {
    setLocs((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: v } : l)));
  }
  function add() {
    if (locs.length >= 3) return;
    setLocs((prev) => [...prev, { name: "", address: "" }]);
  }
  function remove(i: number) {
    setLocs((prev) => prev.filter((_, idx) => idx !== i));
  }
  function save() {
    setSaved(false);
    start(async () => {
      await saveLocations(locs);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div id="locais" className="scroll-mt-24 p-8 bg-white rounded-[48px] shadow-sm border border-border space-y-4">
      <h3 className="text-xl font-bold flex items-center gap-2">
        <MapPin className="w-5 h-5 text-primary" /> Endereços de atendimento presencial
      </h3>
      <p className="text-sm text-foreground/50 leading-relaxed">
        Cadastre até 3 locais. No cadastro do paciente (presencial/misto) você escolhe um deles, e ele aparece como sugestão ao confirmar a sessão.
      </p>

      <div className="space-y-3">
        {locs.map((l, i) => (
          <div key={i} className="grid sm:grid-cols-[1fr_2fr_auto] gap-2 items-start">
            <input value={l.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Apelido (ex: Sala 1)" className={inputCls} />
            <input value={l.address} onChange={(e) => update(i, "address", e.target.value)} placeholder="Endereço completo" className={inputCls} />
            <button type="button" onClick={() => remove(i)} className="p-2.5 text-red-400 hover:text-red-600 transition" title="Remover">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {locs.length < 3 && (
          <button type="button" onClick={add} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <Plus className="w-4 h-4" /> Adicionar endereço
          </button>
        )}
        <button onClick={save} disabled={pending} className="ml-auto inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm transition active:scale-[0.98] disabled:opacity-60">
          {saved ? <><Check className="w-4 h-4" /> Salvo</> : pending ? "Salvando…" : "Salvar locais"}
        </button>
      </div>
    </div>
  );
}
