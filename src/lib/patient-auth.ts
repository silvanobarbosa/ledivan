// Resolve o paciente a partir do header Authorization: Bearer <token> (app nativo do paciente).
import { verifyPatient } from "@/lib/patient-token";

export function patientFromBearer(req: Request): { patientId: string; userId: string } | null {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const p = verifyPatient(m[1].trim());
  return p ? { patientId: p.pid, userId: p.uid } : null;
}
