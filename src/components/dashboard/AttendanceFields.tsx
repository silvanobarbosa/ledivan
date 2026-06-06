"use client";

import { useState } from "react";
import { InfoTip } from "@/components/InfoTip";
import type { AttendanceLocation } from "@/lib/locations";

const inputCls =
  "w-full px-4 py-3 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition";
const labelCls = "block text-sm font-semibold text-foreground/70 mb-1.5";

// Modo de atendimento (online/presencial/misto) + endereço pré-selecionado.
export function AttendanceFields({
  locations,
  defaultMode = "presencial",
  defaultLocation = "",
}: {
  locations: AttendanceLocation[];
  defaultMode?: string;
  defaultLocation?: string | null;
}) {
  const [mode, setMode] = useState(defaultMode);
  const needsLocation = mode === "presencial" || mode === "misto";

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <label className={labelCls}>
          Modo de atendimento
          <InfoTip text="Online: por vídeo. Presencial: em um dos seus endereços. Misto: pode ser os dois." />
        </label>
        <select name="attendanceMode" className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="online">Online</option>
          <option value="presencial">Presencial</option>
          <option value="misto">Misto (online + presencial)</option>
        </select>
      </div>

      {needsLocation && (
        <div>
          <label className={labelCls}>
            Endereço do atendimento
            <InfoTip text="Local presencial padrão deste paciente. Ao confirmar uma sessão, ele aparece como sugestão." />
          </label>
          {locations.length === 0 ? (
            <p className="text-xs text-foreground/50 px-1 py-3">
              Nenhum endereço cadastrado. Adicione em <strong>Ajustes → Endereços de atendimento</strong>.
            </p>
          ) : (
            <select name="attendanceLocation" className={inputCls} defaultValue={defaultLocation || ""}>
              <option value="">Selecione…</option>
              {locations.map((l, i) => {
                const val = l.name ? `${l.name} — ${l.address}` : l.address;
                return <option key={i} value={val}>{val}</option>;
              })}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
