import Image from "next/image";
import Link from "next/link";
import logo from "../../../public/landing/logo-ledivan.png";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Ir para a página inicial do Ledivan"
      className={`inline-flex items-center group ${className}`}
    >
      {/* `sizes` fixo de propósito: sem ele o navegador assume 100vw e baixa a maior variante
          do srcset para uma logo de ~56px de altura. */}
      <Image
        src={logo}
        alt="Ledivan"
        sizes="240px"
        priority
        className="h-12 md:h-14 w-auto object-contain transition-transform group-hover:-rotate-1"
        draggable={false}
      />
    </Link>
  );
}
