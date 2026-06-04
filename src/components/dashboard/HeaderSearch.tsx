"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export function HeaderSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/dashboard/transactions?q=${encodeURIComponent(query)}`);
    } else {
      router.push(`/dashboard/transactions`);
    }
  };

  return (
    <form 
      onSubmit={handleSearch}
      className="hidden sm:flex items-center gap-4 bg-surface px-4 lg:px-6 py-3 rounded-2xl border border-border w-full max-w-md group focus-within:border-primary transition-colors"
    >
      <Search className="w-5 h-5 text-foreground/40 group-focus-within:text-primary" />
      <input 
        type="text" 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Pesquisar transações..." 
        className="bg-transparent border-none outline-none text-sm font-medium w-full placeholder:text-foreground/30"
      />
    </form>
  );
}
