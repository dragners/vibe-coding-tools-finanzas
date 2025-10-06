import React, { useEffect, useMemo, useState } from "react";
import "./index.css";

type Lang = "es" | "en";

type RatioPeriod = "1Y" | "3Y" | "5Y";

type PerformanceKey =
  | "1M"
  | "3M"
  | "6M"
  | "YTD"
  | "1Y"
  | "3Y Anual"
  | "5Y Anual"
  | "10Y Anual";

type MetricValue =
  | string
  | number
  | null
  | undefined
  | {
      value?: string | number | null;
      label?: string | number | null;
    };

type MetricRecord<T extends string> = Partial<Record<T, MetricValue>>;

type FundRow = {
  name: string;
  isin: string;
  category: string;
  morningstarId: string;
  morningstarRating?: number | null;
  comment: string;
  url: string;
  performance: MetricRecord<PerformanceKey>;
  sharpe: MetricRecord<RatioPeriod>;
  volatility: MetricRecord<RatioPeriod>;
  ter: MetricValue;
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
      "Estos son mis fondos favoritos, que sigo e invierto en ellos desde hace años.",
    refresh: "Refrescar datos",
    refreshing: "Actualizando...",
    lastUpdated: "Última actualización",
    name: "Nombre",
    isin: "ISIN",
    category: "Categoría",
    comment: "Comentarios",
    performance: "Rentabilidades (%)",
    sharpe: "Ratio Sharpe",
    volatility: "Volatilidad",
    ter: "TER",
    noData: "Sin datos",
    loading: "Cargando datos...",
    error: "No se han podido cargar los datos. Inténtalo de nuevo más tarde.",
    fundsTitle: "Fondos de Inversión",
    plansTitle: "Planes de Pensiones",
    sectionDescription: "",
    dataNote:
      "Los datos se obtienen automáticamente de Morningstar una vez al día y pueden actualizarse manualmente.",
    langES: "ES",
    langEN: "EN",
    back: "Volver a Herramientas",
    descriptionLink: "Ver ficha en Morningstar",
    commentPlaceholder: "-",
    footer: "© David Gonzalez, si quieres saber más sobre mí, visita",
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
    performance: "Performance (%)",
    sharpe: "Sharpe ratio",
    volatility: "Volatility",
    ter: "TER",
    noData: "No data",
    loading: "Loading data...",
    error: "Data could not be loaded. Please try again later.",
    fundsTitle: "Mutual Funds",
    plansTitle: "Pension Plans",
    sectionDescription: "",
    dataNote: "Data is automatically retrieved from Morningstar once per day and can be refreshed manually.",
    langES: "ES",
    langEN: "EN",
    back: "Back to Tools",
    descriptionLink: "View on Morningstar",
    commentPlaceholder: "-",
    footer: "© David Gonzalez, want to know more about me? Visit",
  },
} as const;

const PERFORMANCE_LABELS: readonly PerformanceKey[] = [
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

function formatValue(raw?: MetricValue): string {
  if (raw === null || raw === undefined) return "-";
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return "-";
    return String(raw);
  }
  if (typeof raw === "string") {
    const val = raw.trim();
    if (!val || val.toUpperCase() === "N/A" || val === "NaN") return "-";
    return val;
  }
  if (typeof raw === "object") {
    const nested =
      ("value" in raw ? raw.value : undefined) ??
      ("label" in raw ? raw.label : undefined);
    return formatValue(nested as MetricValue);
  }
  return "-";
}

function displayMetricLabel(label: PerformanceKey | RatioPeriod) {
  return label.replace(" Anual", "");
}

function renderStars(rating?: number | null) {
  if (rating === null || rating === undefined) return null;
  const normalized = Math.max(0, Math.min(5, Math.round(rating)));
  if (normalized <= 0) return null;
  return "★".repeat(normalized);
}

function renderMetricCells<T extends string>(
  columns: readonly T[],
  values: MetricRecord<T>,
  keyPrefix: string,
) {
  return columns.map((label) => (
    <td
      key={`${keyPrefix}-${label}`}
      className="px-1.5 py-2 text-sm font-semibold text-gray-700 text-center"
    >
      {formatValue(values[label])}
    </td>
  ));
}

function getMorningstarUrl(id?: string, lang: Lang = "es") {
  if (!id) return null;
  const langId = lang === "es" ? "es-ES" : "en-EN";
  return `https://lt.morningstar.com/xgnfa0k0aw/snapshot/snapshot.aspx?tab=0&Id=${encodeURIComponent(
    id,
  )}&ClientFund=0&BaseCurrencyId=EUR&CurrencyId=EUR&LanguageId=${langId}`;
}

const CATEGORY_SECONDARY_LABELS = ["Global", "Europe", "India", "ESG", "China", "Tech"] as const;

function getCategoryLabels(category: string, lang: Lang) {
  const labels: string[] = [];
  const normalized = category.toLowerCase();
  if (normalized.includes("equity")) {
    labels.push(lang === "es" ? "Acciones" : "Equity");
  } else if (normalized.includes("bond")) {
    labels.push(lang === "es" ? "Bonos" : "Bonds");
  }

  const secondary = CATEGORY_SECONDARY_LABELS.find((label) =>
    normalized.includes(label.toLowerCase()),
  );
  if (secondary) {
    labels.push(secondary);
  }

  return labels;
}

