import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.google.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // remediação de drift: completa o baseline (faltavam estes 3)
          // A sala de vídeo (JaaS/8x8) precisa de câmera e microfone. A Permissions-Policy
          // ANTERIOR (camera=(), microphone=()) proibia os dois para TODOS, inclusive self — a
          // chamada travava em "Entrando na sala…" e áudio/vídeo nunca abriam. Liberado só para
          // self e os domínios do Jitsi; geolocation e browsing-topics seguem bloqueados.
          { key: "Permissions-Policy", value: 'camera=(self "https://8x8.vc" "https://meet.jit.si"), microphone=(self "https://8x8.vc" "https://meet.jit.si"), geolocation=(), browsing-topics=()' },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 8x8.vc / meet.jit.si: a sala de vídeo carrega o external_api.js desses domínios.
              // Sem isto na script-src, o navegador recusa o script e a chamada trava para sempre
              // em "Entrando na sala…" (o JitsiMeetExternalAPI nunca fica definido).
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://8x8.vc https://*.8x8.vc https://meet.jit.si",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              // wss: para a sinalização em tempo real do Jitsi (WebSocket); https: não cobre wss:.
              "connect-src 'self' https: wss:",
              // o Jitsi roda dentro de um iframe desses domínios; sem frame-src ele cai no
              // default-src 'self' e o iframe é bloqueado.
              "frame-src https://8x8.vc https://*.8x8.vc https://meet.jit.si",
              "frame-ancestors 'none'",
              "base-uri 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
