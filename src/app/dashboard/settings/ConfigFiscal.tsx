"use client";

import { useRef, useState, useTransition } from "react";
import { ShieldCheck, Upload, Trash2, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { avisoDeVencimento } from "@/lib/certificadoDigital";
import { enviarCertificado, removerCertificado, salvarDadosFiscais } from "./fiscal-actions";

/**
 * OS DADOS FISCAIS E O CERTIFICADO A1 (doc 76).
 *
 * Aparece DEPOIS da consulta do município, e só onde existe caminho de emissão — pedir CPF e
 * inscrição municipal a quem não vai poder emitir é fazer a pessoa trabalhar para descobrir um
 * "não" no fim.
 *
 * A tela repete, onde ela vai ver, que a SENHA NÃO É GUARDADA. Não é um detalhe técnico: é a
 * diferença entre confiar o arquivo ao app e confiar a assinatura dela. Quem não entende isso
 * guarda a senha num bilhete colado na tela, que é pior do que tudo.
 */

export type CertificadoSalvo = {
  nomeArquivo: string | null;
  titular: string | null;
  documento: string | null;
  tipo: string | null;
  validoAte: string | null;
  enviadoEm: string | null;
  /**
   * Dias ate vencer, calculado NO SERVIDOR.
   *
   * Chamar `Date.now()` durante o render e impuro — o React Compiler reprova, e com razao: o
   * numero mudaria sozinho a cada re-render. Quem sabe a data e o servidor, que ja le a coluna.
   */
  diasParaVencer: number | null;
} | null;

export type DadosFiscaisSalvos = {
  inscricaoMunicipal: string | null;
  cpf: string | null;
  cnpjTecnico: string | null;
  enderecoFiscal: string | null;
  codigoServico: string | null;
  regimeTributario: string | null;
};

const campo = "w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";
const rotulo = "text-xs font-semibold text-foreground/60";

/** Lê o arquivo como base64 — Server Action não transporta `File` cru. */
function leComoBase64(f: File): Promise<string> {
  return new Promise((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => erro(new Error("falha ao ler o arquivo"));
    r.readAsDataURL(f);
  });
}

export function ConfigFiscal({
  uf, municipio, certificado, dados,
}: {
  uf: string;
  municipio: string;
  certificado: CertificadoSalvo;
  dados: DadosFiscaisSalvos;
}) {
  const [salvando, salvar] = useTransition();
  const [recado, setRecado] = useState<{ tipo: "ok" | "erro"; texto: string; motivo?: string } | null>(null);
  const [form, setForm] = useState<DadosFiscaisSalvos>(dados);

  const arquivo = useRef<HTMLInputElement>(null);
  const [senha, setSenha] = useState("");
  const [enviando, enviar] = useTransition();

  const aviso = certificado?.diasParaVencer == null ? null : avisoDeVencimento(certificado.diasParaVencer);

  const mudar = (k: keyof DadosFiscaisSalvos) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function gravarDados() {
    setRecado(null);
    salvar(async () => {
      const r = await salvarDadosFiscais({ ...form, municipioUf: uf, municipioNome: municipio });
      setRecado(r.ok ? { tipo: "ok", texto: "Dados fiscais salvos." } : { tipo: "erro", texto: r.erro });
    });
  }

  function mandarCertificado() {
    setRecado(null);
    const f = arquivo.current?.files?.[0];
    if (!f) { setRecado({ tipo: "erro", texto: "Escolha o arquivo .pfx ou .p12." }); return; }
    if (!senha) { setRecado({ tipo: "erro", texto: "Informe a senha do certificado." }); return; }
    enviar(async () => {
      try {
        const b64 = await leComoBase64(f);
        const r = await enviarCertificado(f.name, b64, senha);
        // A senha sai da memória da tela assim que o servidor responde, dê certo ou errado.
        setSenha("");
        if (arquivo.current) arquivo.current.value = "";
        setRecado(r.ok
          ? { tipo: "ok", texto: r.aviso ?? "Certificado guardado com segurança." }
          : { tipo: "erro", texto: r.erro, motivo: r.motivo });
      } catch {
        setSenha("");
        setRecado({ tipo: "erro", texto: "Não consegui ler o arquivo escolhido." });
      }
    });
  }

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface/30 p-5">
      <div>
        <p className="font-bold text-primary flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Configuração fiscal</p>
        <p className="text-sm text-foreground/50 mt-1">
          Para <strong>{municipio} / {uf}</strong>. Os campos em branco podem ser preenchidos pela sua contadora.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className={rotulo} htmlFor="fis-cpf">CPF</label>
          <input id="fis-cpf" value={form.cpf ?? ""} onChange={mudar("cpf")} className={campo} placeholder="000.000.000-00" /></div>
        <div><label className={rotulo} htmlFor="fis-im">Inscrição municipal</label>
          <input id="fis-im" value={form.inscricaoMunicipal ?? ""} onChange={mudar("inscricaoMunicipal")} className={campo} placeholder="se o município exigir" /></div>
        <div className="sm:col-span-2"><label className={rotulo} htmlFor="fis-cnpj">CNPJ técnico (se houver)</label>
          <input id="fis-cnpj" value={form.cnpjTecnico ?? ""} onChange={mudar("cnpjTecnico")} className={campo} placeholder="00.000.000/0000-00" />
          <p className="text-[11px] text-foreground/40 mt-1">Não é CNPJ de MEI nem de empresa — o Ledivan não trata como tal.</p></div>
        <div className="sm:col-span-2"><label className={rotulo} htmlFor="fis-end">Endereço fiscal</label>
          <input id="fis-end" value={form.enderecoFiscal ?? ""} onChange={mudar("enderecoFiscal")} className={campo} placeholder="rua, número, bairro, CEP" /></div>
        <div><label className={rotulo} htmlFor="fis-cod">Código do serviço</label>
          <input id="fis-cod" value={form.codigoServico ?? ""} onChange={mudar("codigoServico")} className={campo} placeholder="a contadora informa" /></div>
        <div><label className={rotulo} htmlFor="fis-reg">Regime tributário</label>
          <input id="fis-reg" value={form.regimeTributario ?? ""} onChange={mudar("regimeTributario")} className={campo} placeholder="a contadora informa" /></div>
      </div>

      <button type="button" onClick={gravarDados} disabled={salvando}
        className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-60">
        {salvando ? "Salvando…" : "Salvar dados fiscais"}
      </button>

      <div className="border-t border-border pt-5 space-y-3">
        <p className="font-bold text-primary flex items-center gap-2"><Lock className="w-4 h-4" /> Certificado digital A1</p>

        {/* O recado mais importante da tela. Fica ANTES do campo, não depois. */}
        <div className="rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] p-4 text-sm text-[#1e3a8a] space-y-1.5">
          <p><strong>A senha não fica guardada.</strong> Ela é usada para conferir o certificado agora e descartada em seguida. Na hora de emitir uma nota, o Ledivan vai pedir a senha de novo.</p>
          <p className="text-xs">O arquivo fica guardado cifrado. Sem a senha, que só você tem, ele não assina nada — nem por nós.</p>
        </div>

        {certificado?.titular ? (
          <div className="rounded-2xl border border-border bg-white/60 p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-primary text-sm break-words">{certificado.titular}</p>
                <p className="text-xs text-foreground/50">
                  {certificado.tipo}{certificado.documento ? ` · ${certificado.documento}` : ""}
                  {certificado.validoAte ? ` · válido até ${new Date(certificado.validoAte).toLocaleDateString("pt-BR")}` : ""}
                </p>
                {certificado.nomeArquivo && <p className="text-[11px] text-foreground/35 break-all">{certificado.nomeArquivo}</p>}
              </div>
              <button type="button" onClick={() => { if (confirm("Remover o certificado guardado?")) salvar(async () => { await removerCertificado(); setRecado({ tipo: "ok", texto: "Certificado removido." }); }); }}
                className="text-foreground/40 hover:text-red-600 transition shrink-0" aria-label="Remover certificado" title="Remover certificado">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {aviso && (
              <p className={`text-xs font-semibold flex items-start gap-1.5 ${aviso.nivel === "vencido" || aviso.nivel === "urgente" ? "text-red-600" : "text-[#854d0e]"}`}>
                <AlertTriangle className="w-4 h-4 shrink-0" /> {aviso.texto}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-foreground/50">Nenhum certificado enviado.</p>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={rotulo} htmlFor="fis-pfx">Arquivo (.pfx ou .p12)</label>
            <input ref={arquivo} id="fis-pfx" type="file" accept=".pfx,.p12,application/x-pkcs12"
              className="block w-full text-sm text-foreground/70 file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:text-white file:px-4 file:py-2 file:font-semibold" />
          </div>
          <div>
            <label className={rotulo} htmlFor="fis-senha">Senha do certificado</label>
            {/* `autoComplete="off"`: senha de certificado não é senha de site, e deixar o
                navegador oferecer para salvar seria contradizer o aviso logo acima. */}
            <input id="fis-senha" type="password" autoComplete="off" value={senha}
              onChange={(e) => setSenha(e.target.value)} className={campo} placeholder="usada agora e descartada" />
          </div>
        </div>

        <button type="button" onClick={mandarCertificado} disabled={enviando}
          className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm inline-flex items-center gap-2 disabled:opacity-60">
          <Upload className="w-4 h-4" /> {enviando ? "Conferindo…" : certificado?.titular ? "Substituir certificado" : "Enviar certificado"}
        </button>
      </div>

      {recado && (
        <p className={`text-sm flex items-start gap-2 ${recado.tipo === "ok" ? "text-[#047857]" : "text-red-600"}`}>
          {recado.tipo === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{recado.texto}{recado.motivo && <span className="block text-[11px] opacity-70">{recado.motivo}</span>}</span>
        </p>
      )}
    </div>
  );
}
