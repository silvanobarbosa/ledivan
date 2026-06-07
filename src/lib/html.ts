// Escapa texto para uso seguro dentro de HTML (e-mails). Evita XSS por conteúdo
// vindo de pacientes/usuários (nomes, mensagens) interpolado em templates.
export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
