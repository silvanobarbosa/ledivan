// Converte um valor de foto guardado no banco para uma URL renderável.
// - pathname do blob privado (ex: "fotos/<userId>/...") → rota autorizada /api/photo
// - URL http(s) externa (ex: avatar do Google) → usada direto
// - vazio → null
export function photoSrc(value?: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `/api/photo?p=${encodeURIComponent(value)}`;
}
