import React, { useEffect, useMemo, useState } from "react";
import "./index.css";
import { MOCK_PAYLOAD } from "./mockData";

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

export type FundRow = {
  name: string;
  isin: string;
  category: string;
  morningstarId: string;
  morningstarRating?: number | null;
  comment: string;
  url: string;
  indexed?: boolean;
  performance: MetricRecord<PerformanceKey>;
  sharpe: MetricRecord<RatioPeriod>;
  volatility: MetricRecord<RatioPeriod>;
  ter: MetricValue;
};

export type ApiPayload = {
  lastUpdated: string;
  funds: FundRow[];
  plans: FundRow[];
};

type ApiStatus = "idle" | "loading" | "ready" | "error";

type TextKey = keyof typeof TEXTS["es"];

type TableSection = "funds" | "plans";

const TEXTS = {
  es: {
    title: "Listado y Comparativa de Fondos y Planes de Pensiones",
    subtitle:
      "Estos son mis fondos favoritos y planes de pensiones, que sigo e invierto en ellos desde hace años.",
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
    mockNotice:
      "Mostrando datos de ejemplo por falta de conexión con la API. Las cifras pueden no coincidir con los últimos datos reales.",
  },
  en: {
    title: "Fund and Pension Plan List and Comparison",
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
    mockNotice:
      "Displaying sample data because the live API is unavailable. Figures may differ from the latest real data.",
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
const ENABLE_MOCK_DATA =
  String(import.meta.env.VITE_ENABLE_MOCK_DATA ?? "true").toLowerCase() !== "false";

function shouldUseMockData(err: unknown) {
  if (!ENABLE_MOCK_DATA) return false;
  if (err instanceof SyntaxError) return true;
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (/^http \d+/.test(message)) return false;
    return (
      message.includes("unexpected token") ||
      message.includes("content type") ||
      message.includes("json") ||
      message.includes("failed to fetch") ||
      message.includes("network")
    );
  }
  return false;
}

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

function getMetricNumber(raw?: MetricValue): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[%\s]/g, "").replace(/,/g, ".");
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof raw === "object") {
    if ("value" in raw && raw.value !== undefined) {
      return getMetricNumber(raw.value as MetricValue);
    }
    if ("label" in raw && raw.label !== undefined) {
      return getMetricNumber(raw.label as MetricValue);
    }
  }
  return null;
}

type ColumnStats = {
  min: number | null;
  max: number | null;
  maxPositive: number | null;
  minNegative: number | null;
};

type MetricAccessor = "performance" | "sharpe" | "volatility";

type ColumnStatsMap<T extends string> = Record<T, ColumnStats>;

function collectColumnStats<T extends string>(
  rows: FundRow[],
  accessor: MetricAccessor,
  labels: readonly T[],
): ColumnStatsMap<T> {
  const stats = {} as ColumnStatsMap<T>;
  labels.forEach((label) => {
    stats[label] = { min: null, max: null, maxPositive: null, minNegative: null };
  });

  rows.forEach((row) => {
    const record = row[accessor] as MetricRecord<T> | undefined;
    if (!record) return;

    labels.forEach((label) => {
      const value = getMetricNumber(record[label]);
      if (value === null) return;
      const column = stats[label];
      column.min = column.min === null ? value : Math.min(column.min, value);
      column.max = column.max === null ? value : Math.max(column.max, value);
      if (value > 0) {
        column.maxPositive =
          column.maxPositive === null ? value : Math.max(column.maxPositive, value);
      } else if (value < 0) {
        column.minNegative =
          column.minNegative === null ? value : Math.min(column.minNegative, value);
      }
    });
  });

  return stats;
}

type RGB = { r: number; g: number; b: number };

const COLOR_NEGATIVE: RGB = { r: 220, g: 38, b: 38 };
const COLOR_POSITIVE: RGB = { r: 16, g: 185, b: 129 };
const COLOR_NEUTRAL: RGB = { r: 226, g: 232, b: 240 };
const COLOR_ALPHA = 0.82;
const ZERO_TOLERANCE = 0.0001;

function blendColors(start: RGB, end: RGB, ratio: number): RGB {
  const clamped = Math.max(0, Math.min(1, ratio));
  return {
    r: Math.round(start.r + (end.r - start.r) * clamped),
    g: Math.round(start.g + (end.g - start.g) * clamped),
    b: Math.round(start.b + (end.b - start.b) * clamped),
  };
}

function colorToRgba(color: RGB, alpha = COLOR_ALPHA) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function getBackgroundColor(value: number | null, stats: ColumnStats): string | undefined {
  if (value === null || Number.isNaN(value)) return undefined;
  if (Math.abs(value) <= ZERO_TOLERANCE) {
    return colorToRgba(COLOR_NEUTRAL, 0.45);
  }

  if (value > 0) {
    const { maxPositive } = stats;
    if (!maxPositive || maxPositive <= 0) return colorToRgba(COLOR_NEUTRAL, 0.45);
    const ratio = value / maxPositive;
    const blended = blendColors(COLOR_NEUTRAL, COLOR_POSITIVE, ratio);
    return colorToRgba(blended);
  }

  if (value < 0) {
    const { minNegative } = stats;
    if (!minNegative || minNegative >= 0) return colorToRgba(COLOR_NEUTRAL, 0.45);
    const ratio = value / minNegative; // both negative, results between 0 and 1
    const blended = blendColors(COLOR_NEUTRAL, COLOR_NEGATIVE, ratio);
    return colorToRgba(blended);
  }

  return undefined;
}

