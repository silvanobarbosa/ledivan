import { AlertTriangle, TrendingDown, CalendarX, DollarSign } from "lucide-react";
import type { ClinicalFlag } from "@/lib/clinical";

function FlagIcon({ kind }: { kind: ClinicalFlag["icon"] }) {
  const cls = "w-3 h-3";
  if (kind === "risk") return <CalendarX className={cls} />;
  if (kind === "scale") return <AlertTriangle className={cls} />;
  if (kind === "mood") return <TrendingDown className={cls} />;
  return <DollarSign className={cls} />;
}

export function FlagChips({ flags }: { flags: ClinicalFlag[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((f, i) => (
        <span key={i} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${f.tone === "grave" ? "bg-[#fee2e2] text-[#b91c1c]" : "bg-[#fffbeb] text-[#b45309]"}`}>
          <FlagIcon kind={f.icon} /> {f.label}
        </span>
      ))}
    </div>
  );
}
