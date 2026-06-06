import { db } from "@/db";
import { auth } from "@/auth";
import { categories } from "@/db/schema";
import { Scale } from "lucide-react";
import { ConciliacaoClient } from "./ConciliacaoClient";

export const dynamic = "force-dynamic";

export default async function ConciliacaoPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const cats = await db.query.categories.findMany();

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <Scale className="w-7 h-7" /> Conciliação bancária
        </h1>
        <p className="text-foreground/50 mt-1">Suba o extrato do banco (CSV/OFX) e cruze com receitas e despesas do sistema.</p>
      </div>
      <ConciliacaoClient categories={cats.map((c) => ({ id: c.id, name: c.name, type: c.type }))} />
    </div>
  );
}
