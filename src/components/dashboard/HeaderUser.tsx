import { User } from "lucide-react";

/**
 * Identidade do terapeuta no cabeçalho: foto 3x4 (se cadastrada) + nome.
 * Usa a foto 3x4 do cadastro; cai para o avatar do Google; senão, ícone.
 */
export function HeaderUser({ name, photoUrl }: { name?: string | null; photoUrl?: string | null }) {
  const display = name?.trim() || "Terapeuta";
  return (
    <div className="flex items-center gap-3 pl-1 lg:pl-3 lg:border-l border-border">
      <div className="h-11 w-[33px] rounded-lg overflow-hidden bg-surface-container border border-border flex items-center justify-center shrink-0">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={display} className="h-full w-full object-cover" />
        ) : (
          <User className="w-5 h-5 text-primary/70" />
        )}
      </div>
      <div className="hidden sm:block leading-tight min-w-0">
        <p className="text-sm font-bold text-foreground truncate max-w-[160px]">{display}</p>
        <p className="text-[11px] text-foreground/40">Terapeuta</p>
      </div>
    </div>
  );
}
