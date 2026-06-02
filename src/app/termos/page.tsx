import Link from "next/link";
import { Logo } from "@/components/landing/Logo";

export const metadata = {
  title: "Termos de Serviço — Ledivan",
  description: "Termos e condições de uso da plataforma Ledivan.",
};

export default function TermosPage() {
  return (
    <div className="bg-ornaments min-h-screen">
      <header className="mx-auto w-full max-w-3xl px-6 py-6 flex items-center justify-between">
        <Logo />
        <Link href="/login" className="text-sm text-[color:var(--muted-foreground)] hover:text-ink transition">Entrar</Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="glass-card-lg p-8 md:p-12 space-y-6 text-[color:var(--ink)] leading-relaxed">
          <div>
            <h1 className="font-display text-4xl font-medium text-[color:var(--brand-eggplant)]">Termos de Serviço</h1>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">Última atualização: junho de 2026</p>
          </div>

          <p>Ao criar uma conta e usar o <strong>Ledivan</strong> ("plataforma"), você ("profissional", "usuário") concorda com estes Termos.</p>

          <Section n="1" t="Objeto">
            <p>O Ledivan é uma plataforma de gestão de consultório de terapia, com módulo financeiro e recursos de engajamento de pacientes (agenda, prontuário, tarefas, escalas, lembretes e integrações).</p>
          </Section>

          <Section n="2" t="Conta e acesso">
            <p>O acesso é feito por login Google ou link mágico por e-mail. Você é responsável por manter a confidencialidade do acesso e por toda atividade na sua conta. Cada profissional possui um espaço isolado.</p>
          </Section>

          <Section n="3" t="Responsabilidades do profissional">
            <ul className="list-disc pl-5 space-y-1">
              <li>Cumprir as normas do seu conselho de classe (ex.: CFP) e o sigilo profissional.</li>
              <li>Ser o <strong>controlador</strong> dos dados dos seus pacientes e obter os <strong>consentimentos</strong> necessários (inclusive para gravação/transcrição por IA e envio de mensagens).</li>
              <li>Garantir a exatidão dos dados inseridos e o uso lícito da plataforma.</li>
              <li>Usar os recursos clínicos (escalas, IA, resumos) como <strong>apoio</strong> — não substituem o seu julgamento profissional.</li>
            </ul>
          </Section>

          <Section n="4" t="Integrações de terceiros">
            <p>
              Recursos como Google (Agenda/Meet/Gmail), WhatsApp (via Evolution API) e Telegram dependem de serviços de terceiros
              e estão sujeitos aos termos deles. O uso de WhatsApp por gateways não oficiais pode implicar risco de bloqueio do
              número pelo provedor — a responsabilidade pela conexão do número é do profissional.
            </p>
          </Section>

          <Section n="5" t="Planos e pagamento">
            <p>Eventuais planos, valores e período de teste serão informados na contratação. Tributos e emissão fiscal, quando aplicáveis, seguem a legislação vigente.</p>
          </Section>

          <Section n="6" t="Uso aceitável">
            <p>É vedado usar a plataforma para fins ilícitos, enviar spam, violar direitos de terceiros, tentar burlar a segurança ou acessar dados de outro profissional.</p>
          </Section>

          <Section n="7" t="Propriedade intelectual">
            <p>O software, a marca e a interface do Ledivan pertencem aos seus titulares. Os dados inseridos (pacientes, prontuários) pertencem ao profissional/paciente; você nos concede licença limitada apenas para operar o serviço.</p>
          </Section>

          <Section n="8" t="Disponibilidade e limitação de responsabilidade">
            <p>
              O serviço é fornecido "no estado em que se encontra", sem garantia de disponibilidade ininterrupta. Na máxima
              extensão permitida em lei, o Ledivan não se responsabiliza por decisões clínicas, perdas indiretas ou por
              indisponibilidade de serviços de terceiros. O profissional deve manter rotinas próprias de cuidado e backup
              quando aplicável.
            </p>
          </Section>

          <Section n="9" t="Privacidade">
            <p>O tratamento de dados segue a nossa <Link href="/privacidade" className="text-[color:var(--brand-eggplant)] underline">Política de Privacidade</Link> e a LGPD.</p>
          </Section>

          <Section n="10" t="Rescisão">
            <p>Você pode encerrar a conta quando quiser. Podemos suspender contas que violem estes Termos. Após o encerramento, os dados são tratados conforme a Política de Privacidade e obrigações legais de guarda.</p>
          </Section>

          <Section n="11" t="Alterações">
            <p>Podemos atualizar estes Termos; mudanças relevantes serão comunicadas. O uso continuado após a atualização implica concordância.</p>
          </Section>

          <Section n="12" t="Lei aplicável e foro">
            <p>Aplica-se a legislação brasileira. Fica eleito o foro do domicílio do profissional, salvo disposição legal em contrário.</p>
          </Section>

          <Section n="13" t="Contato">
            <p><a href="mailto:contato@ledivan.com.br" className="text-[color:var(--brand-eggplant)] underline">contato@ledivan.com.br</a></p>
          </Section>

          <p className="text-xs text-[color:var(--muted-foreground)] border-t border-[rgba(43,24,48,0.08)] pt-4">
            Este documento é um modelo informativo e não constitui aconselhamento jurídico. Recomenda-se revisão por advogado(a) antes do uso comercial.
          </p>

          <div className="flex gap-4 text-sm">
            <Link href="/privacidade" className="text-[color:var(--brand-eggplant)] underline">Política de Privacidade</Link>
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
