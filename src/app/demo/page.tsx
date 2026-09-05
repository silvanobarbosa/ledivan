import { DemoStarter } from "./DemoStarter";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DemoPage() {
  // Já logado (inclusive numa sessão demo já aberta)? Vai direto ao dashboard. Sem isso, quem
  // revisita /demo com a sessão demo ativa re-dispara o startDemo (POST) — que a própria sessão
  // read-only bloqueia (403), caindo numa página de erro. O visitante novo (sem sessão) segue
  // vendo o DemoStarter, que abre a sessão.
  const session = await auth();
  if (session?.user?.id) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-ornaments flex items-center justify-center p-4">
      <div className="glass-card-lg w-full max-w-md p-10">
        <DemoStarter />
      </div>
    </div>
  );
}
