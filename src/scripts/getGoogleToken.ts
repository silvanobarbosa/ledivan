import http from "node:http";
import { URL } from "node:url";

// Configurações do OAuth (pegando do .env.local via process.env se carregado, 
// mas como o tsx vai rodar com --env-file, as variáveis estarão aqui)
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3001/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile"
].join(" ");

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("❌ GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não encontrados no .env.local");
  process.exit(1);
}

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
  `response_type=code&` +
  `scope=${encodeURIComponent(SCOPES)}&` +
  `access_type=offline&` +
  `prompt=consent`;

async function getAccessToken(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Erro ao obter token: ${JSON.stringify(data)}`);
  }
  return data;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  
  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    
    if (code) {
      try {
        console.log("🚀 Código recebido! Trocando por token...");
        const tokens = await getAccessToken(code);
        
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>Sucesso!</h1><p>Você pode fechar esta aba e voltar ao terminal.</p>");
        
        console.log("\n✅ Tokens obtidos com sucesso!");
        console.log("-----------------------------------------");
        console.log(`STITCH_ACCESS_TOKEN=${tokens.access_token}`);
        if (tokens.refresh_token) {
          console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        }
        console.log("-----------------------------------------");
        console.log("\n👉 Copie o STITCH_ACCESS_TOKEN acima e cole no seu .env.local");
        
        process.exit(0);
      } catch (error) {
        console.error("❌ erro:", error);
        res.writeHead(500);
        res.end("Erro ao obter token.");
        process.exit(1);
      }
    } else {
      res.writeHead(400);
      res.end("Código não encontrado.");
    }
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(3001, () => {
  console.log("\n🔑 Script de Autenticação CapiCash");
  console.log("=================================");
  console.log("1. Abra o link abaixo no seu navegador:");
  console.log(`\n${authUrl}\n`);
  console.log("2. Autorize o acesso com sua conta Google.");
  console.log("3. O token aparecerá aqui assim que você concluir.");
  console.log("\nAguardando autorização...\n");
});
