import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Ir para a página inicial do Ledivan"
      className={`inline-flex items-center group ${className}`}
    >
      <img
        src="/landing/logo-ledivan.png"
        alt="Ledivan"
        className="h-12 md:h-14 w-auto object-contain transition-transform group-hover:-rotate-1"
        draggable={false}
      />
    </Link>
  );
}
