import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "./index.css";
import { MOCK_PAYLOAD } from "./mockData";

type Lang = "es" | "en";
type ThemeMode = "light" | "dark";

const LANG_STORAGE_KEY = "finanzas.lang";
const THEME_STORAGE_KEY = "finanzas.theme";

const getStoredLang = (): Lang => {
  if (typeof window === "undefined") {
    return "es";
  }
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  return stored === "en" ? "en" : "es";
};

const getStoredThemeChoice = (): ThemeMode | null => {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
};

const resolveTheme = (themeChoice: ThemeMode | null): ThemeMode => {
  if (themeChoice) {
    return themeChoice;
  }
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

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
  inPortfolio?: boolean;
  performance: MetricRecord<PerformanceKey>;
  sharpe: MetricRecord<RatioPeriod>;
  volatility: MetricRecord<RatioPeriod>;
  ter: MetricValue;
};

export type ApiPayload = {
  lastUpdated: string;
  funds: FundRow[];
  plans: FundRow[];
  isUpdating?: boolean;
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
    dataNote: "",
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
    dataNote: "",
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
const TER_COLUMN_WIDTH_CLASS = "w-[52px] sm:w-[60px]";
const METRIC_COLUMN_WIDTH_CLASS = "w-[58px] sm:w-[66px]";

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
  const [popoverPosition, setPopoverPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
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

  const updatePopoverPosition = useCallback(() => {
    if (!open || !buttonRef.current || !popoverRef.current) {
      return;
    }

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();

    const gap = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left =
      buttonRect.left +
      buttonRect.width / 2 -
      popoverRect.width / 2;

    left = Math.max(gap, Math.min(left, viewportWidth - popoverRect.width - gap));

    let top =
      side === "top"
        ? buttonRect.top - popoverRect.height - gap
        : buttonRect.bottom + gap;

    top = Math.max(gap, Math.min(top, viewportHeight - popoverRect.height - gap));

    setPopoverPosition({ top, left });
  }, [open, side]);

  useLayoutEffect(() => {
    if (!open) return;

    const frame = requestAnimationFrame(() => {
      updatePopoverPosition();
    });

    window.addEventListener("resize", updatePopoverPosition);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePopoverPosition);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) {
      setPopoverPosition(null);
    }
  }, [open]);

  const wrapperClassName = `relative inline-flex ${open ? "z-50" : ""} ${className}`.trim();

  return (
    <span className={wrapperClassName}>
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
      {open
        ? createPortal(
            <div
              ref={popoverRef}
              id={id}
              role="tooltip"
              style={{
                position: "fixed",
                top: popoverPosition?.top ?? -9999,
                left: popoverPosition?.left ?? -9999,
                opacity: popoverPosition ? 1 : 0,
              }}
              className="z-50 max-w-[260px] rounded-lg border bg-white p-2 text-xs text-gray-700 shadow-lg"
            >
              {content}
            </div>,
            document.body,
          )
        : null}
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

const numberFormatterCache = new Map<string, Intl.NumberFormat>();

function formatNumberForLocale(value: number, lang: Lang, fractionDigits?: number) {
  const digits =
    typeof fractionDigits === "number"
      ? Math.max(0, Math.min(6, Math.trunc(fractionDigits)))
      : undefined;
  const locale = lang === "es" ? "es-ES" : "en-GB";
  const cacheKey = `${locale}:${digits ?? "auto"}`;
  let formatter = numberFormatterCache.get(cacheKey);
  if (!formatter) {
    const options: Intl.NumberFormatOptions = { useGrouping: false };
    if (digits !== undefined) {
      options.minimumFractionDigits = digits;
      options.maximumFractionDigits = digits;
    } else {
      options.maximumFractionDigits = 6;
    }
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatterCache.set(cacheKey, formatter);
  }
  return formatter.format(value);
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

const primitiveFormatCache = new Map<string, string>();
const objectFormatCache = new WeakMap<object, Map<Lang, string>>();

function formatValue(raw?: MetricValue, lang: Lang = "es"): string {
  if (raw === null || raw === undefined) return "-";
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return "-";
    const key = `number:${lang}:${raw}`;
    const cached = primitiveFormatCache.get(key);
    if (cached !== undefined) return cached;
    const formatted = formatNumberForLocale(raw, lang);
    primitiveFormatCache.set(key, formatted);
    return formatted;
  }
  if (typeof raw === "string") {
    const val = raw.trim();
    const key = `string:${lang}:${val}`;
    const cached = primitiveFormatCache.get(key);
    if (cached !== undefined) return cached;
    if (!val || val.toUpperCase() === "N/A" || val === "NaN") {
      primitiveFormatCache.set(key, "-");
      return "-";
    }
    const numericFormatted = formatNumericString(val, lang);
    const result = numericFormatted ?? val;
    primitiveFormatCache.set(key, result);
    return result;
  }
  if (typeof raw === "object") {
    const existing = objectFormatCache.get(raw as object);
    const cached = existing?.get(lang);
    if (cached !== undefined) return cached;
    const nested =
      ("value" in raw ? raw.value : undefined) ??
      ("label" in raw ? raw.label : undefined);
    const result = formatValue(nested as MetricValue, lang);
    if (existing) {
      existing.set(lang, result);
    } else {
      objectFormatCache.set(raw as object, new Map<Lang, string>([[lang, result]]));
    }
    return result;
  }
  return "-";
}

const metricNumberPrimitiveCache = new Map<string, number | null>();
const metricNumberObjectCache = new WeakMap<object, number | null>();

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
    const trimmed = raw.trim();
    const key = trimmed;
    if (metricNumberPrimitiveCache.has(key)) {
      return metricNumberPrimitiveCache.get(key) ?? null;
    }
    const cleaned = trimmed.replace(/[%\s]/g, "").replace(/,/g, ".");
    if (!cleaned) {
      metricNumberPrimitiveCache.set(key, null);
      return null;
    }
    const parsed = Number.parseFloat(cleaned);
    const result = Number.isFinite(parsed) ? parsed : null;
    metricNumberPrimitiveCache.set(key, result);
    return result;
  }
  if (typeof raw === "object") {
    if (metricNumberObjectCache.has(raw as object)) {
      return metricNumberObjectCache.get(raw as object) ?? null;
    }
    let result: number | null = null;
    if ("value" in raw && raw.value !== undefined) {
      result = getMetricNumber(raw.value as MetricValue);
    }
    if (result === null && "label" in raw && raw.label !== undefined) {
      result = getMetricNumber(raw.label as MetricValue);
    }
    metricNumberObjectCache.set(raw as object, result);
    return result;
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
  rowGroups: readonly FundRow[][],
  accessor: MetricAccessor,
  labels: readonly T[],
): ColumnStatsMap<T> {
  const stats = {} as ColumnStatsMap<T>;
  for (const label of labels) {
    stats[label] = { min: null, max: null, maxPositive: null, minNegative: null };
  }

  for (const rows of rowGroups) {
    for (const row of rows) {
      const record = row[accessor] as MetricRecord<T> | undefined;
      if (!record) continue;

      for (const label of labels) {
        const value = getMetricNumber(record[label]);
        if (value === null) continue;
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
      }
    }
  }

  return stats;
}