function Section({
  section,
  data,
  texts,
  lang,
}: {
  section: TableSection;
  data: FundRow[];
  texts: Record<TextKey, string>;
  lang: Lang;
}) {
  const title = section === "funds" ? texts.fundsTitle : texts.plansTitle;
  return (
    <section className="mt-10 sm:mt-12">
      <div className="mb-6 space-y-1">
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">{title}</h2>
        {texts.sectionDescription ? (
          <p className="text-sm text-gray-600 max-w-3xl">{texts.sectionDescription}</p>
        ) : null}
      </div>
      <div className="-mx-4 overflow-x-auto pb-4 sm:mx-0">
        <table className="min-w-full border-separate border-spacing-y-1 border-spacing-x-1 text-sm text-gray-800">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <th rowSpan={2} className="px-3 py-2 min-w-[220px] bg-white/70 rounded-tl-2xl">
                {texts.name}
              </th>
              <th rowSpan={2} className="px-2.5 py-2 whitespace-nowrap bg-white/70">
                {texts.isin}
              </th>
              <th rowSpan={2} className="px-2 py-2 min-w-[150px] bg-white/70">
                {texts.category}
              </th>
              <th rowSpan={2} className="px-1.5 py-2 whitespace-nowrap bg-white/70 text-center">
                {texts.ter}
              </th>
              <th colSpan={PERFORMANCE_LABELS.length} className="px-2.5 py-2 bg-white/70 text-center">
                {texts.performance}
              </th>
              <th colSpan={RATIO_LABELS.length} className="px-2.5 py-2 bg-white/70 text-center">
                {texts.sharpe}
              </th>
              <th colSpan={RATIO_LABELS.length} className="px-2.5 py-2 bg-white/70 text-center">
                {texts.volatility}
              </th>
              <th rowSpan={2} className="px-3 py-2 min-w-[200px] bg-white/70 rounded-tr-2xl">
                {texts.comment}
              </th>
            </tr>
            <tr className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {PERFORMANCE_LABELS.map((label) => (
                <th key={`perf-${label}`} className="px-1.5 py-1.5 bg-white/70 text-center">
                  {displayMetricLabel(label)}
                </th>
              ))}
              {RATIO_LABELS.map((label) => (
                <th key={`sharpe-${label}`} className="px-1.5 py-1.5 bg-white/70 text-center">
                  {displayMetricLabel(label)}
                </th>
              ))}
              {RATIO_LABELS.map((label) => (
                <th key={`vol-${label}`} className="px-1.5 py-1.5 bg-white/70 text-center">
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
                    3 + PERFORMANCE_LABELS.length + RATIO_LABELS.length * 2 + 2
                  }
                  className="px-3 py-6 text-center text-sm font-medium text-gray-500 bg-white/90 rounded-b-2xl"
                >
                  {texts.noData}
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const stars = renderStars(row.morningstarRating);
                const categoryValue = formatValue(row.category);
                const labels = categoryValue !== "-" ? getCategoryLabels(categoryValue, lang) : [];
                const link = getMorningstarUrl(row.morningstarId, lang) ?? row.url ?? undefined;
                return (
                  <tr key={`${section}-${row.morningstarId}`} className="align-top">
                    <td className="px-3 py-2 bg-white/95 backdrop-blur">
                      <div className="flex flex-col items-start gap-1">
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-cyan-600 hover:text-cyan-700 leading-tight"
                        >
                          {row.name}
                        </a>
                        {(stars || labels.length > 0) && (
                          <div className="flex flex-wrap items-center gap-1">
                            {stars ? (
                              <span
                                className="text-xs font-semibold text-amber-500 leading-none"
                                aria-label={`${stars.length} estrellas Morningstar`}
                              >
                                {stars}
                              </span>
                            ) : null}
                            {labels.map((label) => (
                              <span
                                key={`${row.morningstarId}-${label}`}
                                className="text-[10px] uppercase tracking-wide rounded-full bg-gray-100 px-1.5 py-0.5 font-semibold text-gray-600"
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 bg-white/95 backdrop-blur whitespace-nowrap text-gray-600">
                      {formatValue(row.isin)}
                    </td>
                    <td className="px-2 py-2 bg-white/95 backdrop-blur">{categoryValue}</td>
                    <td className="px-1.5 py-2 bg-white/95 backdrop-blur whitespace-nowrap font-semibold text-gray-700 text-center">
                      {formatValue(row.ter)}
                    </td>
                    {renderMetricCells(PERFORMANCE_LABELS, row.performance, "perf")}
                    {renderMetricCells(RATIO_LABELS, row.sharpe, "sharpe")}
                    {renderMetricCells(RATIO_LABELS, row.volatility, "vol")}
                    <td className="px-3 py-2 bg-white/95 backdrop-blur text-gray-600">
                      {formatValue(row.comment) || texts.commentPlaceholder}
                    </td>
                  </tr>
                );
              })
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

      <div className="sticky top-0 z-10 bg-white/85 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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
          <div className="flex flex-col items-stretch md:items-end gap-2 sm:gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
              <div
                className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white/90 p-1 shadow-sm"
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
                className="inline-flex items-center justify-center rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto w-full"
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

      <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 space-y-6">
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
            <Section section="funds" data={data.funds} texts={texts} lang={lang} />
            <Section section="plans" data={data.plans} texts={texts} lang={lang} />
          </div>
        )}

        <p className="text-xs text-gray-500 max-w-3xl">{texts.dataNote}</p>

        <footer className="text-sm text-gray-500">
          <span>{texts.footer}</span>{" "}
          <a
            href="https://dragner.net/"
            target="_blank"
            rel="noreferrer"
            className="text-cyan-600 hover:underline"
          >
            dragner.net
          </a>
        </footer>
      </main>
    </div>
  );
}
