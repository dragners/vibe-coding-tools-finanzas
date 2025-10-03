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

const PERFORMANCE_LABELS: PerformanceKey[] = [
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

const RATIO_LABELS: RatioPeriod[] = ["1Y", "3Y", "5Y"];

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
    <section className="mt-10">
      <div className="flex flex-col gap-2 mb-4">
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-600 max-w-3xl">{texts.sectionDescription}</p>
      </div>
      <div className="overflow-x-auto bg-white shadow-sm ring-1 ring-slate-200 rounded-lg">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
              <th className="px-4 py-3 min-w-[220px]">{texts.name}</th>
              <th className="px-4 py-3 whitespace-nowrap">{texts.isin}</th>
              <th className="px-4 py-3 min-w-[180px]">{texts.category}</th>
              <th className="px-4 py-3 min-w-[160px]">{texts.performance}</th>
              <th className="px-4 py-3 whitespace-nowrap">{texts.sharpe}</th>
              <th className="px-4 py-3 whitespace-nowrap">{texts.volatility}</th>
              <th className="px-4 py-3 whitespace-nowrap">{texts.ter}</th>
              <th className="px-4 py-3 min-w-[180px]">{texts.comment}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
            {data.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  {texts.noData}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={`${section}-${row.morningstarId}`} className="hover:bg-slate-50">
                  <td className="px-4 py-3 align-top">
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-blue-600 hover:text-blue-700"
                    >
                      {row.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-slate-600">{formatValue(row.isin)}</td>
                  <td className="px-4 py-3 align-top">{formatValue(row.category)}</td>
                  <td className="px-4 py-3 align-top">
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                      {PERFORMANCE_LABELS.map((key) => (
                        <React.Fragment key={key}>
                          <dt className="font-semibold text-slate-500">{key}</dt>
                          <dd className="text-slate-700">{formatValue(row.performance[key])}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <dl className="space-y-1 text-xs text-slate-600">
                      {RATIO_LABELS.map((key) => (
                        <div key={key} className="flex justify-between gap-2">
                          <dt className="font-semibold text-slate-500">{key}</dt>
                          <dd className="text-slate-700">{formatValue(row.sharpe[key])}</dd>
                        </div>
                      ))}
                    </dl>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <dl className="space-y-1 text-xs text-slate-600">
                      {RATIO_LABELS.map((key) => (
                        <div key={key} className="flex justify-between gap-2">
                          <dt className="font-semibold text-slate-500">{key}</dt>
                          <dd className="text-slate-700">{formatValue(row.volatility[key])}</dd>
                        </div>
                      ))}
                    </dl>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">{formatValue(row.ter)}</td>
                  <td className="px-4 py-3 align-top text-slate-600">
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
    <div className="min-h-screen bg-slate-100 pb-16">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <a href="/" className="text-sm text-blue-600 hover:text-blue-700">
              ← {texts.back}
            </a>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{texts.title}</h1>
            <p className="mt-2 text-slate-600 max-w-3xl">{texts.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setLang("es")}
                className={`px-3 py-1.5 text-sm font-medium border border-slate-200 ${
                  lang === "es" ? "bg-blue-600 text-white" : "bg-white text-slate-600"
                } rounded-l-md`}
              >
                {texts.langES}
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`px-3 py-1.5 text-sm font-medium border border-slate-200 border-l-0 ${
                  lang === "en" ? "bg-blue-600 text-white" : "bg-white text-slate-600"
                } rounded-r-md`}
              >
                {texts.langEN}
              </button>
            </div>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:hover:bg-blue-600"
            >
              {refreshing ? texts.refreshing : texts.refresh}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {status === "loading" && (
          <p className="text-slate-600 text-sm">{texts.loading}</p>
        )}
        {status === "error" && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
            {texts.error}
            {error ? ` (${error})` : null}
          </div>
        )}
        {status === "ready" && data && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              {texts.lastUpdated}: {new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(data.lastUpdated))}
            </p>
          </div>
        )}

        {data && status === "ready" && (
          <div className="mt-6 space-y-10">
            <Section section="funds" data={data.funds} texts={texts} />
            <Section section="plans" data={data.plans} texts={texts} />
          </div>
        )}
      </main>
    </div>
  );
}
