import { cn } from "@/lib/utils";

interface BalanceCardProps {
  title: string;
  amount: number;
  trend?: string;
  icon: React.ReactNode;
  variant?: "primary" | "secondary" | "accent" | "white";
  className?: string;
}

export function BalanceCard({ title, amount, trend, icon, variant = "white", className }: BalanceCardProps) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  return (
    <div className={cn(
      "p-6 rounded-[40px] shadow-sm border border-border space-y-4 transition-all hover:scale-[1.02]",
      variant === "primary" && "primary-gradient text-white border-transparent",
      variant === "secondary" && "bg-secondary-container text-on-secondary-container border-transparent",
      variant === "accent" && "bg-accent text-primary border-transparent",
      variant === "white" && "bg-white text-foreground",
      className
    )}>
      <div className="flex items-center justify-between">
        <span className={cn(
          "text-sm font-medium",
          variant === "white" ? "text-foreground/60" : "opacity-80"
        )}>
          {title}
        </span>
        <div className={cn(
          "p-2 rounded-2xl flex items-center justify-center text-xl",
          variant === "white" ? "bg-surface text-primary" : "bg-white/20 text-white"
        )}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold tracking-tight">
        {formatCurrency(amount)}
      </div>
      {trend && (
        <div className={cn(
          "text-xs font-medium",
          trend.includes("+") ? "text-green-500" : "text-red-400",
          variant !== "white" && "text-white/80"
        )}>
          {trend}
        </div>
      )}
    </div>
  );
}
