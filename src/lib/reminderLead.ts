// Opções de antecedência do lembrete (10 min até 24 h).
export const REMINDER_LEAD_OPTIONS: { value: number; label: string }[] = [
  { value: 10, label: "10 minutos antes" },
  { value: 15, label: "15 minutos antes" },
  { value: 20, label: "20 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 45, label: "45 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 90, label: "1 hora e 30 antes" },
  { value: 120, label: "2 horas antes" },
  { value: 180, label: "3 horas antes" },
  { value: 240, label: "4 horas antes" },
  { value: 360, label: "6 horas antes" },
  { value: 480, label: "8 horas antes" },
  { value: 720, label: "12 horas antes" },
  { value: 1440, label: "24 horas antes" },
];
