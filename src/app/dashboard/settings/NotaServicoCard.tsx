"use client";

import { useMemo, useState } from "react";
import { FileText, Search, ExternalLink, CheckCircle2, AlertTriangle, Info, Building2, UserCog } from "lucide-react";
import { consultarMunicipio, municipiosDaUf, ufsConhecidas, COM_EMISSOR_NACIONAL, TOTAL_DE_MUNICIPIOS, DADOS_DE } from "@/lib/municipioNfse";
import { PARA_A_CONTADORA, tutorialDoMunicipio } from "@/lib/tutorialNfse";
import { ConfigFiscal, type CertificadoSalvo, type DadosFiscaisSalvos } from "./ConfigFiscal";

/**
 * NOTA DE SERVIÇO — a consulta do município e o roteiro (doc 76).
 *
 * Esta é a PRIMEIRA tela da funcionalidade de nota, e de propósito: metade dos municípios
 * brasileiros não emite pelo caminho nacional, e pedir dados fiscais a quem não vai poder emitir
 * é fazer a pessoa trabalhar para descobrir um "não" no fim.
 *
 * A tela não promete emissão e não guarda nada ainda. Ela responde uma pergunta e entrega um
 * roteiro — inclusive o roteiro de levar para a contadora, que foi o pedido do dono.
 */

const CORES = {
  emissor_nacional: { fundo: "bg-[#ecfdf5]", borda: "border-[#a7f3d0]", texto: "text-[#047857]", Icone: CheckCircle2 },
  so_ambiente: { fundo: "bg-[#fef9c3]", borda: "border-[#fde68a]", texto: "text-[#854d0e]", Icone: AlertTriangle },
  fora: { fundo: "bg-[#fef2f2]", borda: "border-[#fecaca]", texto: "text-[#b91c1c]", Icone: AlertTriangle },
  desconhecido: { fundo: "bg-surface", borda: "border-border", texto: "text-foreground/60", Icone: Info },
} as const;

const QUEM = {
  voce: { rotulo: "você", cls: "bg-primary/10 text-primary", Icone: UserCog },
  contadora: { rotulo: "contadora", cls: "bg-[#ede9fe] text-[#6d28d9]", Icone: UserCog },
  prefeitura: { rotulo: "prefeitura", cls: "bg-[#e0f2fe] text-[#0369a1]", Icone: Building2 },
} as const;

const campo = "px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

