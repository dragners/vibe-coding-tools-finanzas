import React, { useEffect, useMemo, useState } from "react";
import "./index.css";

type Lang = "es" | "en";

type RatioPeriod = "1Y" | "3Y" | "5Y";

type PerformanceKey =
  | "1D"
  | "1W"
  | "1M"
  | "3M"
  | "6M"
  | "YTD"
  | "1Y"
  | "3Y Anual"
  | "5Y Anual"
  | "10Y Anual";

type FundRow = {
  name: string;
  isin: string;
  category: string;
  morningstarId: string;
  comment: string;
  url: string;
  performance: Partial<Record<PerformanceKey, string>>;
  sharpe: Partial<Record<RatioPeriod, string>>;
  volatility: Partial<Record<RatioPeriod, string>>;
  ter: string;
};

type ApiPayload = {
  lastUpdated: string;
  funds: FundRow[];
  plans: FundRow[];
};

type ApiStatus = "idle" | "loading" | "ready" | "error";

type TextKey = keyof typeof TEXTS["es"];

type TableSection = "funds" | "plans";

const TEXTS = {
  es: {
    title: "Listado y Comparativa de Fondos",
    subtitle:
      "Consulta la rentabilidad, ratios de Sharpe, volatilidad y TER de cada fondo o plan de pensiones.",
    refresh: "Refrescar datos",
    refreshing: "Actualizando...",
    lastUpdated: "Última actualización",
    name: "Nombre",
    isin: "ISIN",
    category: "Categoría",
    comment: "Comentarios",
    performance: "Rentabilidades",
    sharpe: "Ratio Sharpe",
    volatility: "Volatilidad",
    ter: "TER",
    noData: "Sin datos",
    loading: "Cargando datos...",
    error: "No se han podido cargar los datos. Inténtalo de nuevo más tarde.",
    fundsTitle: "Fondos de Inversión",
    plansTitle: "Planes de Pensiones",
    sectionDescription:
      "Los datos se obtienen automáticamente de Morningstar una vez al día y pueden actualizarse manualmente.",
    langES: "ES",
    langEN: "EN",
    back: "Volver a Herramientas",
    descriptionLink: "Ver ficha en Morningstar",
    commentPlaceholder: "-",
  },
  en: {
    title: "Fund List and Comparison",
    subtitle:
      "Review performance, Sharpe ratios, volatility and TER for each fund or pension plan.",
    refresh: "Refresh data",
    refreshing: "Refreshing...",
    lastUpdated: "Last update",
    name: "Name",
    isin: "ISIN",
    category: "Category",
    comment: "Notes",
    performance: "Performance",
    sharpe: "Sharpe ratio",
    volatility: "Volatility",
    ter: "TER",
    noData: "No data",
    loading: "Loading data...",
    error: "Data could not be loaded. Please try again later.",
    fundsTitle: "Mutual Funds",
    plansTitle: "Pension Plans",
    sectionDescription:
      "Data is fetched from Morningstar once per day and can be updated manually.",
    langES: "ES",
    langEN: "EN",
    back: "Back to Tools",
    descriptionLink: "View on Morningstar",
    commentPlaceholder: "-",
  },
} as const;

const PERFORMANCE_LABELS: readonly PerformanceKey[] = [
  "1D",
  "1W",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "3Y Anual",
  "5Y Anual",
  "10Y Anual",
];

const RATIO_LABELS: readonly RatioPeriod[] = ["1Y", "3Y", "5Y"];

const API_BASE = (import.meta.env.VITE_API_BASE ?? "/listadofondos/api").replace(/\/$/, "");

function useTexts(lang: Lang) {
  return useMemo(() => TEXTS[lang], [lang]);
}

function formatValue(raw?: string) {
  if (!raw) return "-";
  const val = raw.trim();
  if (!val || val === "NaN" || val === "N/A") return "-";
  return val;
}

