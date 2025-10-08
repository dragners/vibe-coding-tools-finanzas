import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
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

type ApiStatus = "idle" | "loading" | "ready" | "refreshing" | "error";

type TextKey = keyof typeof TEXTS["es"];

type TableSection = "funds" | "plans";

type SortOrder = "asc" | "desc";

type SortKey =
  | "name"
  | "isin"
  | "ter"
  | `performance:${PerformanceKey}`
  | `sharpe:${RatioPeriod}`
  | `volatility:${RatioPeriod}`;

type SortConfig = { key: SortKey; order: SortOrder };

function isPerformanceOrSharpeSortKey(key: SortKey) {
  return key.startsWith("performance:") || key.startsWith("sharpe:");
}

const TEXTS = {
  es: {
    title: "Comparativa de Fondos y Planes de Pensiones",
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
    performanceInfo:
      "Las rentabilidades a 3Y, 5Y y 10Y están anualizadas.",
    sharpe: "Ratio Sharpe",
    sharpeInfo:
      "Mide la rentabilidad obtenida por unidad de riesgo asumido; cuanto mayor, mejor.",
    volatility: "Volatilidad",
    volatilityInfo:
      "Indica cuánto fluctúa el valor del fondo en el tiempo; un valor menor implica menos oscilaciones.",
    ter: "TER",
    noData: "Sin datos",
    loading: "Cargando datos...",
    error: "No se han podido cargar los datos. Inténtalo de nuevo más tarde.",
    fundsTitle: "Fondos de Inversión",
    plansTitle: "Planes de Pensiones",
    sectionDescription: "",
    searchPlaceholder: "Buscar...",
    searchAriaLabel: "Buscar en la tabla",
    dataNote:
      "Los datos se obtienen automáticamente de Morningstar cada 4 horas y pueden actualizarse manualmente.",
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
    title: "Fund and Pension Plan Comparison",
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
    performanceInfo:
      "3Y, 5Y and 10Y returns are annualized.",
    sharpe: "Sharpe ratio",
    sharpeInfo:
      "Measures the return earned per unit of risk taken; higher values are better.",
    volatility: "Volatility",
    volatilityInfo:
      "Shows how much the fund value fluctuates over time; lower values mean less variability.",
    ter: "TER",
    noData: "No data",
    loading: "Loading data...",
    error: "Data could not be loaded. Please try again later.",
    fundsTitle: "Mutual Funds",
    plansTitle: "Pension Plans",
    sectionDescription: "",
    searchPlaceholder: "Search...",
    searchAriaLabel: "Search within the table",
    dataNote:
      "Data is automatically retrieved from Morningstar every 4 hours and can be refreshed manually.",
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

function InfoTip({
  content,
  label = "Información",
  side = "bottom",
  className = "",
}: {
  content: React.ReactNode;
  label?: string;
  side?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const handleDocument = (event: Event) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleScroll = () => setOpen(false);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleDocument);
    document.addEventListener("touchstart", handleDocument, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleDocument);
      document.removeEventListener("touchstart", handleDocument);
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] align-middle focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
          open ? "border-cyan-400 bg-cyan-50 text-cyan-700" : "border-gray-300 bg-white text-gray-600"
        }`}
      >
        i
      </button>
      {open ? (
        <div
          ref={popoverRef}
          id={id}
          role="tooltip"
          className={`absolute z-50 max-w-[260px] rounded-lg border bg-white p-2 text-xs text-gray-700 shadow-lg ${
            side === "top" ? "bottom-full mb-1 left-1/2 -translate-x-1/2" : "top-full mt-1 left-1/2 -translate-x-1/2"
          }`}
        >
          {content}
        </div>
      ) : null}
    </span>
  );
}

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

function formatNumberForLocale(value: number, lang: Lang, fractionDigits?: number) {
  const digits =
    typeof fractionDigits === "number"
      ? Math.max(0, Math.min(6, Math.trunc(fractionDigits)))
      : undefined;
  const options: Intl.NumberFormatOptions = { useGrouping: false };
  if (digits !== undefined) {
    options.minimumFractionDigits = digits;
    options.maximumFractionDigits = digits;
  } else {
    options.maximumFractionDigits = 6;
  }
  const locale = lang === "es" ? "es-ES" : "en-GB";
  return new Intl.NumberFormat(locale, options).format(value);
}

function formatNumericString(value: string, lang: Lang): string | null {
  const percent = value.includes("%");
  const compact = value.replace(/\s+/g, "");
  const numericPart = compact.replace(/%/g, "");
  const normalized = numericPart.replace(/,/g, ".");
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(normalized)) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const decimalMatch = normalized.match(/\.(\d+)/);
  const fractionDigits = decimalMatch ? Math.min(decimalMatch[1].length, 6) : undefined;
  const formattedNumber = formatNumberForLocale(parsed, lang, fractionDigits);
  return percent ? `${formattedNumber}%` : formattedNumber;
}

function formatValue(raw?: MetricValue, lang: Lang = "es"): string {
  if (raw === null || raw === undefined) return "-";
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return "-";
    return formatNumberForLocale(raw, lang);
  }
  if (typeof raw === "string") {
    const val = raw.trim();
    if (!val || val.toUpperCase() === "N/A" || val === "NaN") return "-";
    const numericFormatted = formatNumericString(val, lang);
    return numericFormatted ?? val;
  }
  if (typeof raw === "object") {
    const nested =
      ("value" in raw ? raw.value : undefined) ??
      ("label" in raw ? raw.label : undefined);
    return formatValue(nested as MetricValue, lang);
  }
  return "-";
}

function metricValueMatches(raw: MetricValue | undefined, query: string): boolean {
  if (raw === null || raw === undefined) return false;
  if (typeof raw === "object") {
    return (
      metricValueMatches((raw as { value?: MetricValue }).value, query) ||
      metricValueMatches((raw as { label?: MetricValue }).label, query)
    );
  }
  return String(raw).toLowerCase().includes(query);
}

function rowMatchesQuery(row: FundRow, query: string): boolean {
  const baseValues: (MetricValue | undefined)[] = [
    row.name,
    row.isin,
    row.category,
    row.comment,
    row.morningstarId,
    row.morningstarRating,
    row.ter,
    row.url,
  ];

  if (typeof row.indexed === "boolean") {
    baseValues.push(row.indexed ? "index indexado indexed" : "active activa");
  }

  const metricValues: MetricValue[] = [
    ...Object.values(row.performance ?? {}),
    ...Object.values(row.sharpe ?? {}),
    ...Object.values(row.volatility ?? {}),
  ];

  return [...baseValues, ...metricValues].some((value) => metricValueMatches(value, query));
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
const COLOR_SHARPE_NEGATIVE: RGB = { r: 248, g: 113, b: 113 };
const COLOR_SHARPE_POSITIVE: RGB = { r: 52, g: 211, b: 153 };
const COLOR_SHARPE_NEUTRAL: RGB = { r: 209, g: 213, b: 219 };
const COLOR_VOLATILITY_LOW: RGB = { r: 16, g: 185, b: 129 };
const COLOR_VOLATILITY_NEUTRAL: RGB = { r: 226, g: 232, b: 240 };
const COLOR_VOLATILITY_HIGH: RGB = { r: 220, g: 38, b: 38 };
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

function getPerformanceBackground(value: number | null, stats: ColumnStats): string | undefined {
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
    const ratio = value / minNegative;
    const blended = blendColors(COLOR_NEUTRAL, COLOR_NEGATIVE, ratio);
    return colorToRgba(blended);
  }

  return undefined;
}

const SHARPE_LOW_THRESHOLD = 0.5;
const SHARPE_HIGH_THRESHOLD = 0.9;

function getSharpeBackground(value: number | null, stats: ColumnStats): string | undefined {
  if (value === null || Number.isNaN(value)) return undefined;
  if (value < SHARPE_LOW_THRESHOLD) {
    const minBound = Math.min(stats.min ?? value, value);
    const range = Math.max(SHARPE_LOW_THRESHOLD - minBound, ZERO_TOLERANCE);
    const ratio = Math.min(1, (SHARPE_LOW_THRESHOLD - value) / range);
    const blended = blendColors(COLOR_SHARPE_NEUTRAL, COLOR_SHARPE_NEGATIVE, ratio);
    return colorToRgba(blended);
  }
  if (value <= SHARPE_HIGH_THRESHOLD) {
    return colorToRgba(COLOR_SHARPE_NEUTRAL, 0.55);
  }
  const maxBound = Math.max(stats.max ?? value, value);
  const range = Math.max(maxBound - SHARPE_HIGH_THRESHOLD, ZERO_TOLERANCE);
  const ratio = Math.min(1, (value - SHARPE_HIGH_THRESHOLD) / range);
  const blended = blendColors(COLOR_SHARPE_NEUTRAL, COLOR_SHARPE_POSITIVE, ratio);
  return colorToRgba(blended);
}

function getVolatilityBackground(
  value: number | null,
  stats: ColumnStats,
): string | undefined {
  if (value === null || Number.isNaN(value)) return undefined;
  const min = stats.min ?? value;
  const max = stats.max ?? value;
  if (min === null || max === null) {
    return undefined;
  }
  if (Math.abs(max - min) <= ZERO_TOLERANCE) {
    return colorToRgba(COLOR_VOLATILITY_NEUTRAL, 0.45);
  }
  const mid = min + (max - min) / 2;
  if (value <= mid) {
    const range = Math.max(mid - min, ZERO_TOLERANCE);
    const ratio = Math.min(1, (value - min) / range);
    const blended = blendColors(COLOR_VOLATILITY_LOW, COLOR_VOLATILITY_NEUTRAL, ratio);
    const alpha = 0.55 + (1 - ratio) * 0.27;
    return colorToRgba(blended, alpha);
  }
  const range = Math.max(max - mid, ZERO_TOLERANCE);
  const ratio = Math.min(1, (value - mid) / range);
  const blended = blendColors(COLOR_VOLATILITY_NEUTRAL, COLOR_VOLATILITY_HIGH, ratio);
  const alpha = 0.55 + ratio * 0.27;
  return colorToRgba(blended, alpha);
}

function getMetricBackground(
  metric: MetricAccessor,
  value: number | null,
  stats: ColumnStats,
): string | undefined {
  switch (metric) {
    case "performance":
      return getPerformanceBackground(value, stats);
    case "sharpe":
      return getSharpeBackground(value, stats);
    case "volatility":
      return getVolatilityBackground(value, stats);
    default:
      return undefined;
  }
}

type CellRenderOptions = {
  metric: MetricAccessor;
  addLeftBoundary?: boolean;
};

function renderMetricCells<T extends string>(
  columns: readonly T[],
  values: MetricRecord<T>,
  keyPrefix: string,
  stats: ColumnStatsMap<T> | undefined,
  options: CellRenderOptions,
  lang: Lang,
) {
  return columns.map((label) => {
    const numericValue = getMetricNumber(values[label]);
    const columnStats = stats?.[label];
    const background = columnStats
      ? getMetricBackground(options.metric, numericValue, columnStats)
      : undefined;
    const classes = [
      "px-1.5 py-2 text-sm font-semibold text-gray-700 text-center align-middle",
    ];
    if (options.addLeftBoundary && columns[0] === label) {
      classes.push("border-l", "border-gray-400");
    }
    return (
      <td
        key={`${keyPrefix}-${label}`}
        className={classes.join(" ")}
        style={background ? { backgroundColor: background } : undefined}
      >
        {formatValue(values[label], lang)}
      </td>
    );
  });
}

type SortValue =
  | { type: "number"; value: number | null }
  | { type: "text"; value: string | null };

function getSortValue(row: FundRow, key: SortKey): SortValue {
  if (key === "name") {
    return { type: "text", value: row.name ?? null };
  }
  if (key === "isin") {
    return { type: "text", value: row.isin ?? null };
  }
  if (key === "ter") {
    return { type: "number", value: getMetricNumber(row.ter) };
  }

  const [metric, label] = key.split(":") as ["performance" | "sharpe" | "volatility", string];
  if (metric === "performance") {
    return {
      type: "number",
      value: getMetricNumber((row.performance ?? {})[label as PerformanceKey]),
    };
  }
  if (metric === "sharpe") {
    return {
      type: "number",
      value: getMetricNumber((row.sharpe ?? {})[label as RatioPeriod]),
    };
  }
  if (metric === "volatility") {
    return {
      type: "number",
      value: getMetricNumber((row.volatility ?? {})[label as RatioPeriod]),
    };
  }

  return { type: "text", value: null };
}

function SortControl({
  activeOrder,
  label,
  lang,
  onChange,
}: {
  activeOrder: SortOrder | null;
  label: string;
  lang: Lang;
  onChange: (order: SortOrder | null) => void;
}) {
  const ascActive = activeOrder === "asc";
  const descActive = activeOrder === "desc";
  const ascLabel =
    lang === "es"
      ? `Orden ascendente por ${label}`
      : `Sort ascending by ${label}`;
  const descLabel =
    lang === "es"
      ? `Orden descendente por ${label}`
      : `Sort descending by ${label}`;

  return (
    <span className="ml-1 flex flex-col items-center justify-center gap-0.5">
      <button
        type="button"
        aria-label={ascLabel}
        aria-pressed={ascActive}
        className={`group inline-flex h-3 w-3 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
          ascActive ? "text-cyan-600" : "text-gray-300 hover:text-gray-500"
        }`}
        onClick={() => onChange(ascActive ? null : "asc")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-2.5 w-2.5"
        >
          <path d="M6 14L12 8l6 6" />
        </svg>
      </button>
      <button
        type="button"
        aria-label={descLabel}
        aria-pressed={descActive}
        className={`group inline-flex h-3 w-3 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
          descActive ? "text-cyan-600" : "text-gray-300 hover:text-gray-500"
        }`}
        onClick={() => onChange(descActive ? null : "desc")}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-2.5 w-2.5"
        >
          <path d="M6 10l6 6 6-6" />
        </svg>
      </button>
    </span>
  );
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
  searchQuery,
  onSearchChange,
  showSearchInput = false,
}: {
  section: TableSection;
  data: FundRow[];
  texts: Record<TextKey, string>;
  lang: Lang;
  searchQuery: string;
  onSearchChange?: (value: string) => void;
  showSearchInput?: boolean;
}) {
  const title = section === "funds" ? texts.fundsTitle : texts.plansTitle;
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const filteredData = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return data;
    return data.filter((row) => rowMatchesQuery(row, normalized));
  }, [data, searchQuery]);

  const performanceStats = useMemo(
    () => collectColumnStats(filteredData, "performance", PERFORMANCE_LABELS),
    [filteredData],
  );
  const sharpeStats = useMemo(
    () => collectColumnStats(filteredData, "sharpe", RATIO_LABELS),
    [filteredData],
  );
  const volatilityStats = useMemo(
    () => collectColumnStats(filteredData, "volatility", RATIO_LABELS),
    [filteredData],
  );

  const commentColumnWidthClass =
    section === "plans"
      ? "min-w-[320px] sm:min-w-[380px]"
      : "min-w-[160px]";

  const sortedData = useMemo(() => {
    if (!sortConfig) {
      return filteredData;
    }

    const sorted = [...filteredData];
    const locale = lang === "es" ? "es" : "en";
    const multiplier = sortConfig.order === "asc" ? 1 : -1;
    const missingIsLowestInDesc =
      sortConfig.order === "desc" && isPerformanceOrSharpeSortKey(sortConfig.key);

    sorted.sort((a, b) => {
      const valueA = getSortValue(a, sortConfig.key);
      const valueB = getSortValue(b, sortConfig.key);
      const rawA = valueA.value;
      const rawB = valueB.value;

      const isNullA = rawA === null || rawA === undefined || rawA === "";
      const isNullB = rawB === null || rawB === undefined || rawB === "";

      if (isNullA && isNullB) return 0;
      if (isNullA) {
        if (missingIsLowestInDesc && valueA.type === "number") {
          return 1;
        }
        return 1 * multiplier;
      }
      if (isNullB) {
        if (missingIsLowestInDesc && valueB.type === "number") {
          return -1;
        }
        return -1 * multiplier;
      }

      if (valueA.type === "number" && valueB.type === "number") {
        const diff = (rawA as number) - (rawB as number);
        if (Math.abs(diff) <= ZERO_TOLERANCE) {
          return 0;
        }
        return diff > 0 ? 1 * multiplier : -1 * multiplier;
      }

      const textA = String(rawA);
      const textB = String(rawB);
      const comparison = textA.localeCompare(textB, locale, {
        sensitivity: "base",
        numeric: true,
      });
      if (comparison === 0) {
        return 0;
      }
      return comparison > 0 ? 1 * multiplier : -1 * multiplier;
    });

    return sorted;
  }, [filteredData, lang, sortConfig]);

  const handleToggleTooltip = (id: string) => {
    setOpenTooltipId((prev) => (prev === id ? null : id));
  };

  const handleOpenTooltip = (id: string) => {
    setOpenTooltipId(id);
  };

  const handleCloseTooltip = (id: string) => {
    setOpenTooltipId((prev) => (prev === id ? null : prev));
  };

  const handleSortChange = (key: SortKey, order: SortOrder | null) => {
    setSortConfig((prev) => {
      if (order === null) {
        if (prev?.key === key) {
          return null;
        }
        return prev;
      }
      if (prev?.key === key && prev.order === order) {
        return prev;
      }
      return { key, order };
    });
  };

  return (
    <section className="mt-10 sm:mt-12">
      <div
        className={`mb-6 flex flex-col gap-3 ${
          showSearchInput ? "sm:flex-row sm:items-center sm:justify-between" : ""
        }`}
      >
        <div className="space-y-1">
          <h2 className="text-xl md:text-2xl font-semibold text-gray-900">{title}</h2>
          {texts.sectionDescription ? (
            <p className="text-sm text-gray-600 max-w-3xl">{texts.sectionDescription}</p>
          ) : null}
        </div>
        {showSearchInput ? (
          <div className="relative w-full sm:w-60 md:w-72 lg:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder={texts.searchPlaceholder}
              aria-label={texts.searchAriaLabel}
              className="w-full rounded-xl border border-gray-300 bg-white/80 py-2 pl-3 pr-10 text-sm text-gray-700 placeholder:text-gray-400 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-4.35-4.35m0 0a7.5 7.5 0 1 0-10.607-10.607 7.5 7.5 0 0 0 10.607 10.607z"
              />
            </svg>
          </div>
        ) : null}
      </div>
      <div className="-mx-4 overflow-x-auto pb-4 sm:mx-0">
        <table className="w-full border-separate border-spacing-y-1 border-spacing-x-0.5 text-sm text-gray-800">
          <thead>
            <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <th
                rowSpan={2}
                className="px-3 py-2 max-w-[320px] bg-white/70 text-center rounded-tl-2xl"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{texts.name}</span>
                  <SortControl
                    lang={lang}
                    label={texts.name}
                    activeOrder={sortConfig?.key === "name" ? sortConfig.order : null}
                    onChange={(order) => handleSortChange("name", order)}
                  />
                </div>
              </th>
              <th
                rowSpan={2}
                className="px-2.5 py-2 whitespace-nowrap bg-white/70 text-center"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{texts.isin}</span>
                  <SortControl
                    lang={lang}
                    label={texts.isin}
                    activeOrder={sortConfig?.key === "isin" ? sortConfig.order : null}
                    onChange={(order) => handleSortChange("isin", order)}
                  />
                </div>
              </th>
              <th
                rowSpan={2}
                className="px-1.5 py-2 whitespace-nowrap bg-white/70 text-center"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{texts.ter}</span>
                  <SortControl
                    lang={lang}
                    label={texts.ter}
                    activeOrder={sortConfig?.key === "ter" ? sortConfig.order : null}
                    onChange={(order) => handleSortChange("ter", order)}
                  />
                </div>
              </th>
              <th
                colSpan={PERFORMANCE_LABELS.length}
                className="relative px-2.5 py-2 bg-white/70 text-center border-l border-gray-400"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{texts.performance}</span>
                  <InfoTip content={texts.performanceInfo} label={texts.performance} />
                </div>
              </th>
              <th
                colSpan={RATIO_LABELS.length}
                className="relative px-2.5 py-2 bg-white/70 text-center border-l border-gray-400"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{texts.sharpe}</span>
                  <InfoTip content={texts.sharpeInfo} label={texts.sharpe} />
                </div>
              </th>
              <th
                colSpan={RATIO_LABELS.length}
                className="relative px-2.5 py-2 bg-white/70 text-center border-l border-gray-400"
              >
                <div className="flex items-center justify-center gap-1">
                  <span>{texts.volatility}</span>
                  <InfoTip content={texts.volatilityInfo} label={texts.volatility} />
                </div>
              </th>
              <th
                rowSpan={2}
                className={`px-3 py-2 bg-white/70 text-center rounded-tr-2xl ${commentColumnWidthClass}`}
              >
                {texts.comment}
              </th>
            </tr>
            <tr className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {PERFORMANCE_LABELS.map((label, index) => (
                <th
                  key={`perf-${label}`}
                  className={`px-1.5 py-1.5 bg-white/70 text-center ${
                    index === 0 ? "border-l border-gray-400" : ""
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{displayMetricLabel(label)}</span>
                    <SortControl
                      lang={lang}
                      label={`${texts.performance} ${displayMetricLabel(label)}`}
                      activeOrder={
                        sortConfig?.key === `performance:${label}`
                          ? sortConfig.order
                          : null
                      }
                      onChange={(order) =>
                        handleSortChange(`performance:${label}` as SortKey, order)
                      }
                    />
                  </div>
                </th>
              ))}
              {RATIO_LABELS.map((label, index) => (
                <th
                  key={`sharpe-${label}`}
                  className={`px-1.5 py-1.5 bg-white/70 text-center ${
                    index === 0 ? "border-l border-gray-400" : ""
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{displayMetricLabel(label)}</span>
                    <SortControl
                      lang={lang}
                      label={`${texts.sharpe} ${displayMetricLabel(label)}`}
                      activeOrder={
                        sortConfig?.key === `sharpe:${label}`
                          ? sortConfig.order
                          : null
                      }
                      onChange={(order) =>
                        handleSortChange(`sharpe:${label}` as SortKey, order)
                      }
                    />
                  </div>
                </th>
              ))}
              {RATIO_LABELS.map((label, index) => (
                <th
                  key={`vol-${label}`}
                  className={`px-1.5 py-1.5 bg-white/70 text-center ${
                    index === 0 ? "border-l border-gray-400" : ""
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{displayMetricLabel(label)}</span>
                    <SortControl
                      lang={lang}
                      label={`${texts.volatility} ${displayMetricLabel(label)}`}
                      activeOrder={
                        sortConfig?.key === `volatility:${label}`
                          ? sortConfig.order
                          : null
                      }
                      onChange={(order) =>
                        handleSortChange(`volatility:${label}` as SortKey, order)
                      }
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.length === 0 ? (
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
              sortedData.map((row) => {
                const stars = renderStars(row.morningstarRating);
                const categoryValue = formatValue(row.category, lang);
                const rowKey = row.morningstarId || row.isin || row.name;
                const badges = getCategoryBadges(categoryValue, lang, row.indexed);
                const tooltipId = `${section}-${rowKey}`;
                const tooltipOpen = openTooltipId === tooltipId;
                const categoryDisplay = categoryValue !== "-" ? categoryValue : texts.noData;
                const link = getMorningstarUrl(row.morningstarId, lang) ?? row.url ?? undefined;
                const tooltipLabel =
                  categoryDisplay && categoryDisplay !== texts.noData
                    ? categoryDisplay
                    : texts.noData;
                return (
                  <tr key={tooltipId} className="align-middle">
                    <td
                      className={`relative px-3 py-2 bg-white/95 backdrop-blur max-w-[320px] overflow-visible align-top ${
                        tooltipOpen ? "z-20" : ""
                      }`}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-cyan-600 hover:text-cyan-700 leading-tight"
                          title={row.name}
                        >
                          {row.name}
                        </a>
                        {(badges.length > 0 || stars) && (
                          <div className="flex w-full items-center gap-1">
                            {stars ? (
                              <span
                                className="inline-flex shrink-0 items-center text-xs font-semibold leading-none text-amber-500"
                                aria-label={`${stars.length} estrellas Morningstar`}
                              >
                                {stars}
                              </span>
                            ) : null}
                            {badges.length > 0 ? (
                              <div
                                className={`relative group ${stars ? "ml-auto" : ""}`}
                                onMouseEnter={() => handleOpenTooltip(tooltipId)}
                                onMouseLeave={() => handleCloseTooltip(tooltipId)}
                              >
                                <button
                                  type="button"
                                  className="inline-flex flex-nowrap items-center gap-1 rounded-md bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
                                  onClick={() => handleToggleTooltip(tooltipId)}
                                  onBlur={() => handleCloseTooltip(tooltipId)}
                                  onFocus={() => handleOpenTooltip(tooltipId)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                      event.stopPropagation();
                                      handleCloseTooltip(tooltipId);
                                    }
                                  }}
                                  aria-haspopup="true"
                                  aria-expanded={tooltipOpen}
                                  aria-label={
                                    categoryDisplay && categoryDisplay !== texts.noData
                                      ? `${row.name}: ${categoryDisplay}`
                                      : row.name
                                  }
                                  title={tooltipLabel}
                                >
                                  {badges.map((badge) => (
                                    <span
                                      key={`${rowKey}-${badge.text}`}
                                      className={`whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide rounded-lg px-2 py-0.5 border ${
                                        BADGE_STYLES[badge.variant] ?? BADGE_STYLES.default
                                      }`}
                                    >
                                      {badge.text}
                                    </span>
                                  ))}
                                </button>
                                <div
                                  className={`pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max max-w-xs -translate-x-1/2 rounded-md bg-slate-900/95 px-2 py-1 text-xs font-semibold text-white shadow-lg transition-opacity duration-150 ${
                                    tooltipOpen ? "opacity-100" : "opacity-0"
                                  }`}
                                  role="tooltip"
                                >
                                  <span className="block whitespace-nowrap">{tooltipLabel}</span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </td>
                    <td
                      className="px-3 py-2 bg-white/95 backdrop-blur whitespace-nowrap text-gray-600 text-xs sm:text-[13px] align-middle"
                    >
                      {formatValue(row.isin, lang)}
                    </td>
                    <td
                      className="px-1.5 py-2 bg-white/95 backdrop-blur whitespace-nowrap font-semibold text-gray-700 text-center align-middle"
                    >
                      {formatValue(row.ter, lang)}
                    </td>
                    {renderMetricCells(
                      PERFORMANCE_LABELS,
                      row.performance,
                      "perf",
                      performanceStats,
                      { metric: "performance", addLeftBoundary: true },
                      lang,
                    )}
                    {renderMetricCells(RATIO_LABELS, row.sharpe, "sharpe", sharpeStats, {
                      metric: "sharpe",
                      addLeftBoundary: true,
                    }, lang)}
                    {renderMetricCells(
                      RATIO_LABELS,
                      row.volatility,
                      "vol",
                      volatilityStats,
                      { metric: "volatility", addLeftBoundary: true },
                      lang,
                    )}
                    <td
                      className={`px-3 py-2 bg-white/95 backdrop-blur text-gray-600 text-xs sm:text-[13px] leading-snug align-middle ${commentColumnWidthClass}`}
                    >
                      {formatValue(row.comment, lang) || texts.commentPlaceholder}
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
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [shouldAutoRefresh, setShouldAutoRefresh] = useState<boolean | null>(
    null,
  );
  const dataRef = useRef<ApiPayload | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const fetchData = useCallback(async (force = false) => {
    const hasExistingData = Boolean(dataRef.current);
    setStatus((prev) => {
      if (force && hasExistingData) {
        return "refreshing";
      }
      if (prev === "ready" && hasExistingData) {
        return prev;
      }
      return "loading";
    });
    setError(null);
    setUsingMockData((prev) => (hasExistingData ? prev : false));
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
        throw new SyntaxError(
          (jsonErr as Error).message || "Invalid JSON response",
        );
      }
      setData(payload);
      dataRef.current = payload;
      setUsingMockData(false);
      setStatus("ready");
    } catch (err) {
      console.error(err);
      if (shouldUseMockData(err)) {
        setData(MOCK_PAYLOAD);
        dataRef.current = MOCK_PAYLOAD;
        setStatus("ready");
        setUsingMockData(true);
        return;
      }
      setError((err as Error).message);
      setStatus(hasExistingData ? "ready" : "error");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      setShouldAutoRefresh(false);
      return;
    }
    const trimmedPath = window.location.pathname.replace(/\/+$/, "");
    setShouldAutoRefresh(trimmedPath.endsWith("/refrescardatos_dragner"));
  }, []);

  useEffect(() => {
    if (shouldAutoRefresh === null) return;

    const run = async () => {
      if (shouldAutoRefresh) {
        await fetchData();
        await fetchData(true);
        if (typeof window !== "undefined") {
          const basePath = window.location.pathname.replace(
            /\/refrescardatos_dragner\/?$/,
            "/",
          );
          window.history.replaceState(null, "", basePath || "/");
        }
      } else {
        await fetchData();
      }
    };

    void run();
  }, [fetchData, shouldAutoRefresh]);

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

      <div className="bg-white/85 backdrop-blur border-b border-gray-200">
        <div className="max-w-[min(96vw,1600px)] mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline"
            >
              <span aria-hidden="true">←</span>
              {texts.back}
            </a>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold">{texts.title}</h1>
              <p className="mt-1 text-sm md:text-base text-gray-700 max-w-4xl">
                {texts.subtitle}
              </p>
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
            </div>
            {(status === "ready" || status === "refreshing") && data && (
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

      <main className="max-w-[min(96vw,1600px)] mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {(status === "loading" || status === "refreshing") && (
          <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-gray-600 shadow-sm backdrop-blur">
            {status === "refreshing" ? texts.refreshing : texts.loading}
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {texts.error}
            {error ? ` (${error})` : null}
          </div>
        )}

        {data && (status === "ready" || status === "refreshing") && (
          <div className="space-y-12 pb-12">
            <Section
              section="funds"
              data={data.funds}
              texts={texts}
              lang={lang}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              showSearchInput
            />
            <Section
              section="plans"
              data={data.plans}
              texts={texts}
              lang={lang}
              searchQuery={searchQuery}
            />
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
