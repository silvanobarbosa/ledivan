/**
 * Sistema imunológico da frota — client (self-contained, sem deps).
 * Cada app reporta sinais de ataque ao hub e puxa a blocklist compartilhada: um
 * atacante pego em UM app é barrado em TODOS (imunidade de rebanho). No-op gracioso
 * sem env. Config: IMMUNE_HUB_URL, IMMUNE_TOKEN, IMMUNE_APP.
 */
const HUB = () => process.env.IMMUNE_HUB_URL;
const TOKEN = () => process.env.IMMUNE_TOKEN || "";
const APP = () => process.env.IMMUNE_APP || "app";

// ── detecção (regex/heurística, barata) ──
const INJECTION = [/\bunion\b[\s\S]{0,20}\bselect\b/i, /\bor\b\s+1\s*=\s*1/i, /'\s*(or|and)\s+'?\d/i, /;\s*(drop|delete|update|insert)\b/i, /\$where\b|\$ne\b|\$gt\b|\$regex\b/i, /\$\{[\s\S]*\}/, /\b(exec|system|passthru|popen)\s*\(/i, /\bsleep\s*\(\s*\d/i];
const XSS = [/<script\b/i, /javascript:/i, /onerror\s*=/i, /onload\s*=/i, /<img[^>]+src\s*=\s*["']?\s*x/i];
const TRAVERSAL = [/\.\.[/\\]/, /%2e%2e[/\\%]/i, /\/etc\/passwd\b/i, /\bboot\.ini\b/i];
const SENSITIVE = [/\/\.env\b/i, /\/\.git\b/i, /\/\.aws\b/i, /\/wp-(admin|login|content)\b/i, /\/phpmyadmin\b/i, /\/\.ssh\b/i, /\/actuator\b/i, /\bxmlrpc\.php\b/i];
const BAD_UA = /(sqlmap|nikto|nmap|masscan|acunetix|nessus|dirbuster|gobuster|wpscan|hydra|zgrab|python-requests\/|go-http-client)/i;
const dec = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };
const any = (h: string, pats: RegExp[]) => pats.some((p) => p.test(h));

type Sig = { kind: string; sev: "high" | "critical" | "medium" };
function detect(path: string, ua: string): Sig[] {
  const hay = dec(path); const out: Sig[] = [];
  if (any(hay, INJECTION)) out.push({ kind: "injection", sev: "critical" });
  if (any(hay, TRAVERSAL)) out.push({ kind: "traversal", sev: "high" });
  if (any(hay, XSS)) out.push({ kind: "xss", sev: "high" });
  if (any(path, SENSITIVE)) out.push({ kind: "sensitive-path", sev: "high" });
  if (BAD_UA.test(ua)) out.push({ kind: "scanner", sev: "medium" });
  return out;
}

let blocked = new Set<string>();
let lastPull = 0;
const PULL_MS = 60_000;

async function pull(now: number) {
  const hub = HUB(); if (!hub || now - lastPull < PULL_MS) return;
  lastPull = now;
  try {
    const r = await fetch(`${hub}/api/immune/blocklist?app=${encodeURIComponent(APP())}`, { headers: { "x-immune-token": TOKEN() }, cache: "no-store" });
    if (r.ok) { const j = await r.json(); if (Array.isArray(j.ips)) blocked = new Set(j.ips); }
  } catch { /* mantém cache */ }
}
function report(ip: string, path: string, ua: string, kind: string, sev: string) {
  const hub = HUB(); if (!hub) return;
  fetch(`${hub}/api/immune/report`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-immune-token": TOKEN() },
    body: JSON.stringify({ app: APP(), ip, path: path.slice(0, 300), ua: ua.slice(0, 200), kind, severity: sev }),
  }).catch(() => {});
}

export async function immuneCheck(req: { ip: string; path: string; ua: string }, nowMs: number): Promise<{ block: boolean }> {
  try {
    await pull(nowMs);
    if (blocked.has(req.ip)) return { block: true };
    const sigs = detect(req.path, req.ua);
    if (!sigs.length) return { block: false };
    const worst = sigs.some((s) => s.sev === "critical") ? "critical" : "high";
    report(req.ip, req.path, req.ua, sigs.map((s) => s.kind).join(","), worst);
    // bloqueio local imediato em sinal grave
    if (sigs.some((s) => s.sev === "critical" || s.sev === "high")) { blocked.add(req.ip); return { block: true }; }
    return { block: false };
  } catch {
    return { block: false };
  }
}