function renderMetricCells<T extends string>(
  columns: readonly T[],
  values: MetricRecord<T>,
  keyPrefix: string,
  stats?: ColumnStatsMap<T>,
) {
  return columns.map((label) => {
    const numericValue = getMetricNumber(values[label]);
    const columnStats = stats?.[label];
    const background = columnStats
      ? getBackgroundColor(numericValue, columnStats)
      : undefined;
    return (
      <td
        key={`${keyPrefix}-${label}`}
        className="px-1.5 py-2 text-sm font-semibold text-gray-700 text-center"
        style={background ? { backgroundColor: background } : undefined}
      >
        {formatValue(values[label])}
      </td>
    );
  });
}

function getMorningstarUrl(id?: string, lang: Lang = "es") {
  if (!id) return null;
  const langId = lang === "es" ? "es-ES" : "en-EN";
  return `https://lt.morningstar.com/xgnfa0k0aw/snapshot/snapshot.aspx?tab=0&Id=${encodeURIComponent(
    id,
  )}&ClientFund=0&BaseCurrencyId=EUR&CurrencyId=EUR&LanguageId=${langId}`;
}

const CATEGORY_SECONDARY_LABELS = ["Global", "Europe", "India", "ESG", "China", "Tech"] as const;

const BADGE_STYLES = {
  equity: "bg-rose-100/80 text-rose-700 border border-rose-200",
  bond: "bg-emerald-100/80 text-emerald-700 border border-emerald-200",
  global: "bg-violet-100/80 text-violet-700 border border-violet-200",
  europe: "bg-blue-100/80 text-blue-700 border border-blue-200",
  india: "bg-amber-100/80 text-amber-700 border border-amber-200",
  esg: "bg-teal-100/80 text-teal-700 border border-teal-200",
  china: "bg-orange-100/80 text-orange-700 border border-orange-200",
  tech: "bg-sky-100/80 text-sky-700 border border-sky-200",
  indexed: "bg-cyan-100/80 text-cyan-700 border border-cyan-200",
  active: "bg-slate-100/80 text-slate-700 border border-slate-200",
  default: "bg-zinc-100/80 text-zinc-700 border border-zinc-200",
} as const;

type BadgeVariant = keyof typeof BADGE_STYLES;

type CategoryBadge = {
  text: string;
  variant: BadgeVariant;
};

const SECONDARY_BADGE_VARIANTS: Record<(typeof CATEGORY_SECONDARY_LABELS)[number], BadgeVariant> = {
  Global: "global",
  Europe: "europe",
  India: "india",
  ESG: "esg",
  China: "china",
  Tech: "tech",
};

