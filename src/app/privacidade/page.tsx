import Link from "next/link";
import { Logo } from "@/components/landing/Logo";

export const metadata = {
  title: "Política de Privacidade — Ledivan",
  description: "Como o Ledivan coleta, usa e protege os dados, em conformidade com a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <div className="bg-ornaments min-h-screen">
      <header className="mx-auto w-full max-w-3xl px-6 py-6 flex items-center justify-between">
        <Logo />
        <Link href="/login" className="text-sm text-[color:var(--muted-foreground)] hover:text-ink transition">Entrar</Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="glass-card-lg p-8 md:p-12 space-y-6 text-[color:var(--ink)] leading-relaxed">
          <div>
            <h1 className="font-display text-4xl font-medium text-[color:var(--brand-eggplant)]">Política de Privacidade</h1>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">Última atualização: junho de 2026</p>
          </div>

          <p>
            Esta Política descreve como o <strong>Ledivan</strong> ("plataforma", "nós") trata dados pessoais, em conformidade
            com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
          </p>

          <Section n="1" t="Papéis (controlador e operador)">
            <p>
              O <strong>profissional/terapeuta</strong> que usa a plataforma é o <strong>controlador</strong> dos dados de seus
              pacientes (decide por que e como tratá-los). O <strong>Ledivan</strong> atua como <strong>operador</strong>,
              tratando esses dados em nome do profissional, conforme estas regras. Em relação aos dados de cadastro do próprio
              profissional, o Ledivan é controlador.
            </p>
          </Section>

          <Section n="2" t="Dados que tratamos">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Conta do profissional:</strong> nome, e-mail, foto (via login Google) e preferências.</li>
              <li><strong>Dados de pacientes</strong> inseridos pelo profissional: nome, contato, sessões, pagamentos, anotações de prontuário, tarefas, diário de humor e escalas — podendo incluir <strong>dados sensíveis de saúde</strong>.</li>
              <li><strong>Credenciais de integração</strong> (e-mail/SMTP, tokens) — armazenadas de forma criptografada.</li>
              <li><strong>Dados técnicos</strong> mínimos de sessão (cookies de autenticação) para manter o login.</li>
            </ul>
          </Section>

          <Section n="3" t="Finalidades e base legal">
            <p>
              Tratamos os dados para prestar o serviço de gestão de consultório (execução de contrato) e, quanto a dados de
              pacientes, com base no <strong>consentimento</strong> e nas hipóteses de <strong>tutela da saúde</strong> obtidos
              pelo profissional junto ao paciente. O profissional é responsável por colher o consentimento dos seus pacientes
              (incluindo para uso de gravação/transcrição por IA, quando aplicável).
            </p>
          </Section>

          <Section n="4" t="Compartilhamento com operadores (subprocessadores)">
            <p>Usamos prestadores que processam dados estritamente para operar a plataforma:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Vercel</strong> — hospedagem e armazenamento de arquivos (Blob, privado).</li>
              <li><strong>Neon</strong> — banco de dados (PostgreSQL).</li>
              <li><strong>Provedor de IA do próprio profissional</strong> — a transcrição da sessão usa a conta e a chave de IA
                cadastradas pelo profissional (ex.: OpenAI ou Groq). O áudio vai direto para esse provedor, sob contrato dele,
                e o Ledivan não armazena o áudio. Sem chave cadastrada, o recurso fica indisponível.</li>
              <li><strong>Google</strong> — login, e (opcional) Google Agenda/Meet, conforme autorização do profissional.</li>
              <li><strong>Resend</strong> — envio do e-mail de acesso (login).</li>
              <li><strong>Evolution API / WhatsApp</strong> e <strong>Telegram</strong> — envio de lembretes e lançamentos, quando o profissional conecta esses canais.</li>
            </ul>
          </Section>

          <Section n="5" t="Segurança">
            <p>
              Adotamos medidas técnicas: tráfego por HTTPS/TLS, <strong>isolamento por tenant</strong> (cada profissional acessa
              apenas seus dados), criptografia de segredos sensíveis em repouso, arquivos de anexos em armazenamento
              <strong> privado</strong> servidos apenas ao profissional dono, e controle de acesso por autenticação.
            </p>
          </Section>

          <Section n="6" t="Retenção e exclusão">
            <p>
              Os dados são mantidos enquanto a conta estiver ativa e pelo prazo necessário às finalidades e obrigações legais
              do profissional. Para <strong>prontuário</strong>, a guarda mínima é de <strong>5 anos</strong> a contar do
              último registro, conforme a Resolução CFP nº 001/2009 (podendo ser estendida por decisão do profissional ou
              exigência legal). O profissional pode excluir um paciente a qualquer momento — a exclusão remove sessões,
              prontuário, pagamentos e anexos vinculados, e é <strong>irreversível</strong>.
            </p>
          </Section>

          <Section n="7" t="Direitos do titular (art. 18 da LGPD)">
            <p>
              O titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e
              informações sobre compartilhamento. Pedidos de pacientes devem ser dirigidos ao profissional (controlador); o
              Ledivan apoia o atendimento.
            </p>
          </Section>

          <Section n="8" t="Cookies">
            <p>Usamos apenas cookies essenciais de autenticação/sessão. Não usamos cookies de publicidade.</p>
          </Section>

          <Section n="9" t="Contato / Encarregado (DPO)">
            <p>
              Dúvidas ou solicitações: <a href="mailto:contato@ledivan.com.br" className="text-[color:var(--brand-eggplant)] underline">contato@ledivan.com.br</a>.
            </p>
          </Section>

          <p className="text-xs text-[color:var(--muted-foreground)] border-t border-[rgba(43,24,48,0.08)] pt-4">
            Este documento é um modelo informativo e não constitui aconselhamento jurídico. Recomenda-se revisão por advogado(a)
            antes do uso comercial.
          </p>

          <div className="flex gap-4 text-sm">
            <Link href="/termos" className="text-[color:var(--brand-eggplant)] underline">Termos de Serviço</Link>
            <Link href="/" className="text-[color:var(--muted-foreground)] hover:text-ink">Início</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ n, t, children }: { n: string; t: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl font-medium text-[color:var(--brand-eggplant)]">{n}. {t}</h2>
      <div className="text-sm text-[color:var(--ink)]/85 space-y-2">{children}</div>
    </section>
  );
}
