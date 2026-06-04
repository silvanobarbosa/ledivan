"use client";

import { useState } from "react";
import { InfoTip } from "@/components/InfoTip";

const inputCls =
  "w-full px-4 py-3 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition";
const labelCls = "block text-sm font-semibold text-foreground/70 mb-1.5";

// Tipo de contrato + (se "pacote") campo de quantidade de atendimentos.
export function ContractFields({
  defaultType = "avulso",
  defaultSessions,
}: {
  defaultType?: string;
  defaultSessions?: number | null;
}) {
  const [type, setType] = useState(defaultType);

  return (
    <>
      <div>
        <label className={labelCls}>
          Tipo de contrato
          <InfoTip text="Avulso: paga por sessão. Pacote: conjunto de sessões contratadas (informe a quantidade)." />
        </label>
        <select name="contractType" className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="avulso">Avulso</option>
          <option value="pacote">Pacote</option>
        </select>
      </div>
      {type === "pacote" && (
        <div>
          <label className={labelCls}>
            Atendimentos no pacote
            <InfoTip text="Quantos atendimentos esse pacote contém. A cada sessão cobrada, 1 crédito é descontado." />
          </label>
          <input
            name="sessionsInPacket"
            type="number"
            min={1}
            max={200}
            defaultValue={defaultSessions ?? ""}
            className={inputCls}
            placeholder="ex: 10"
          />
        </div>
      )}
    </>
  );
}
