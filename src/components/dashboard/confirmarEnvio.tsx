"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { abrirWhatsapp } from "@/lib/whatsappLink";

/**
 * Confirmar-no-retorno (doc 47): abrir o WhatsApp NÃO registra o envio. Depois de abrir, o app mostra
 * uma confirmação explícita ("Você enviou a mensagem?") e só no "Sim" é que a mensagem é registrada.
 *
 * Por que uma confirmação EXPLÍCITA logo após abrir, e não detectar o retorno do WhatsApp por foco: no
 * celular o foco volta quando se troca de app, mas no computador o WhatsApp abre numa ABA NOVA e a aba
 * do Le'Divan continua visível — o "retorno" não dispara de forma confiável. A confirmação explícita
 * funciona igual nos dois, e nunca conta sozinha (nunca valida o envio automaticamente).
 */
export function useConfirmarEnvio<T>() {
  const [pendente, setPendente] = useState<T | null>(null);
  // Doc 63: no computador a conversa abre pelo APLICATIVO (whatsapp://). Como o navegador não conta
  // se o esquema foi atendido, o endereço da web fica guardado e vira a saída da confirmação.
  const [web, setWeb] = useState<string | null>(null);

  /** Abre o WhatsApp (se houver número) e deixa a confirmação pendente — sem registrar nada ainda. */
  function abrir(url: string | null, token: T) {
    setWeb(abrirWhatsapp(url));
    setPendente(token);
  }
  /** Resolve a confirmação: no "Sim" chama onSim(token) (aí sim registra); em qualquer caso fecha. */
  function resolver(enviou: boolean, onSim: (token: T) => void) {
    if (pendente != null && enviou) onSim(pendente);
    setPendente(null);
  }
  return { pendente, web, abrir, resolver };
}

/** A caixa de confirmação de envio, reutilizada por todos os botões que registram mensagem. */
export function ConfirmarEnvioModal({ aberto, onSim, onNao, web }: { aberto: boolean; onSim: () => void; onNao: () => void; web?: string | null }) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={onNao}>
      <div className="bg-white rounded-[24px] p-6 w-full max-w-sm space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-display text-lg font-bold text-primary">Você enviou a mensagem?</p>
          <button onClick={onNao} className="p-1.5 rounded-lg hover:bg-surface transition" aria-label="Fechar"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-foreground/60">Confirme só se a mensagem foi realmente enviada no WhatsApp — o registro conta um envio feito, não a abertura do WhatsApp.</p>
        {/* Doc 63: o computador abre pelo aplicativo instalado. Se ele não abrir (não instalado,
            esquema não registrado), esta é a saída — e continua levando a mensagem pronta. */}
        {web && (
          <p className="text-xs text-foreground/50">
            Não abriu o aplicativo?{" "}
            <a href={web} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">Abrir no WhatsApp Web</a>
          </p>
        )}
        <div className="flex gap-2">
          <button onClick={onSim} className="flex-1 bg-primary text-white py-3 rounded-xl font-bold">Sim, enviei</button>
          <button onClick={onNao} className="px-4 py-3 rounded-xl font-semibold text-foreground/60 hover:bg-surface transition">Não enviei</button>
        </div>
      </div>
    </div>
  );
}
