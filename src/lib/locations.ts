// Endereços de atendimento presencial do terapeuta (até 3).
export type AttendanceLocation = { name: string; address: string };

export function parseLocations(json: string | null | undefined): AttendanceLocation[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((l) => ({ name: String(l.name || "").trim(), address: String(l.address || "").trim() }))
      .filter((l) => l.name || l.address)
      .slice(0, 3);
  } catch {
    return [];
  }
}

export const ATTENDANCE_MODE_LABELS: Record<string, string> = {
  online: "Online",
  presencial: "Presencial",
  misto: "Misto (online + presencial)",
};
