import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getMesesDisponiveis, getLancamentos } from "@/lib/queries/dre";
import {
  EMPRESA_BY_CODE,
  EMPRESAS_OPERACIONAIS,
  type EmpresaCode,
} from "@/lib/dre/empresas";
import { MES_ABREV, MES_NOME } from "@/lib/dre/meses";
import {
  buildSnapshot,
  buildAcumulado,
  periodoISO,
  type DreSnapshot,
} from "@/lib/dre/computacoes";
import { gerarResumo } from "@/lib/dre/resumo-executivo";
import { Header } from "./_components/header";
import { Filters } from "./_components/filters";
import { ExecSummary } from "./_components/exec-summary";
import { KpiGrid } from "./_components/kpi-grid";
import { Waterfall } from "./_components/waterfall";
import { Trend } from "./_components/trend";
import { DespesasDonut } from "./_components/despesas-donut";
import { RankingEmpresas } from "./_components/ranking-empresas";
import { TabelaDRE } from "./_components/tabela-dre";
import styles from "./theme.module.css";

interface SearchParams {
  mes?: string;
  empresa?: string;
  inv?: string;
}

const VALIDAS: EmpresaCode[] = ["consolidado", "matriz", "filial", "hdslim", "medical"];

function parseMes(raw: string | undefined, disponiveis: number[]): number | "acum" {
  if (raw === "acum") return "acum";
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 1 && n <= 12 && disponiveis.includes(n)) return n;
  // default = último mês com dados
  return disponiveis.length > 0 ? disponiveis[disponiveis.length - 1] : 1;
}

function parseEmpresa(raw: string | undefined): EmpresaCode {
  return raw && (VALIDAS as string[]).includes(raw) ? (raw as EmpresaCode) : "consolidado";
}

export default async function DREPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  const params = await searchParams;
  const disponiveis = await getMesesDisponiveis();

  if (!disponiveis) {
    return (
      <main className={styles.container}>
        <Header ano={new Date().getFullYear()} subtitle="SEM DADOS · AGUARDANDO UPLOAD" />
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>Nenhum upload registrado</div>
          <div className={styles.emptyHint}>
            Use POST /api/dre/upload (admin) para popular a primeira planilha.
          </div>
        </div>
      </main>
    );
  }

  const ano = disponiveis.ano;
  const meses = disponiveis.meses;
  const mesParam = parseMes(params.mes, meses);
  const empresa = parseEmpresa(params.empresa);
  const semInvest = params.inv !== "com"; // default: sem investimentos

  // Carrega todos os lançamentos do ano de uma vez (volume baixo, ~225/mês × N).
  // Necessário para: snapshot atual, prev, trend mensal, ranking por empresa.
  const lancamentos = await getLancamentos({ ano, meses });

  const modo: "mes" | "acumulado" = mesParam === "acum" ? "acumulado" : "mes";
  const periodos = meses.map((m) => periodoISO(ano, m));

  // Snapshot principal e prev (mês anterior)
  let snap: DreSnapshot;
  let prev: DreSnapshot | null = null;

  if (modo === "acumulado") {
    snap = buildAcumulado(lancamentos, empresa, periodos);
  } else {
    const mesNum = mesParam as number;
    snap = buildSnapshot(lancamentos, empresa, periodoISO(ano, mesNum));
    const idxAtual = meses.indexOf(mesNum);
    if (idxAtual > 0) {
      const mesPrev = meses[idxAtual - 1];
      prev = buildSnapshot(lancamentos, empresa, periodoISO(ano, mesPrev));
    }
  }

  // Snapshots por mês (1..12) pra trend mensal
  const porMes: Record<number, DreSnapshot | null> = {};
  for (let m = 1; m <= 12; m++) {
    porMes[m] = meses.includes(m)
      ? buildSnapshot(lancamentos, empresa, periodoISO(ano, m))
      : null;
  }

  // Ranking: snapshot por empresa operacional no mesmo período/modo
  const porEmpresa: Record<EmpresaCode, DreSnapshot> = {} as Record<EmpresaCode, DreSnapshot>;
  for (const code of EMPRESAS_OPERACIONAIS) {
    porEmpresa[code] =
      modo === "acumulado"
        ? buildAcumulado(lancamentos, code, periodos)
        : buildSnapshot(lancamentos, code, periodoISO(ano, mesParam as number));
  }

  // Subtítulo do header
  const empNome = EMPRESA_BY_CODE[empresa].label.toUpperCase();
  const periodoLabel =
    modo === "acumulado"
      ? `ACUMULADO ${ano}`
      : `${MES_NOME[mesParam as number].toUpperCase()}/${ano}`;
  const subtitle = `${empNome} · ${periodoLabel} · VISÃO ${semInvest ? "SEM" : "COM"} INVESTIMENTOS`;

  // Resumo executivo
  const primeiroMesComDados = meses[0];
  const resumoHtml = gerarResumo({
    empresa,
    modo,
    mesNum: typeof mesParam === "number" ? mesParam : undefined,
    ano,
    snap,
    prev,
    semInvest,
    primeiroMesComDados,
  });

  // Compare label
  let compareLabel = "—";
  if (modo === "mes" && prev !== null && typeof mesParam === "number") {
    const idx = meses.indexOf(mesParam);
    const mesAnterior = meses[idx - 1];
    compareLabel = `VS ${MES_ABREV[mesAnterior]}`;
  }

  // Tag da seção tabela
  const dreTag = `${modo === "acumulado" ? "ACUMULADO" : MES_NOME[mesParam as number].toUpperCase()} · ${empNome}`;

  return (
    <main className={styles.container}>
      <Header ano={ano} subtitle={subtitle} />
      <Filters
        mesAtual={mesParam}
        empresaAtual={empresa}
        semInvest={semInvest}
        mesesDisponiveis={meses}
      />

      <ExecSummary html={resumoHtml} />
      <KpiGrid snap={snap} prev={prev} semInvest={semInvest} modo={modo} />

      <div className={styles.row2}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Cascata do Resultado</div>
          <div className={styles.cardSubtitle}>DA RECEITA BRUTA AO LUCRO LÍQUIDO</div>
          <Waterfall snap={snap} semInvest={semInvest} />
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Tendência Mensal</div>
          <div className={styles.cardSubtitle}>FATURAMENTO · LUCRO LÍQUIDO · MARGEM</div>
          <Trend porMes={porMes} semInvest={semInvest} snapAtual={snap} />
        </div>
      </div>

      <div className={styles.row2}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Composição das Despesas Fixas</div>
          <div className={styles.cardSubtitle}>TOP CENTROS DE CUSTO · PERÍODO SELECIONADO</div>
          <DespesasDonut snap={snap} />
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Performance por Empresa</div>
          <div className={styles.cardSubtitle}>
            LUCRO LÍQUIDO {semInvest ? "S/" : "C/"} INVESTIMENTOS · PERÍODO
          </div>
          <RankingEmpresas porEmpresa={porEmpresa} semInvest={semInvest} />
        </div>
      </div>

      <div className={styles.sectionTitle}>
        <h2>Demonstrativo Detalhado</h2>
        <span className={styles.sectionTag}>{dreTag}</span>
      </div>
      <TabelaDRE snap={snap} prev={prev} semInvest={semInvest} compareLabel={compareLabel} />

      <footer>
        <span>RIGEL · CONTROLADORIA · DRE EXECUTIVO</span>
        <span>{periodoLabel}</span>
      </footer>
    </main>
  );
}