const SEARCH_INDEX_CACHE = new WeakMap<FundRow, string>();

function collectSearchTokens(value: MetricValue | undefined, tokens: string[]): void {
  if (value === null || value === undefined) return;
  if (typeof value === "object") {
    if ("value" in value) collectSearchTokens(value.value as MetricValue, tokens);
    if ("label" in value) collectSearchTokens(value.label as MetricValue, tokens);
    return;
  }
  tokens.push(String(value));
}

function getSearchIndex(row: FundRow): string {
  const cached = SEARCH_INDEX_CACHE.get(row);
  if (cached) return cached;

  const tokens: string[] = [];
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

  for (const value of baseValues) {
    collectSearchTokens(value, tokens);
  }

  if (typeof row.indexed === "boolean") {
    tokens.push(row.indexed ? "index indexado indexed" : "active activa");
  }

  const metricGroups = [row.performance ?? {}, row.sharpe ?? {}, row.volatility ?? {}];
  for (const group of metricGroups) {
    for (const value of Object.values(group)) {
      collectSearchTokens(value, tokens);
    }
  }

  const normalized = Array.from(
    new Set(
      tokens
        .map((token) => token.trim().toLowerCase())
        .filter((token) => token.length > 0),
    ),
  ).join(" ");

  SEARCH_INDEX_CACHE.set(row, normalized);
  return normalized;
}

