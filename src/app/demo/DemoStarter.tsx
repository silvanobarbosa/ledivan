"use client";

import { useRef, useEffect, useState } from "react";
import { startDemo } from "./actions";
import { Loader2 } from "lucide-react";

export function DemoStarter() {
  const formRef = useRef<HTMLFormElement>(null);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => { setStarted(true); formRef.current?.requestSubmit(); }, 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <form ref={formRef} action={startDemo} className="text-center space-y-4">
      <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
      <p className="font-display text-xl font-bold text-primary">Entrando na demonstração…</p>
      <p className="text-sm text-foreground/60 max-w-xs mx-auto">Conta de exemplo (Dr. Sócrates) com 3 anos de uso — somente leitura.</p>
      {!started && <noscript><button className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold">Entrar na demo</button></noscript>}
    </form>
  );
}
