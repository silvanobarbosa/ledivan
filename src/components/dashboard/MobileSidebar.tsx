"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import logoColor from "../../../public/ledivan-color.png";
import { usePathname } from "next/navigation";
import { NavList } from "./Sidebar";

/**
 * Barra lateral retrátil no mobile: botão hambúrguer no header abre um drawer
 * com o menu completo. Fecha ao clicar num link, no backdrop, no X, com Esc,
 * ou ao trocar de rota. Trava o scroll do body enquanto aberto.
 */
export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // fecha ao navegar
  useEffect(() => {
    // O caminho "puro" seria remontar por `key` no pai, o que jogaria fora o estado do menu
    // inteiro a cada rota. O custo real aqui é um render a mais por navegação.
    // Fecha a gaveta ao navegar. O caminho "puro" seria remontar por `key` no pai, o que
    // jogaria fora o estado do menu inteiro a cada rota. O custo aqui é um render a mais.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // Esc + trava scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    // Quem rola NAO e o body: e o <main> do layout do painel. Travar o body era um no-op, e o
    // conteudo continuava correndo por tras do menu aberto. A classe no <html> alcanca o main.
    document.documentElement.classList.add("menu-aberto");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("menu-aberto");
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={open}
        className="lg:hidden p-2.5 -ml-1 rounded-2xl text-foreground/70 hover:text-primary hover:bg-surface transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`lg:hidden fixed inset-0 z-[58] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        /*
         * `z-[59]`: acima da barra inferior (z-50) e do conteudo, e ABAIXO das janelas (z-[70] em
         * lib/modal). Antes o drawer empatava com elas em z-[70] e o desempate ficava por ordem no
         * DOM — o mesmo tropeco que a barra inferior ja tinha dado.
         *
         * `dvh`, nao `vh`: no celular a barra do navegador aparece e some, e `vh` mede a tela como
         * se ela nunca estivesse la — cortando justamente o fim do menu.
         *
         * E a gaveta TERMINA acima da barra inferior (6rem = os 96px medidos em lib/modal), em vez
         * de ir ate o fim da tela. So respiro interno nao bastava: no tablet a lista cabe inteira
         * sem rolar, e ai o ultimo item pousa onde pousar — em cima da barra.
         */
        className={`lg:hidden fixed left-0 top-0 h-[calc(100dvh-6rem)] z-[59] w-[82%] max-w-xs bg-white flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <Link href="/" onClick={() => setOpen(false)}>
            <Image src={logoColor} alt="Ledivan" sizes="200px" className="h-10 w-auto object-contain" />
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="p-2 rounded-2xl text-foreground/60 hover:text-primary hover:bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Um scroller so: o `flex-1 overflow-y-auto` ja vive dentro do NavList. Dois aninhados
            faziam o de dentro perder o efeito, e a lista crescia sem rolar. O respiro no fim
            garante que "Meu Perfil" e "Ajuda" nao morram atras da barra inferior nem do gesto do
            sistema. */}
        <div className="flex-1 min-h-0 flex flex-col py-4">
          <NavList onNavigate={() => setOpen(false)} className="pb-4" />
        </div>
      </aside>
    </>
  );
}