export function NotaServicoCard({ certificado, dados }: { certificado: CertificadoSalvo; dados: DadosFiscaisSalvos }) {
  const [uf, setUf] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [consultado, setConsultado] = useState<{ uf: string; nome: string } | null>(null);

  const ufs = useMemo(() => ufsConhecidas(), []);
  const lista = useMemo(() => (uf ? municipiosDaUf(uf) : []), [uf]);

  const resposta = consultado ? consultarMunicipio(consultado.uf, consultado.nome) : null;
  const tutorial = resposta ? tutorialDoMunicipio(resposta.situacao, resposta.nome) : null;
  const cor = resposta ? CORES[resposta.situacao] : null;

  return (
    <div className="glass-card rounded-[24px] p-6 space-y-5">
      <div className="flex items-start gap-5">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <FileText className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-primary">Nota de Serviço (NFS-e)</h4>
          <p className="text-sm text-foreground/50 mt-1 leading-relaxed">
            Antes de qualquer configuração, descubra se o seu município emite pelo caminho nacional.
            Hoje, <strong>{COM_EMISSOR_NACIONAL.toLocaleString("pt-BR")} dos {TOTAL_DE_MUNICIPIOS.toLocaleString("pt-BR")}</strong>{" "}
            municípios estão no Emissor Nacional — nos demais, a nota sai pelo sistema da prefeitura.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="nfse-uf" className="text-xs font-semibold text-foreground/60">Estado</label>
          <select id="nfse-uf" value={uf} onChange={(e) => { setUf(e.target.value); setMunicipio(""); setConsultado(null); }} className={campo}>
            <option value="">—</option>
            {ufs.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label htmlFor="nfse-municipio" className="text-xs font-semibold text-foreground/60">Município</label>
          {/* Lista com datalist em vez de <select>: São Paulo tem mais de 600 municípios, e
              rolar uma lista desse tamanho no celular é pior do que digitar as três primeiras
              letras. A consulta aceita os dois — digitado ou escolhido. */}
          <input
            id="nfse-municipio" list="nfse-municipios" value={municipio} disabled={!uf}
            onChange={(e) => { setMunicipio(e.target.value); setConsultado(null); }}
            placeholder={uf ? "digite as primeiras letras" : "escolha o estado primeiro"}
            className={`${campo} w-full disabled:opacity-50`}
          />
          <datalist id="nfse-municipios">
            {lista.map((m) => <option key={m} value={m} />)}
          </datalist>
        </div>
        <button
          type="button"
          onClick={() => setConsultado({ uf, nome: municipio })}
          disabled={!uf || !municipio.trim()}
          className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Search className="w-4 h-4" /> Consultar
        </button>
      </div>

      {resposta && tutorial && cor && (
        <div className="space-y-4">
          <div className={`rounded-2xl border ${cor.borda} ${cor.fundo} p-4 space-y-2`}>
            <p className={`font-bold flex items-start gap-2 ${cor.texto}`}>
              <cor.Icone className="w-5 h-5 shrink-0 mt-0.5" /> {tutorial.resumo}
            </p>
            <p className="text-sm text-foreground/70 leading-relaxed">{tutorial.oQueOLedivanFaz}</p>
            {resposta.inicioVigencia && resposta.situacao !== "desconhecido" && (
              <p className="text-xs text-foreground/50">Convênio em vigor desde {resposta.inicioVigencia}.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-foreground/50">O que fazer</p>
            {tutorial.passos.map((p, i) => {
              const q = QUEM[p.quem];
              return (
                <div key={i} className="rounded-2xl border border-border bg-surface/40 p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-primary text-sm">{i + 1}. {p.titulo}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${q.cls}`}>{q.rotulo}</span>
                  </div>
                  <p className="text-sm text-foreground/60 leading-relaxed">{p.detalhe}</p>
                  {p.link && (
                    <a href={p.link.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline">
                      {p.link.texto} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {/* A configuracao so aparece onde EXISTE caminho de emissao. Em municipio que nao emite
              pelo nacional, pedir CPF e certificado seria pedir trabalho por nada. */}
          {resposta.situacao === "emissor_nacional" && (
            <ConfigFiscal uf={resposta.uf} municipio={resposta.nome ?? consultado!.nome}
              certificado={certificado} dados={dados} />
          )}

          {/* O pedido do dono: que ela consiga levar isto pronto para a contadora. */}
          <details className="rounded-2xl border border-border bg-surface/40 p-4">
            <summary className="cursor-pointer font-semibold text-primary text-sm">
              Levar para a contadora — o que ela vai precisar
            </summary>
            <ul className="mt-3 space-y-2">
              {PARA_A_CONTADORA.map((c) => (
                <li key={c.campo} className="text-sm">
                  <span className="font-semibold text-foreground/80">{c.campo}</span>
                  <span className="block text-xs text-foreground/50">{c.porque}</span>
                </li>
              ))}
            </ul>
          </details>

          {/* A data é a da PUBLICAÇÃO da lista pelo gov.br. Sem ela, a tela não inventa uma. */}
          <p className="text-[11px] text-foreground/40">
            {DADOS_DE
              ? `Lista oficial do gov.br publicada em ${new Date(DADOS_DE + "T12:00:00").toLocaleDateString("pt-BR")}.`
              : "Lista oficial do gov.br."}{" "}
            Municípios entram todo mês — se o seu ainda não estiver, vale reconferir.
          </p>
        </div>
      )}
    </div>
  );
}
