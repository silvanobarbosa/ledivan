// Tipos + estilos de feriado — SEM dependência de servidor (importável no client).
export type HolidayType = "NACIONAL" | "ESTADUAL" | "MUNICIPAL" | "FACULTATIVO";
export type Holiday = { date: string; nome: string; tipo: HolidayType; cityName?: string };
export type HolidayCity = { ibge: number; nome: string; uf: string };

export const HOLIDAY_PRIORITY: Record<HolidayType, number> = { NACIONAL: 0, ESTADUAL: 1, MUNICIPAL: 2, FACULTATIVO: 3 };

// Cores por nível (distintas das cores de sessão). fg=texto, bg=fundo tint, border=realce.
export const HOLIDAY_STYLE: Record<HolidayType, { label: string; short: string; fg: string; bg: string; border: string }> = {
  NACIONAL:    { label: "Nacional",    short: "Nac", fg: "#b91c1c", bg: "#fee2e2", border: "#ef4444" },
  ESTADUAL:    { label: "Estadual",    short: "Est", fg: "#6d28d9", bg: "#ede9fe", border: "#8b5cf6" },
  MUNICIPAL:   { label: "Municipal",   short: "Mun", fg: "#0e7490", bg: "#cffafe", border: "#06b6d4" },
  FACULTATIVO: { label: "Facultativo", short: "Fac", fg: "#a16207", bg: "#fef9c3", border: "#eab308" },
};