function getCategoryBadges(category: string, lang: Lang, indexed?: boolean): CategoryBadge[] {
  const labels: CategoryBadge[] = [];
  const normalized = category.toLowerCase();
  if (normalized.includes("equity")) {
    labels.push({ text: lang === "es" ? "Acciones" : "Equity", variant: "equity" });
  } else if (normalized.includes("bond")) {
    labels.push({ text: lang === "es" ? "Bonos" : "Bonds", variant: "bond" });
  }

  const secondary = CATEGORY_SECONDARY_LABELS.find((label) =>
    normalized.includes(label.toLowerCase()),
  );
  if (secondary) {
    labels.push({
      text: secondary,
      variant: SECONDARY_BADGE_VARIANTS[secondary] ?? "default",
    });
  }

  const strategyBadge: CategoryBadge = indexed
    ? { text: "Index", variant: "indexed" }
    : { text: lang === "es" ? "Activa" : "Active", variant: "active" };
  labels.push(strategyBadge);

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
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);

  const performanceStats = useMemo(
    () => collectColumnStats(data, "performance", PERFORMANCE_LABELS),
    [data],
  );
  const sharpeStats = useMemo(
    () => collectColumnStats(data, "sharpe", RATIO_LABELS),
    [data],
  );
  const volatilityStats = useMemo(
    () => collectColumnStats(data, "volatility", RATIO_LABELS),
    [data],
  );

  const handleToggleTooltip = (id: string) => {
    setOpenTooltipId((prev) => (prev === id ? null : id));
  };

  const handleCloseTooltip = (id: string) => {
    setOpenTooltipId((prev) => (prev === id ? null : prev));
  };

  return (
    <section className="mt-10 sm:mt-12">
      <div className="mb-6 space-y-1">
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">{title}</h2>
        {texts.sectionDescription ? (
          <p className="text-sm text-gray-600 max-w-3xl">{texts.sectionDescription}</p>
        ) : null}
      </div>
      <div className="-mx-4 overflow-x-auto pb-4 sm:mx-0">
        <table className="min-w-full border-separate border-spacing-y-1 border-spacing-x-0.5 text-sm text-gray-800">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <th rowSpan={2} className="px-3 py-2 min-w-[220px] bg-white/70 rounded-tl-2xl">
                {texts.name}
              </th>
              <th rowSpan={2} className="px-2.5 py-2 whitespace-nowrap bg-white/70">
                {texts.isin}
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
                    2 + PERFORMANCE_LABELS.length + RATIO_LABELS.length * 2 + 2
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
                const rowKey = row.morningstarId || row.isin || row.name;
                const badges = getCategoryBadges(categoryValue, lang, row.indexed);
                const tooltipId = `${section}-${rowKey}`;
                const tooltipOpen = openTooltipId === tooltipId;
                const categoryDisplay = categoryValue !== "-" ? categoryValue : texts.noData;
                const link = getMorningstarUrl(row.morningstarId, lang) ?? row.url ?? undefined;
                const tooltipLabel =
                  categoryDisplay && categoryDisplay !== texts.noData
                    ? `${row.name} · ${categoryDisplay}`
                    : row.name;
                return (
                  <tr key={tooltipId} className="align-top">
                    <td className="px-3 py-2 bg-white/95 backdrop-blur">
                      <div className="flex flex-col items-start gap-1">
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-cyan-600 hover:text-cyan-700 leading-tight"
                          title={row.name}
                        >
                          {row.name}
                          {stars ? (
                            <span
                              className="ml-2 inline-flex items-center text-xs font-semibold text-amber-500 align-middle"
                              aria-label={`${stars.length} estrellas Morningstar`}
                            >
                              {stars}
                            </span>
                          ) : null}
                        </a>
                        {badges.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <div
                              className="relative group"
                              onMouseLeave={() => handleCloseTooltip(tooltipId)}
                            >
                              <button
                                type="button"
                                className="inline-flex flex-wrap items-center gap-1 rounded-md bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                                onClick={() => handleToggleTooltip(tooltipId)}
                                onBlur={() => handleCloseTooltip(tooltipId)}
                                onKeyDown={(event) => {
                                  if (event.key === "Escape") {
                                    event.stopPropagation();
                                    handleCloseTooltip(tooltipId);
                                  }
                                }}
                                aria-haspopup="true"
                                aria-expanded={tooltipOpen}
                                aria-label={`${row.name}: ${categoryDisplay}`}
                                title={tooltipLabel}
                              >
                                {badges.map((badge) => (
                                  <span
                                    key={`${rowKey}-${badge.text}`}
                                    className={`text-[10px] font-semibold uppercase tracking-wide rounded-lg px-2 py-0.5 border ${
                                      BADGE_STYLES[badge.variant] ?? BADGE_STYLES.default
                                    }`}
                                  >
                                    {badge.text}
                                  </span>
                                ))}
                              </button>
                              <div
                                className={`pointer-events-none absolute left-0 top-full z-30 mt-2 w-max max-w-xs rounded-md bg-slate-900/90 px-2 py-1 text-xs font-semibold text-white shadow-lg transition-opacity duration-150 ${
                                  tooltipOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                }`}
                                role="tooltip"
                              >
                                {tooltipLabel}
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 bg-white/95 backdrop-blur whitespace-nowrap text-gray-600">
                      {formatValue(row.isin)}
                    </td>
                    <td className="px-1.5 py-2 bg-white/95 backdrop-blur whitespace-nowrap font-semibold text-gray-700 text-center">
                      {formatValue(row.ter)}
                    </td>
                    {renderMetricCells(
                      PERFORMANCE_LABELS,
                      row.performance,
                      "perf",
                      performanceStats,
                    )}
                    {renderMetricCells(RATIO_LABELS, row.sharpe, "sharpe", sharpeStats)}
                    {renderMetricCells(
                      RATIO_LABELS,
                      row.volatility,
                      "vol",
                      volatilityStats,
                    )}
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
  const [usingMockData, setUsingMockData] = useState(false);

  const fetchData = async (force = false) => {
    setStatus((prev) => (prev === "ready" ? prev : "loading"));
    setError(null);
    setUsingMockData(false);
    try {
      const endpoint = force ? `${API_BASE}/refresh` : `${API_BASE}/data`;
      const response = await fetch(endpoint, {
        method: force ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      const rawText = await response.text();
      if (!contentType.toLowerCase().includes("application/json")) {
        throw new Error(`Unexpected content type: ${contentType || "unknown"}`);
      }
      let payload: ApiPayload;
      try {
        payload = JSON.parse(rawText) as ApiPayload;
      } catch (jsonErr) {
        throw new SyntaxError((jsonErr as Error).message || "Invalid JSON response");
      }
      setData(payload);
      setStatus("ready");
    } catch (err) {
      console.error(err);
      if (shouldUseMockData(err)) {
        setData(MOCK_PAYLOAD);
        setStatus("ready");
        setUsingMockData(true);
        return;
      }
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
            {usingMockData ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 shadow-sm">
                {texts.mockNotice}
              </div>
            ) : null}
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