function displayMetricLabel(label: PerformanceKey | RatioPeriod) {
  return label.replace(" Anual", "");
}

function Section({
  section,
  data,
  texts,
}: {
  section: TableSection;
  data: FundRow[];
  texts: Record<TextKey, string>;
}) {
  const title = section === "funds" ? texts.fundsTitle : texts.plansTitle;
  return (
    <section className="mt-12">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-600 max-w-3xl">{texts.sectionDescription}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-3 text-sm text-gray-800">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <th
                rowSpan={2}
                className="px-4 py-3 min-w-[220px] bg-white/70 text-left rounded-tl-2xl rounded-bl-2xl"
              >
                {texts.name}
              </th>
              <th
                rowSpan={2}
                className="px-4 py-3 whitespace-nowrap bg-white/70 text-left"
              >
                {texts.isin}
              </th>
              <th
                rowSpan={2}
                className="px-4 py-3 min-w-[180px] bg-white/70 text-left"
              >
                {texts.category}
              </th>
              <th
                colSpan={PERFORMANCE_LABELS.length}
                className="px-4 py-3 text-center bg-white/70"
              >
                {texts.performance}
              </th>
              <th colSpan={RATIO_LABELS.length} className="px-4 py-3 text-center bg-white/70">
                {texts.sharpe}
              </th>
              <th colSpan={RATIO_LABELS.length} className="px-4 py-3 text-center bg-white/70">
                {texts.volatility}
              </th>
              <th
                rowSpan={2}
                className="px-4 py-3 whitespace-nowrap bg-white/70 text-left"
              >
                {texts.ter}
              </th>
              <th
                rowSpan={2}
                className="px-4 py-3 min-w-[200px] bg-white/70 text-left rounded-tr-2xl rounded-br-2xl"
              >
                {texts.comment}
              </th>
            </tr>
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {PERFORMANCE_LABELS.map((label) => (
                <th key={`perf-${label}`} className="px-2 py-2 text-center whitespace-nowrap">
                  {displayMetricLabel(label)}
                </th>
              ))}
              {RATIO_LABELS.map((label) => (
                <th key={`sharpe-${label}`} className="px-2 py-2 text-center whitespace-nowrap">
                  {displayMetricLabel(label)}
                </th>
              ))}
              {RATIO_LABELS.map((label) => (
                <th key={`vol-${label}`} className="px-2 py-2 text-center whitespace-nowrap">
                  {displayMetricLabel(label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    5 + PERFORMANCE_LABELS.length + RATIO_LABELS.length * 2
                  }
                  className="px-4 py-6 text-center text-sm font-medium text-gray-500 bg-white/90 rounded-2xl"
                >
                  {texts.noData}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={`${section}-${row.morningstarId}`} className="align-top">
                  <td className="px-4 py-4 bg-white/95 backdrop-blur first:rounded-l-2xl">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-cyan-600 hover:text-cyan-700"
                    >
                      {row.name}
                    </a>
                  </td>
                  <td className="px-4 py-4 bg-white/95 backdrop-blur whitespace-nowrap text-gray-600">
                    {formatValue(row.isin)}
                  </td>
                  <td className="px-4 py-4 bg-white/95 backdrop-blur">{formatValue(row.category)}</td>
                  {PERFORMANCE_LABELS.map((label) => (
                    <td
                      key={`${row.morningstarId}-perf-${label}`}
                      className="px-2 py-4 bg-white/95 backdrop-blur text-center font-medium text-gray-700"
                    >
                      {formatValue(row.performance[label])}
                    </td>
                  ))}
                  {RATIO_LABELS.map((label) => (
                    <td
                      key={`${row.morningstarId}-sharpe-${label}`}
                      className="px-2 py-4 bg-white/95 backdrop-blur text-center text-gray-700"
                    >
                      {formatValue(row.sharpe[label])}
                    </td>
                  ))}
                  {RATIO_LABELS.map((label) => (
                    <td
                      key={`${row.morningstarId}-vol-${label}`}
                      className="px-2 py-4 bg-white/95 backdrop-blur text-center text-gray-700"
                    >
                      {formatValue(row.volatility[label])}
                    </td>
                  ))}
                  <td className="px-4 py-4 bg-white/95 backdrop-blur whitespace-nowrap font-semibold text-gray-700">
                    {formatValue(row.ter)}
                  </td>
                  <td className="px-4 py-4 bg-white/95 backdrop-blur text-gray-600 last:rounded-r-2xl">
                    {formatValue(row.comment) || texts.commentPlaceholder}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>("es");
  const texts = useTexts(lang);
  const [status, setStatus] = useState<ApiStatus>("idle");
  const [data, setData] = useState<ApiPayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (force = false) => {
    setStatus((prev) => (prev === "ready" ? prev : "loading"));
    setError(null);
    try {
      const endpoint = force ? `${API_BASE}/refresh` : `${API_BASE}/data`;
      const response = await fetch(endpoint, {
        method: force ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: ApiPayload = await response.json();
      setData(payload);
      setStatus("ready");
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
      setStatus("error");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(true);
    setRefreshing(false);
  };

  return (
    <div className="relative min-h-screen text-gray-900">
      <style>{`
        .landing-bg{position:fixed;inset:0;z-index:-1;background:
          radial-gradient(900px 600px at 10% 0%, rgba(14,165,233,.12), transparent 60%),
          radial-gradient(900px 600px at 90% -10%, rgba(2,132,199,.10), transparent 60%),
          linear-gradient(180deg,#fff 0%,#f8fbff 60%,#fff 100%),
          linear-gradient(to bottom, rgba(15,23,42,.04) 1px, transparent 1px),
          linear-gradient(to right, rgba(15,23,42,.04) 1px, transparent 1px);
          background-size:auto,auto,100% 100%,24px 24px,24px 24px;background-position:center}
      `}</style>
      <div className="landing-bg" aria-hidden="true" />

      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline"
            >
              <span aria-hidden="true">←</span>
              {texts.back}
            </a>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold">{texts.title}</h1>
              <p className="mt-1 text-sm md:text-base text-gray-700 max-w-3xl">{texts.subtitle}</p>
            </div>
          </div>
          <div className="flex flex-col items-stretch md:items-end gap-2">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div
                className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1"
                role="radiogroup"
                aria-label="Language"
              >
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="lang"
                    className="sr-only peer"
                    checked={lang === "es"}
                    onChange={() => setLang("es")}
                  />
                  <span className="px-3 py-1.5 text-sm rounded-lg block select-none text-gray-700 peer-checked:bg-cyan-600 peer-checked:text-white">
                    {texts.langES}
                  </span>
                </label>
                <label className="cursor-pointer">
                  <input
                    type="radio"
                    name="lang"
                    className="sr-only peer"
                    checked={lang === "en"}
                    onChange={() => setLang("en")}
                  />
                  <span className="px-3 py-1.5 text-sm rounded-lg block select-none text-gray-700 peer-checked:bg-cyan-600 peer-checked:text-white">
                    {texts.langEN}
                  </span>
                </label>
              </div>
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refreshing ? texts.refreshing : texts.refresh}
              </button>
            </div>
            {status === "ready" && data && (
              <p className="text-xs text-gray-500">
                {texts.lastUpdated}: {new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(data.lastUpdated))}
              </p>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {status === "loading" && (
          <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-gray-600 shadow-sm backdrop-blur">
            {texts.loading}
          </div>
        )}
        {status === "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {texts.error}
            {error ? ` (${error})` : null}
          </div>
        )}

        {data && status === "ready" && (
          <div className="space-y-12 pb-12">
            <Section section="funds" data={data.funds} texts={texts} />
            <Section section="plans" data={data.plans} texts={texts} />
          </div>
        )}
      </main>
    </div>
  );
}
