"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, X } from "lucide-react";
import { bloquearHorarios, desbloquearHorarios, horariosDoDia } from "@/app/dashboard/agenda/bloqueio-actions";
import { TEXTO_PADRAO_DO_BLOQUEIO } from "@/lib/bloqueioDeHorario";
import { FUNDO_DA_JANELA, JANELA } from "@/lib/modal";

/**
 * A janela de bloquear e desbloquear horário.
 *
 * Escolhe-se a data, e só então os horários aparecem — a lista depende do dia, e mostrá-la antes
 * seria mostrar uma lista errada. Os que já têm paciente não entram: bloquear em cima de alguém
 * não é coisa que se queira fazer sem perceber, e oferecer a opção seria convidar ao engano.
 *
 * O texto ao lado de cada horário é opcional. Em branco, a agenda escreve "HORÁRIO BLOQUEADO";
 * preenchido, escreve o que foi digitado, e a semana passa a se explicar sozinha.
 */

type Livre = { inicio: number; rotulo: string };
type Bloqueado = { id: string; rotulo: string; note: string | null };

const hojeISO = () => {
  const d = new Date();
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
};

export function BloquearHorario() {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hojeISO);
  const [livres, setLivres] = useState<Livre[]>([]);
  const [bloqueados, setBloqueados] = useState<Bloqueado[]>([]);
  const [marcados, setMarcados] = useState<Record<number, boolean>>({});
  const [notas, setNotas] = useState<Record<number, string>>({});
  const [paraLiberar, setParaLiberar] = useState<Record<string, boolean>>({});
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, comecar] = useTransition();
  const router = useRouter();

  async function carregar(dia: string) {
    setCarregando(true);
    setErro(null);
    setMarcados({});
    setParaLiberar({});
    const r = await horariosDoDia(dia);
    setLivres(r.livres);
    setBloqueados(r.bloqueados);
    setCarregando(false);
  }

  function abrir() {
    setAberto(true);
    void carregar(data);
  }

  const algumMarcado = Object.values(marcados).some(Boolean);
  const algumParaLiberar = Object.values(paraLiberar).some(Boolean);

  function bloquear() {
    const escolhidos = livres
      .filter((h) => marcados[h.inicio])
      .map((h) => ({ inicio: h.inicio, nota: notas[h.inicio] ?? "" }));
    comecar(async () => {
      const r = await bloquearHorarios(data, escolhidos);
      if (!r.ok) return setErro(r.error ?? "Não consegui bloquear.");
      await carregar(data);
      router.refresh();
    });
  }

  function liberar() {
    const ids = bloqueados.filter((b) => paraLiberar[b.id]).map((b) => b.id);
    comecar(async () => {
      const r = await desbloquearHorarios(ids);
      if (!r.ok) return setErro(r.error ?? "Não consegui desbloquear.");
      await carregar(data);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition"
      >
        <Lock className="w-3.5 h-3.5" aria-hidden="true" />
        Bloquear horário
      </button>

      {aberto && (
        <div className={FUNDO_DA_JANELA} onClick={() => setAberto(false)}>
          <div
            className={`${JANELA} max-w-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-display font-bold text-primary">Bloquear horário</p>
                <p className="text-xs text-foreground/50">Supervisão, curso, médico — o que tira o horário do ar sem ser paciente.</p>
              </div>
              <button onClick={() => setAberto(false)} className="p-1.5 rounded-lg hover:bg-surface transition" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-foreground/40">Data</span>
              <input
                type="date"
                value={data}
                onChange={(e) => {
                  setData(e.target.value);
                  void carregar(e.target.value);
                }}
                className="mt-1 w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm"
              />
            </label>

            {carregando && <p className="text-sm text-foreground/50">Vendo o que está livre…</p>}

            {!carregando && bloqueados.length > 0 && (
              <section className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-foreground/40">Já bloqueados</p>
                {bloqueados.map((b) => (
                  <label key={b.id} className="flex items-center gap-2 rounded-xl bg-foreground/5 px-3 py-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!paraLiberar[b.id]}
                      onChange={(e) => setParaLiberar((p) => ({ ...p, [b.id]: e.target.checked }))}
                    />
                    <span className="font-semibold tabular-nums">{b.rotulo}</span>
                    <span className="truncate text-foreground/60">{b.note || TEXTO_PADRAO_DO_BLOQUEIO}</span>
                  </label>
                ))}
                <button
                  type="button"
                  disabled={!algumParaLiberar || pendente}
                  onClick={liberar}
                  className="w-full py-2 rounded-xl text-sm font-bold bg-surface text-foreground/70 hover:bg-surface-container disabled:opacity-50"
                >
                  Desbloquear os marcados
                </button>
              </section>
            )}

            {!carregando && (
              <section className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-foreground/40">Horários livres</p>
                {livres.length === 0 ? (
                  <p className="text-sm text-foreground/50">Nenhum horário livre neste dia.</p>
                ) : (
                  livres.map((h) => (
                    <div key={h.inicio} className="flex items-center gap-2">
                      <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!marcados[h.inicio]}
                          onChange={(e) => setMarcados((p) => ({ ...p, [h.inicio]: e.target.checked }))}
                        />
                        <span className="text-sm font-semibold tabular-nums w-12">{h.rotulo}</span>
                      </label>
                      <input
                        type="text"
                        value={notas[h.inicio] ?? ""}
                        onChange={(e) => setNotas((p) => ({ ...p, [h.inicio]: e.target.value }))}
                        placeholder={TEXTO_PADRAO_DO_BLOQUEIO}
                        aria-label={`Motivo do bloqueio das ${h.rotulo}`}
                        className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-surface border border-border outline-none text-sm"
                      />
                    </div>
                  ))
                )}
              </section>
            )}

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <button
              type="button"
              disabled={!algumMarcado || pendente}
              onClick={bloquear}
              className="w-full rounded-xl bg-primary text-white py-2.5 text-sm font-bold disabled:opacity-50"
            >
              Bloquear os marcados
            </button>
          </div>
        </div>
      )}
    </>
  );
}
