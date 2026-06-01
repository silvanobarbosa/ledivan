"use client";

import { useState } from "react";
import { Copy, Check, Share2, Trash2, MessageCircle } from "lucide-react";
import { deleteSocialPost } from "./actions";

const NETWORK_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  whatsapp: "Status/WhatsApp",
  geral: "Geral",
};

export function PostCard({
  id, network, theme, content, hashtags,
}: {
  id: string; network: string; theme: string | null; content: string; hashtags: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const fullText = `${content}${hashtags ? `\n\n${hashtags}` : ""}`;

  function copy() {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function share() {
    if (navigator.share) navigator.share({ text: fullText }).catch(() => {});
    else copy();
  }

  return (
    <div className="glass-card rounded-[24px] p-5 group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-[#f3e8ff] text-primary">{NETWORK_LABELS[network] || network}</span>
          {theme && <span className="text-xs text-foreground/40 truncate max-w-[200px]">{theme}</span>}
        </div>
        <form action={deleteSocialPost.bind(null, id)}>
          <button className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-red-600 transition" title="Excluir">
            <Trash2 className="w-4 h-4" />
          </button>
        </form>
      </div>

      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{content}</p>
      {hashtags && <p className="text-sm text-primary mt-3">{hashtags}</p>}

      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
        <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-surface hover:bg-surface-container transition">
          {copied ? <><Check className="w-3.5 h-3.5 text-[#047857]" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(fullText)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-surface hover:bg-surface-container transition"
        >
          <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" /> WhatsApp
        </a>
        <button onClick={share} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-surface hover:bg-surface-container transition">
          <Share2 className="w-3.5 h-3.5" /> Compartilhar
        </button>
      </div>
    </div>
  );
}