function rowMatchesQuery(row: FundRow, query: string): boolean {
  if (!query) return true;
  const index = getSearchIndex(row);
  return index.includes(query);
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
      "px-1 py-1.5 text-[11px] sm:text-xs font-semibold text-gray-700 text-center align-middle",
      METRIC_COLUMN_WIDTH_CLASS,
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

function sortRows(
  rows: FundRow[],
  sortConfig: SortConfig | null,
  lang: Lang,
): FundRow[] {
  if (!sortConfig) {
    return rows;
  }

  const sorted = [...rows];
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
  active: "bg-slate-100/80 text-[#334155] border border-slate-200",
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


function CombinedTable({
  funds,
  plans,
  texts,
  lang,
  searchQuery,
  onSearchChange,
  showSearchInput = false,
}: {
  funds: FundRow[];
  plans: FundRow[];
  texts: Record<TextKey, string>;
  lang: Lang;
  searchQuery: string;
  onSearchChange?: (value: string) => void;
  showSearchInput?: boolean;
}) {
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const normalizedQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery],
  );

  const filteredFunds = useMemo(() => {
    if (!normalizedQuery) return funds;
    return funds.filter((row) => rowMatchesQuery(row, normalizedQuery));
  }, [funds, normalizedQuery]);

  const filteredPlans = useMemo(() => {
    if (!normalizedQuery) return plans;
    return plans.filter((row) => rowMatchesQuery(row, normalizedQuery));
  }, [plans, normalizedQuery]);

  const performanceStats = useMemo(
    () =>
      collectColumnStats(
        [filteredFunds, filteredPlans],
        "performance",
        PERFORMANCE_LABELS,
      ),
    [filteredFunds, filteredPlans],
  );
  const sharpeStats = useMemo(
    () => collectColumnStats([filteredFunds, filteredPlans], "sharpe", RATIO_LABELS),
    [filteredFunds, filteredPlans],
  );
  const volatilityStats = useMemo(
    () => collectColumnStats([filteredFunds, filteredPlans], "volatility", RATIO_LABELS),
    [filteredFunds, filteredPlans],
  );

  const sortedFunds = useMemo(
    () => sortRows(filteredFunds, sortConfig, lang),
    [filteredFunds, lang, sortConfig],
  );
  const sortedPlans = useMemo(
    () => sortRows(filteredPlans, sortConfig, lang),
    [filteredPlans, lang, sortConfig],
  );

  const sections = useMemo(
    () =>
      [
        { key: "funds" as TableSection, title: texts.fundsTitle, rows: sortedFunds },
        { key: "plans" as TableSection, title: texts.plansTitle, rows: sortedPlans },
      ].filter((section) => section.rows.length > 0),
    [sortedFunds, sortedPlans, texts.fundsTitle, texts.plansTitle],
  );

  const visibleRowCount = useMemo(
    () => sections.reduce((total, section) => total + section.rows.length, 0),
    [sections],
  );

  const totalColumns =
    2 + PERFORMANCE_LABELS.length + RATIO_LABELS.length * 2 + 2;
  const commentColumnWidthClass = "min-w-[272px] sm:min-w-[323px]";

  const handleToggleTooltip = useCallback((id: string) => {
    setOpenTooltipId((prev) => (prev === id ? null : id));
  }, []);
  const handleOpenTooltip = useCallback((id: string) => {
    setOpenTooltipId(id);
  }, []);
  const handleCloseTooltip = useCallback((id: string) => {
    setOpenTooltipId((prev) => (prev === id ? null : prev));
  }, []);

  const handleSortChange = useCallback((key: SortKey, order: SortOrder | null) => {
    setSortConfig((prev) => {
      if (!order) {
        if (!prev) return null;
        if (prev.key === key) return null;
        return prev;
      }
      if (prev?.key === key && prev.order === order) {
        return prev;
      }
      return { key, order };
    });
  }, []);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange?.(event.target.value);
    },
    [onSearchChange],
  );

  return (
    <section className="mt-6 sm:mt-8">
      <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-4 sm:p-6 lg:p-8 shadow-xl backdrop-blur">
        {showSearchInput ? (
          <div className="mb-6">
            <div className="relative w-full max-w-xs sm:max-w-sm md:max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={texts.searchPlaceholder}
                aria-label={texts.searchAriaLabel}
                className="w-full rounded-2xl border border-slate-300/80 bg-white/90 py-2.5 pl-3.5 pr-10 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              />
              <svg
                className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
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
          </div>
        ) : null}
        <div className="overflow-x-auto pb-4">
          <table className="w-full border-separate border-spacing-y-1 border-spacing-x-[1px] text-sm text-gray-800">
            <thead className="bg-white/95 backdrop-blur-sm shadow-sm">
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <th
                  rowSpan={2}
                  className="px-3 py-2 max-w-[320px] bg-white/90 backdrop-blur text-center rounded-tl-2xl"
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
                  className="px-2.5 py-2 whitespace-nowrap bg-white/90 backdrop-blur text-center"
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
                  className={`px-1 py-2 whitespace-nowrap bg-white/90 backdrop-blur text-center ${TER_COLUMN_WIDTH_CLASS}`}
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
                  className="relative px-1.5 py-2 bg-white/90 backdrop-blur text-center border-l border-gray-400 overflow-visible"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{texts.performance}</span>
                    <InfoTip content={texts.performanceInfo} label={texts.performance} />
                  </div>
                </th>
                <th
                  colSpan={RATIO_LABELS.length}
                  className="relative px-1.5 py-2 bg-white/90 backdrop-blur text-center border-l border-gray-400 overflow-visible"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{texts.sharpe}</span>
                    <InfoTip content={texts.sharpeInfo} label={texts.sharpe} />
                  </div>
                </th>
                <th
                  colSpan={RATIO_LABELS.length}
                  className="relative px-1.5 py-2 bg-white/90 backdrop-blur text-center border-l border-gray-400 overflow-visible"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{texts.volatility}</span>
                    <InfoTip content={texts.volatilityInfo} label={texts.volatility} />
                  </div>
                </th>
                <th
                  rowSpan={2}
                  className={`px-3 py-2 bg-white/90 backdrop-blur text-center rounded-tr-2xl ${commentColumnWidthClass}`}
                >
                  {texts.comment}
                </th>
              </tr>
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {PERFORMANCE_LABELS.map((label, index) => (
                  <th
                    key={`perf-${label}`}
                    className={`px-1 py-1.5 bg-white/90 backdrop-blur text-center ${
                      index === 0 ? "border-l border-gray-400" : ""
                    } ${METRIC_COLUMN_WIDTH_CLASS}`}
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
                    className={`px-1 py-1.5 bg-white/90 backdrop-blur text-center ${
                      index === 0 ? "border-l border-gray-400" : ""
                    } ${METRIC_COLUMN_WIDTH_CLASS}`}
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
                    className={`px-1 py-1.5 bg-white/90 backdrop-blur text-center ${
                      index === 0 ? "border-l border-gray-400" : ""
                    } ${METRIC_COLUMN_WIDTH_CLASS}`}
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
            {visibleRowCount === 0 ? (
              <tr>
                <td
                  colSpan={totalColumns}
                  className="px-3 py-6 text-center text-sm font-medium text-gray-500 bg-white/90 rounded-b-2xl"
                >
                  {texts.noData}
                </td>
              </tr>
            ) : (
              sections.map((section, sectionIndex) => (
                <React.Fragment key={section.key}>
                  <tr>
                    <td
                      colSpan={totalColumns}
                      className={`px-4 py-3 text-sm font-semibold uppercase tracking-wide bg-slate-800 text-white text-left ${
                        sectionIndex === 0 ? "rounded-t-2xl" : "rounded-2xl"
                      }`}
                    >
                      {section.title}
                    </td>
                  </tr>
                  {section.rows.map((row) => {
                    const stars = renderStars(row.morningstarRating);
                    const categoryValue = formatValue(row.category, lang);
                    const rowKey = row.morningstarId || row.isin || row.name;
                    const badges = getCategoryBadges(
                      categoryValue,
                      lang,
                      row.indexed,
                    );
                    const tooltipId = `${section.key}-${rowKey}`;
                    const tooltipOpen = openTooltipId === tooltipId;
                    const heartTooltipId = `${tooltipId}-heart`;
                    const heartTooltipOpen = openTooltipId === heartTooltipId;
                    const categoryDisplay =
                      categoryValue !== "-" ? categoryValue : texts.noData;
                    const link =
                      getMorningstarUrl(row.morningstarId, lang) ??
                      row.url ??
                      undefined;
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
                            <div className="flex items-center gap-1">
                              <a
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-cyan-600 hover:text-cyan-700 leading-tight"
                                title={row.name}
                              >
                                {row.name}
                              </a>
                              {row.inPortfolio ? (
                                <span
                                  className="relative inline-flex items-center"
                                  onMouseEnter={() => handleOpenTooltip(heartTooltipId)}
                                  onMouseLeave={() => handleCloseTooltip(heartTooltipId)}
                                >
                                  <button
                                    type="button"
                                    className="inline-flex items-center text-[12px] text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 rounded-full"
                                    onClick={() => handleToggleTooltip(heartTooltipId)}
                                    onBlur={() => handleCloseTooltip(heartTooltipId)}
                                    onFocus={() => handleOpenTooltip(heartTooltipId)}
                                    aria-haspopup="true"
                                    aria-expanded={heartTooltipOpen}
                                    aria-label="Fondo en mi cartera personal"
                                  >
                                    <span aria-hidden="true">❤️</span>
                                  </button>
                                  <span className="sr-only">Fondo en mi cartera personal</span>
                                  <span
                                    className={`pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-max -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900/95 px-2 py-1 text-[11px] font-semibold text-white shadow-lg transition-opacity duration-150 ${
                                      heartTooltipOpen ? "opacity-100" : "opacity-0"
                                    }`}
                                    role="tooltip"
                                  >
                                    Fondo en mi cartera personal
                                  </span>
                                </span>
                              ) : null}
                            </div>
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
                                            BADGE_STYLES[badge.variant] ??
                                            BADGE_STYLES.default
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
                          className={`px-1 py-1.5 bg-white/95 backdrop-blur whitespace-nowrap text-[11px] sm:text-xs font-semibold text-gray-700 text-center align-middle ${TER_COLUMN_WIDTH_CLASS}`}
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
                        {renderMetricCells(
                          RATIO_LABELS,
                          row.sharpe,
                          "sharpe",
                          sharpeStats,
                          { metric: "sharpe", addLeftBoundary: true },
                          lang,
                        )}
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
                  })}
                </React.Fragment>
              ))
            )}
            </tbody>
          </table>
      </div>
    </div>
  </section>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5V5" />
      <path d="M12 19v2.5" />
      <path d="M4.9 4.9 6.7 6.7" />
      <path d="M17.3 17.3 19.1 19.1" />
      <path d="M2.5 12H5" />
      <path d="M19 12h2.5" />
      <path d="M4.9 19.1 6.7 17.3" />
      <path d="M17.3 6.7 19.1 4.9" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 14.1A8.8 8.8 0 1 1 9.9 3a7 7 0 0 0 11.1 11.1Z" />
    </svg>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>(getStoredLang);
  const [themeChoice, setThemeChoice] = useState<ThemeMode | null>(getStoredThemeChoice);
  const activeTheme = resolveTheme(themeChoice);
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
  const pendingRefreshTimeoutRef = useRef<number | null>(null);

  const lastUpdatedFormatted =
    (status === "ready" || status === "refreshing") && data
      ? new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(data.lastUpdated))
      : null;

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    }
  }, [lang]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolved = themeChoice ?? (media.matches ? "dark" : "light");
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
    applyTheme();
    if (themeChoice !== null) {
      return;
    }
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themeChoice]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (themeChoice) {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeChoice);
    } else {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, [themeChoice]);

  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        pendingRefreshTimeoutRef.current !== null
      ) {
        window.clearTimeout(pendingRefreshTimeoutRef.current);
      }
    };
  }, []);

  const fetchData = useCallback(async (force = false) => {
    const hasExistingData = Boolean(dataRef.current);
    setStatus(() => (hasExistingData ? "refreshing" : "loading"));
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
      setStatus(payload.isUpdating ? "refreshing" : "ready");

      if (typeof window !== "undefined") {
        if (pendingRefreshTimeoutRef.current !== null) {
          window.clearTimeout(pendingRefreshTimeoutRef.current);
          pendingRefreshTimeoutRef.current = null;
        }
        if (payload.isUpdating) {
          pendingRefreshTimeoutRef.current = window.setTimeout(() => {
            pendingRefreshTimeoutRef.current = null;
            void fetchData();
          }, 5000);
        }
      }
    } catch (err) {
      console.error(err);
      if (
        typeof window !== "undefined" &&
        pendingRefreshTimeoutRef.current !== null
      ) {
        window.clearTimeout(pendingRefreshTimeoutRef.current);
        pendingRefreshTimeoutRef.current = null;
      }
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
    <div className="relative min-h-[100dvh] text-gray-900">
      <style>{`
        .landing-bg{position:fixed;inset:0;z-index:-1;background:
          radial-gradient(900px 600px at 10% 0%, rgba(14,165,233,.12), transparent 60%),
          radial-gradient(900px 600px at 90% -10%, rgba(2,132,199,.10), transparent 60%),
          linear-gradient(180deg,#fff 0%,#f8fbff 60%,#fff 100%),
          linear-gradient(to bottom, rgba(15,23,42,.04) 1px, transparent 1px),
          linear-gradient(to right, rgba(15,23,42,.04) 1px, transparent 1px);
          background-size:auto,auto,100% 100%,24px 24px,24px 24px;background-position:center}
        html[data-theme="dark"] .landing-bg{background:
          radial-gradient(900px 600px at 10% 0%, rgba(14,165,233,.20), transparent 62%),
          radial-gradient(900px 600px at 90% -10%, rgba(8,47,73,.55), transparent 62%),
          linear-gradient(180deg,#020617 0%,#0f172a 60%,#020617 100%),
          linear-gradient(to bottom, rgba(148,163,184,.10) 1px, transparent 1px),
          linear-gradient(to right, rgba(148,163,184,.10) 1px, transparent 1px)}
      `}</style>
      <div className="landing-bg" aria-hidden="true" />

      <div className="bg-white/85 backdrop-blur border-b border-gray-200">
        <div className="w-full max-w-[1600px] mx-auto px-4 py-4 sm:px-6 lg:px-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:grid-rows-[auto_auto] md:items-start">
          <div className="order-1 space-y-2 md:order-1 md:col-start-1 md:row-start-1">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline"
            >
              <span aria-hidden="true">←</span>
              {texts.back}
            </a>
            <h1 className="text-xl md:text-2xl font-extrabold">{texts.title}</h1>
          </div>
          <p className="order-3 text-sm md:text-base text-gray-700 md:order-3 md:col-start-1 md:row-start-2 md:pr-6">
            {texts.subtitle}
          </p>
          {lastUpdatedFormatted ? (
            <p className="order-4 text-[11px] text-gray-500 text-right md:order-3 md:col-start-2 md:row-start-2 md:text-xs md:whitespace-nowrap md:justify-self-end">
              {texts.lastUpdated}: {lastUpdatedFormatted}
            </p>
          ) : null}
          <div className="order-2 flex flex-col items-stretch md:order-2 md:col-start-2 md:row-start-1 md:row-span-2 md:items-end gap-2 sm:gap-3">
            {usingMockData ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 shadow-sm">
                {texts.mockNotice}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
              <div
                className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white/90 p-1 shadow-sm"
                role="group"
                aria-label={lang === "es" ? "Selector de tema" : "Theme switcher"}
              >
                <button
                  type="button"
                  onClick={() => setThemeChoice("light")}
                  aria-label={lang === "es" ? "Tema claro" : "Light theme"}
                  aria-pressed={activeTheme === "light"}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    activeTheme === "light" ? "bg-cyan-600 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <SunIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setThemeChoice("dark")}
                  aria-label={lang === "es" ? "Tema oscuro" : "Dark theme"}
                  aria-pressed={activeTheme === "dark"}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    activeTheme === "dark" ? "bg-cyan-600 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <MoonIcon />
                </button>
              </div>
              <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white/90 p-1 shadow-sm" role="group" aria-label="Language">
                <button
                  type="button"
                  onClick={() => setLang("es")}
                  aria-pressed={lang === "es"}
                  className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    lang === "es" ? "bg-cyan-600 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {texts.langES}
                </button>
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  aria-pressed={lang === "en"}
                  className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    lang === "en" ? "bg-cyan-600 text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {texts.langEN}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="w-full max-w-[1600px] mx-auto px-4 py-5 sm:px-6 lg:px-8 space-y-5">
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
            <CombinedTable
              funds={data.funds}
              plans={data.plans}
              texts={texts}
              lang={lang}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              showSearchInput
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
