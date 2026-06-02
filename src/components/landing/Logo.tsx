import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Ir para a página inicial do Ledivan"
      className={`inline-flex items-center ${className}`}
    >
      <span className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-[color:var(--brand-eggplant)]">
        Ledivan
      </span>
    </Link>
  );
}
