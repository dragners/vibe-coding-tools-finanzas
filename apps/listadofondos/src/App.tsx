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
import { CATEGORY_BADGES, getCategoryBadges, type CategoryBadge, type BadgeVariant } from "./categoryBadges";
import { MultiSelectFilter } from "./MultiSelectFilter";
import "./index.css";
import { MOCK_PAYLOAD } from "./mockData";
import { validatePayload } from "./payload";
import { findDuplicateIdentifiers, getFinectCompareUrl, getFinectProductId, getFundComparisonKey, getMorningstarCompareUrl, MAX_COMPARISON_FUNDS } from "./fundComparison";

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
  inceptionYear?: number | null;
  comment: string;
  url: string;
  indexed?: boolean;
  inPortfolio?: boolean;
  performance: MetricRecord<PerformanceKey>;
  sharpe: MetricRecord<RatioPeriod>;
  sortino: MetricRecord<RatioPeriod>;
  volatility: MetricRecord<RatioPeriod>;
  ter: MetricValue;
  isStale?: boolean;
  dataUpdatedAt?: string | null;
};

export type ApiPayload = {
  lastUpdated: string;
  funds: FundRow[];
  plans: FundRow[];
  isUpdating?: boolean;
  updateFailed?: boolean;
};

type ApiStatus = "idle" | "loading" | "ready" | "refreshing" | "error";

type TextKey = keyof typeof TEXTS["es"];

type TableSection = "funds" | "plans";

type SortOrder = "asc" | "desc";

type SortKey =
  | "name"
  | "inceptionYear"
  | "ter"
  | `performance:${PerformanceKey}`
  | `sharpe:${RatioPeriod}`
  | `sortino:${RatioPeriod}`
  | `volatility:${RatioPeriod}`;

type SortConfig = { key: SortKey; order: SortOrder };

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
    inceptionYear: "Año de creación",
    category: "Categoría",
    comment: "Comentarios",
    performance: "Rentabilidades (%)",
    performanceInfo:
      "Las rentabilidades a 3Y, 5Y y 10Y están anualizadas.",
    sharpe: "Ratio Sharpe",
    sharpeInfo:
      "Indica cuánta rentabilidad adicional sobre una referencia sin riesgo ha obtenido el fondo por cada unidad de volatilidad. Entre valores positivos, uno mayor indica una mejor relación histórica entre rentabilidad y riesgo. Un valor negativo significa que no superó esa referencia, aunque no necesariamente perdió dinero. Compáralo para el mismo periodo y moneda: describe el pasado, no garantiza resultados futuros.",
    sortino: "Ratio Sortino",
    sortinoInfo:
      "Relaciona la rentabilidad adicional sobre una referencia sin riesgo con el riesgo de quedar por debajo de ella. A diferencia de Sharpe, solo penaliza las desviaciones a la baja. Entre valores positivos, uno mayor indica más rentabilidad por unidad de ese riesgo. Un valor negativo significa que no se superó la referencia, aunque no necesariamente se perdió dinero. Compáralo en el mismo periodo, moneda y referencia; describe el pasado y no garantiza resultados futuros.",
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
    clearSearch: "Borrar búsqueda",
    compare: "Comparar en Morningstar",
    compareFinect: "Comparar en Finect",
    compareFinectHint: "Selecciona entre 2 y 5 fondos o planes para comparar en Finect",
    comparisonMissingMorningstar: "Todos los seleccionados deben tener identificador de Morningstar",
    comparisonMissingIsin: "Todos los seleccionados deben tener ISIN o código de plan para comparar en Finect",
    compareHint: "Selecciona entre 2 y 5 fondos o planes para comparar en Morningstar",
    selectForComparison: "Seleccionar para comparar",
    comparisonLimit: "Máximo de 5 seleccionados. Desmarca uno para elegir otro.",
    comparisonUnavailable: "Este producto no tiene identificadores para comparar",
    comparisonTypeLocked: "Compara fondos o planes por separado. Limpia la selección para cambiar de tipo.",
    comparisonMissingMorningstarVisible: "Morningstar no está disponible: falta su identificador en algún producto seleccionado.",
    comparisonMissingFinectVisible: "Finect no está disponible: falta el ISIN o código de plan en algún producto seleccionado.",
    duplicateWarning: "Hay identificadores duplicados. Corrige el ISIN o MorningstarId de los siguientes fondos o planes:",
    clearComparison: "Limpiar selección",
    staleData: "Algunos datos no se han podido actualizar. Conservamos las últimas cifras disponibles, si las hay; los productos afectados están marcados.",
    staleProduct: "Datos pendientes de actualizar",
    closeNotice: "Cerrar aviso",
    retry: "Reintentar",
    scrollHint: "Desliza la tabla para ver más columnas. El nombre del producto permanece visible.",
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
      "Review performance, Sharpe and Sortino ratios, volatility and TER for each fund or pension plan.",
    refresh: "Refresh data",
    refreshing: "Refreshing...",
    lastUpdated: "Last updated",
    name: "Name",
    isin: "ISIN",
    inceptionYear: "Inception year",
    category: "Category",
    comment: "Notes",
    performance: "Performance (%)",
    performanceInfo:
      "3Y, 5Y and 10Y returns are annualized.",
    sharpe: "Sharpe ratio",
    sharpeInfo:
      "Shows how much excess return over a risk-free reference the fund earned per unit of volatility. Among positive values, a higher ratio indicates better historical risk-adjusted performance. A negative ratio means the fund underperformed that reference, even if it did not lose money. Compare the same period and currency: this describes past performance and does not guarantee future results.",
    sortino: "Sortino ratio",
    sortinoInfo:
      "Relates excess return over a risk-free reference to the risk of falling below it. Unlike Sharpe, it only penalizes downside deviations. Among positive values, a higher ratio indicates more return per unit of that risk. A negative value means the reference was not beaten, even if no money was lost. Compare the same period, currency and reference; it describes past performance and does not guarantee future results.",
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
    clearSearch: "Clear search",
    compare: "Compare on Morningstar",
    compareFinect: "Compare on Finect",
    compareFinectHint: "Select between 2 and 5 funds or pension plans to compare on Finect",
    comparisonMissingMorningstar: "All selected products must have a Morningstar identifier",
    comparisonMissingIsin: "All selected products must have an ISIN or pension plan code to compare on Finect",
    compareHint: "Select between 2 and 5 funds or pension plans to compare on Morningstar",
    selectForComparison: "Select for comparison",
    comparisonLimit: "Maximum of 5 selected. Deselect one to choose another.",
    comparisonUnavailable: "This product has no identifiers for comparison",
    comparisonTypeLocked: "Compare funds or pension plans separately. Clear the selection to switch types.",
    comparisonMissingMorningstarVisible: "Morningstar is unavailable: a selected product is missing its identifier.",
    comparisonMissingFinectVisible: "Finect is unavailable: a selected product is missing its ISIN or pension plan code.",
    duplicateWarning: "Duplicate identifiers found. Correct the ISIN or MorningstarId of these funds or pension plans:",
    clearComparison: "Clear selection",
    staleData: "Some data could not be updated. We keep previous figures when available; affected products are marked.",
    staleProduct: "Data awaiting an update",
    closeNotice: "Dismiss notice",
    retry: "Retry",
    scrollHint: "Swipe the table to see more columns. Product names stay visible.",
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
        aria-describedby={open ? id : undefined}
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
              className="z-50 w-[320px] max-w-[calc(100vw-32px)] rounded-lg border bg-white p-3 text-xs leading-relaxed text-gray-700 shadow-lg"
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

type MetricAccessor = "performance" | "sharpe" | "sortino" | "volatility";

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
    row.inceptionYear,
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

  for (const lang of ["es", "en"] as const) {
    tokens.push(...getCategoryBadges(formatValue(row.category, lang), lang, row.indexed).flatMap((badge) => [badge.text, ...(badge.searchTerms ?? [])]));
  }

  const metricGroups = [row.performance ?? {}, row.sharpe ?? {}, row.sortino ?? {}, row.volatility ?? {}];
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
    case "sortino":
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
  addRightBoundary?: boolean;
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
      classes.push("metric-group-start");
    }
    if (options.addRightBoundary && columns[columns.length - 1] === label) {
      classes.push("metric-group-end");
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
    return { type: "text", value: getFinectProductId(row.name) || null };
  }
  if (key === "inceptionYear") {
    return { type: "number", value: row.inceptionYear ?? null };
  }
  if (key === "ter") {
    return { type: "number", value: getMetricNumber(row.ter) };
  }

  const [metric, label] = key.split(":") as ["performance" | "sharpe" | "sortino" | "volatility", string];
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
  if (metric === "sortino") {
    return {
      type: "number",
      value: getMetricNumber((row.sortino ?? {})[label as RatioPeriod]),
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

  sorted.sort((a, b) => {
    const valueA = getSortValue(a, sortConfig.key);
    const valueB = getSortValue(b, sortConfig.key);
    const rawA = valueA.value;
    const rawB = valueB.value;

    const isNullA = rawA === null || rawA === undefined || rawA === "";
    const isNullB = rawB === null || rawB === undefined || rawB === "";

    if (isNullA && isNullB) return 0;
    // Missing values always follow available values, in either direction.
    if (isNullA) return 1;
    if (isNullB) return -1;

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
    <span className="ml-1 flex flex-col items-center justify-center">
      <button
        type="button"
        aria-label={ascLabel}
        aria-pressed={ascActive}
        className={`group inline-flex h-6 w-7 sm:h-5 sm:w-6 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
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
        className={`group inline-flex h-6 w-7 sm:h-5 sm:w-6 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${
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

function CopyIsin({ isin, lang }: { isin: string; lang: Lang }) {
  const [feedback, setFeedback] = useState<"copied" | "error" | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timeoutRef.current !== null) clearTimeout(timeoutRef.current); }, []);
  const value = isin.trim();
  if (!value || value === "-") return <>{formatValue(isin, lang)}</>;
  const label = `${lang === "es" ? "Copiar ISIN" : "Copy ISIN"}: ${value}`;
  const message = feedback === "copied" ? (lang === "es" ? "Copiado" : "Copied")
    : feedback === "error" ? (lang === "es" ? "No se pudo copiar" : "Could not copy") : "";
  const copy = async () => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    try {
      await navigator.clipboard.writeText(value);
      setFeedback("copied");
    } catch {
      setFeedback("error");
    }
    timeoutRef.current = setTimeout(() => setFeedback(null), 2000);
  };
  return (
    <button type="button" onClick={() => void copy()} aria-label={label} title={label}
      className="relative block w-full rounded-sm text-center hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60">
      {value}
      <span aria-live="polite" aria-atomic="true"
        className={feedback ? `absolute inset-0 flex items-center justify-center bg-white/95 text-[11px] ${feedback === "copied" ? "text-cyan-700" : "text-red-600"}` : "sr-only"}>
        {message}
      </span>
    </button>
  );
}

function CategoryLabels({ badges, category, name, lang, selected, onSelect }: {
  badges: CategoryBadge[];
  category: string;
  name: string;
  lang: Lang;
  selected: ReadonlySet<BadgeVariant>;
  onSelect: (badge: CategoryBadge, group: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: -9999, left: -9999 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !tooltipRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    const gap = 8;
    const left = Math.max(gap, Math.min(anchor.left, window.innerWidth - tooltip.width - gap));
    const top = anchor.bottom + tooltip.height + gap <= window.innerHeight
      ? anchor.bottom + gap : Math.max(gap, anchor.top - tooltip.height - gap);
    setPosition({ top, left });
    const close = () => setOpen(false);
    // Capture scrolling inside the table as well as scrolling the page.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, category]);

  return (
    <div ref={anchorRef} className="category-labels"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}
      onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
      {badges.map((badge, group) => (
        <button key={badge.variant} type="button"
          className={`category-label font-semibold uppercase rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 ${CATEGORY_BADGES[badge.variant].style}`}
          aria-label={`${lang === "es" ? "Filtrar por" : "Filter by"} ${badge.text}: ${name}`}
          aria-describedby={open ? tooltipId : undefined}
          aria-pressed={selected.has(badge.variant)}
          onClick={() => { setOpen(false); onSelect(badge, group); }}>
          {badge.text}
        </button>
      ))}
      {open ? createPortal(
        <div ref={tooltipRef} id={tooltipId} role="tooltip"
          style={{ position: "fixed", ...position }}
          className="pointer-events-none z-50 w-max max-w-[min(320px,calc(100vw-32px))] rounded-md bg-slate-900/95 px-2 py-1 text-xs font-semibold text-white shadow-lg break-words">
          {category}
        </div>, document.body,
      ) : null}
    </div>
  );
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [assetFilters, setAssetFilters] = useState<BadgeVariant[]>([]);
  const [focusFilters, setFocusFilters] = useState<BadgeVariant[]>([]);
  const [managementFilter, setManagementFilter] = useState<"all" | "active" | "indexed">("all");
  const hasLabelFilters = assetFilters.length > 0 || focusFilters.length > 0 || managementFilter !== "all";
  const selectedBadges = new Set<BadgeVariant>([...assetFilters, ...focusFilters, ...(managementFilter === "all" ? [] : [managementFilter])]);
  const filterOptions = useMemo(() => {
    const available = [new Map<BadgeVariant, CategoryBadge>(), new Map<BadgeVariant, CategoryBadge>()];
    for (const row of [...funds, ...plans]) {
      const badges = getCategoryBadges(formatValue(row.category, lang), lang, row.indexed);
      for (const group of [0, 1]) available[group].set(badges[group].variant, badges[group]);
    }
    // Keep selected options available even if a refresh removes their last row.
    for (const [group, values] of [[0, assetFilters], [1, focusFilters]] as const) {
      for (const variant of values) available[group].set(variant, { variant, text: CATEGORY_BADGES[variant][lang] });
    }
    return available.map(options => [...options.values()].sort((a, b) => a.text.localeCompare(b.text, lang)));
  }, [funds, plans, lang, assetFilters, focusFilters]);
  const selectLabel = (badge: CategoryBadge, group: number) => {
    if (group === 2) setManagementFilter(badge.variant === "indexed" ? "indexed" : "active");
    else {
      const update = group === 0 ? setAssetFilters : setFocusFilters;
      update(previous => previous.includes(badge.variant) ? previous : [...previous, badge.variant]);
    }
  };
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedItems, setSelectedItems] = useState<{ section: TableSection; key: string }[]>([]);
  const comparisonSection = selectedItems[0]?.section ?? "funds";
  const selectedProducts = selectedItems
    .map(({ section, key }) => (section === "plans" ? plans : funds)
      .find((product) => getFundComparisonKey(product) === key))
    .filter((fund): fund is FundRow => Boolean(fund));
  const missingMorningstarId = selectedProducts.some((product) => !product.morningstarId?.trim());
  const comparisonUrl = missingMorningstarId
    ? null
    : getMorningstarCompareUrl(selectedProducts.map((product) => product.morningstarId), lang);
  const finectComparisonUrl = getFinectCompareUrl(selectedProducts.map((product) => product.isin), comparisonSection);
  const comparisonLimitReached = selectedItems.length >= MAX_COMPARISON_FUNDS;
  const comparisonHelpId = useId();
  const comparisonMessages = [
    selectedItems.length > 0 ? texts.comparisonTypeLocked : null,
    comparisonLimitReached ? texts.comparisonLimit : null,
    missingMorningstarId ? texts.comparisonMissingMorningstarVisible : null,
    selectedProducts.some((product) => !getFinectProductId(product.isin))
      ? texts.comparisonMissingFinectVisible : null,
  ].filter((message): message is string => Boolean(message));

  useEffect(() => {
    const availableIds = {
      funds: new Set(funds.map(getFundComparisonKey).filter(Boolean)),
      plans: new Set(plans.map(getFundComparisonKey).filter(Boolean)),
    };
    setSelectedItems((previous) => {
      const next = previous.filter(({ section, key }) => availableIds[section].has(key));
      return next.length === previous.length ? previous : next;
    });
  }, [funds, plans]);

  const toggleComparison = (section: TableSection, key: string) => {
    setSelectedItems((previous) => {
      if (previous.some((item) => item.section === section && item.key === key)) {
        return previous.filter((item) => item.section !== section || item.key !== key);
      }
      if (previous.length >= MAX_COMPARISON_FUNDS || (previous.length > 0 && previous[0].section !== section)) return previous;
      return [...previous, { section, key }];
    });
  };
  const normalizedQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery],
  );

  const matchesFilter = useCallback((row: FundRow) => {
    const matchesSearch = /^★{1,5}$/.test(normalizedQuery)
      ? renderStars(row.morningstarRating) === normalizedQuery : rowMatchesQuery(row, normalizedQuery);
    if (!matchesSearch) return false;
    const [asset, focus, management] = getCategoryBadges(formatValue(row.category, lang), lang, row.indexed);
    return (assetFilters.length === 0 || assetFilters.includes(asset.variant))
      && (focusFilters.length === 0 || focusFilters.includes(focus.variant))
      && (managementFilter === "all" || management.variant === managementFilter);
  }, [assetFilters, focusFilters, managementFilter, normalizedQuery, lang]);

  const filteredFunds = useMemo(() => funds.filter(matchesFilter), [funds, matchesFilter]);

  const filteredPlans = useMemo(() => plans.filter(matchesFilter), [plans, matchesFilter]);

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
  const sortinoStats = useMemo(
    () => collectColumnStats([filteredFunds, filteredPlans], "sortino", RATIO_LABELS),
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

  const totalColumns = 2 + PERFORMANCE_LABELS.length + RATIO_LABELS.length * 3 + 2;
  const commentColumnWidthClass = "min-w-[312px] sm:min-w-[416px]";

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
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[160px] max-w-[280px] flex-1 basis-[200px]">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={texts.searchPlaceholder}
                aria-label={texts.searchAriaLabel}
                className="w-full rounded-2xl border border-slate-300/80 bg-white/90 py-2.5 pl-3.5 pr-10 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              />
              {searchQuery ? (
                <button
                  type="button"
                  aria-label={texts.clearSearch}
                  title={texts.clearSearch}
                  onClick={() => {
                    onSearchChange?.("");
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                    <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                  </svg>
                </button>
              ) : (
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
              )}
            </div>
            <div className="fund-filter-controls flex flex-wrap items-center gap-2">
              <MultiSelectFilter label={lang === "es" ? "Tipo de activo" : "Asset type"} caption={lang === "es" ? "Tipo" : "Asset"}
                allLabel={lang === "es" ? "Todos" : "All"} clearLabel={lang === "es" ? "Limpiar" : "Clear"}
                options={filterOptions[0]} selected={assetFilters} onChange={setAssetFilters} />
              <MultiSelectFilter label={lang === "es" ? "Enfoque" : "Focus"} caption={lang === "es" ? "Enfoque" : "Focus"}
                allLabel={lang === "es" ? "Todos" : "All"} clearLabel={lang === "es" ? "Limpiar" : "Clear"}
                options={filterOptions[1]} selected={focusFilters} onChange={setFocusFilters} align="right" />
              <select aria-label={lang === "es" ? "Gestión" : "Management"} value={managementFilter}
                onChange={event => setManagementFilter(event.target.value as "all" | "active" | "indexed")}
                className="h-[42px] min-w-0 rounded-xl border border-slate-300/80 bg-white/90 px-2 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400">
                <option value="all">{lang === "es" ? "Gestión: Todas" : "Management: All"}</option>
                <option value="active">{lang === "es" ? "Activa" : "Active"}</option>
                <option value="indexed">{lang === "es" ? "Pasiva" : "Passive"}</option>
              </select>
              {hasLabelFilters ? <button type="button" onClick={() => { setAssetFilters([]); setFocusFilters([]); setManagementFilter("all"); }}
                className="rounded-lg text-xs text-slate-500 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
                {lang === "es" ? "Limpiar filtros" : "Clear filters"}
              </button> : null}
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
              {selectedItems.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedItems([])}
                  className="rounded-lg text-xs text-slate-500 transition hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  {texts.clearComparison}
                </button>
              ) : null}
              {[
                { label: texts.compare, url: comparisonUrl, hint: missingMorningstarId ? texts.comparisonMissingMorningstar : texts.compareHint },
                { label: texts.compareFinect, url: finectComparisonUrl, hint: selectedItems.length >= 2 && !finectComparisonUrl ? texts.comparisonMissingIsin : texts.compareFinectHint },
              ].map(({ label, url, hint }) => (
                <a
                  key={label}
                  href={url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!url}
                  tabIndex={url ? 0 : -1}
                  title={hint}
                  aria-describedby={comparisonHelpId}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    url
                      ? "border-cyan-200 bg-cyan-50 text-cyan-600 hover:border-cyan-400 hover:text-cyan-700"
                      : "cursor-not-allowed border-slate-200 bg-white/90 text-slate-400"
                  }`}
                >
                  {label}
                  <span className="text-xs tabular-nums" aria-live="polite" aria-atomic="true">
                    {selectedItems.length}/{MAX_COMPARISON_FUNDS}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ) : null}
        <div id={comparisonHelpId} role="status" aria-live="polite" className={comparisonMessages.length ? "mb-4 space-y-1 text-xs text-slate-600" : "sr-only"}>
          {comparisonMessages.map((message) => <p key={message}>{message}</p>)}
        </div>
        <p className="mb-2 text-xs text-slate-500 md:hidden">{texts.scrollHint}</p>
        <div className="fund-table-scroll overflow-auto max-h-[75dvh] pb-4">

          <table className="w-full border-separate border-spacing-y-1 border-spacing-x-[1px] text-sm text-gray-800">
            <thead className="bg-white/95 backdrop-blur-sm shadow-sm">
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                <th
                  rowSpan={2}
                  className="fund-name-column px-3 py-1 max-w-[320px] bg-white/90 backdrop-blur text-center rounded-tl-2xl"
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
                  className="px-2.5 py-1 whitespace-nowrap bg-white/90 backdrop-blur text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span className="inline-flex flex-col"><span>{texts.isin}</span><span className="text-[9px] font-normal normal-case">{texts.inceptionYear}</span></span>
                    <SortControl
                      lang={lang}
                      label={texts.inceptionYear}
                      activeOrder={sortConfig?.key === "inceptionYear" ? sortConfig.order : null}
                      onChange={(order) => handleSortChange("inceptionYear", order)}
                    />
                  </div>
                </th>
                <th
                  rowSpan={2}
                  className={`px-1 py-1 whitespace-nowrap bg-white/90 backdrop-blur text-center ${TER_COLUMN_WIDTH_CLASS}`}
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
                  className="relative px-1.5 pt-1 pb-0 align-bottom bg-white/90 backdrop-blur text-center metric-group-start overflow-visible"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{texts.performance}</span>
                    <InfoTip content={texts.performanceInfo} label={texts.performance} />
                  </div>
                </th>
                <th
                  colSpan={RATIO_LABELS.length}
                  className="relative px-1.5 pt-1 pb-0 align-bottom bg-white/90 backdrop-blur text-center metric-group-start overflow-visible"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{texts.sharpe}</span>
                    <InfoTip content={texts.sharpeInfo} label={texts.sharpe} />
                  </div>
                </th>
                <th
                  colSpan={RATIO_LABELS.length}
                  className="relative px-1.5 pt-1 pb-0 align-bottom bg-white/90 backdrop-blur text-center metric-group-start overflow-visible"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{texts.sortino}</span>
                    <InfoTip content={texts.sortinoInfo} label={texts.sortino} />
                  </div>
                </th>
                <th
                  colSpan={RATIO_LABELS.length}
                  className="relative px-1.5 pt-1 pb-0 align-bottom bg-white/90 backdrop-blur text-center metric-group-start metric-group-end overflow-visible"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>{texts.volatility}</span>
                    <InfoTip content={texts.volatilityInfo} label={texts.volatility} />
                  </div>
                </th>
                <th
                  rowSpan={2}
                  className={`px-3 py-1 bg-white/90 backdrop-blur text-center rounded-tr-2xl ${commentColumnWidthClass}`}
                >
                  {texts.comment}
                </th>
              </tr>
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                {PERFORMANCE_LABELS.map((label, index) => (
                  <th
                    key={`perf-${label}`}
                    className={`px-1 pt-0 pb-1 bg-white/90 backdrop-blur text-center ${
                      index === 0 ? "metric-group-start" : ""
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
                    className={`px-1 pt-0 pb-1 bg-white/90 backdrop-blur text-center ${
                      index === 0 ? "metric-group-start" : ""
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
                    key={`sortino-${label}`}
                    className={`px-1 pt-0 pb-1 bg-white/90 backdrop-blur text-center ${
                      index === 0 ? "metric-group-start" : ""
                    } ${METRIC_COLUMN_WIDTH_CLASS}`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{displayMetricLabel(label)}</span>
                      <SortControl
                        lang={lang}
                        label={`${texts.sortino} ${displayMetricLabel(label)}`}
                        activeOrder={
                          sortConfig?.key === `sortino:${label}`
                            ? sortConfig.order
                            : null
                        }
                        onChange={(order) =>
                          handleSortChange(`sortino:${label}` as SortKey, order)
                        }
                      />
                    </div>
                  </th>
                ))}
                {RATIO_LABELS.map((label, index) => (
                  <th
                    key={`vol-${label}`}
                    className={`px-1 pt-0 pb-1 bg-white/90 backdrop-blur text-center ${
                      index === 0 ? "metric-group-start" : ""
                    } ${index === RATIO_LABELS.length - 1 ? "metric-group-end" : ""} ${METRIC_COLUMN_WIDTH_CLASS}`}
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
                    // Keep rows distinct even while duplicate configuration is awaiting correction.
                    const sourceRows = section.key === "funds" ? funds : plans;
                    const rowKey = `${getFundComparisonKey(row) || row.name}-${sourceRows.indexOf(row)}`;
                    const comparisonId = getFundComparisonKey(row);
                    const comparisonSelected = selectedItems.some((item) => item.section === section.key && item.key === comparisonId);
                    const comparisonTypeLocked = selectedItems.length > 0 && comparisonSection !== section.key;
                    const comparisonDisabled = !comparisonId || comparisonTypeLocked || (comparisonLimitReached && !comparisonSelected);
                    const badges = getCategoryBadges(
                      categoryValue,
                      lang,
                      row.indexed,
                    );
                    const tooltipId = `${section.key}-${rowKey}`;
                    const heartTooltipId = `${tooltipId}-heart`;
                    const heartTooltipOpen = openTooltipId === heartTooltipId;
                    const categoryDisplay =
                      categoryValue !== "-" ? categoryValue : texts.noData;
                    const link =
                      getMorningstarUrl(row.morningstarId, lang) ??
                      (row.url || undefined) ??
                      undefined;
                    const tooltipLabel =
                      categoryDisplay && categoryDisplay !== texts.noData
                        ? categoryDisplay
                        : texts.noData;
                    return (
                      <tr key={tooltipId} className="align-middle">
                        <td
                          className={`fund-name-column relative px-3 py-2 bg-white/95 backdrop-blur max-w-[320px] overflow-visible align-top ${
                            heartTooltipOpen ? "z-20" : ""
                          }`}
                        >
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex w-full items-center gap-1">
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
                              <label
                                className={`ml-auto inline-flex shrink-0 items-center rounded-md p-1 ${comparisonDisabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
                                title={!comparisonId ? texts.comparisonUnavailable : comparisonTypeLocked ? texts.comparisonTypeLocked : comparisonDisabled ? texts.comparisonLimit : texts.selectForComparison}
                              >
                                <input
                                  type="checkbox"
                                  checked={comparisonSelected}
                                  disabled={comparisonDisabled}
                                  onChange={() => toggleComparison(section.key, comparisonId)}
                                  aria-label={`${texts.selectForComparison}: ${row.name}`}
                                  aria-describedby={comparisonHelpId}
                                  className="h-3.5 w-3.5 cursor-inherit rounded border-slate-300 accent-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2"
                                />
                              </label>
                            </div>
                            {row.isStale ? <p className="text-[11px] text-amber-700">{texts.staleProduct}</p> : null}
                            {!comparisonId ? (
                              <p className="text-[11px] text-slate-600">{texts.comparisonUnavailable}</p>
                            ) : null}
                            {(badges.length > 0 || stars) && (
                              <div className="fund-label-row flex w-full items-center gap-1">
                                {stars ? (
                                  <button
                                    type="button"
                                    className="inline-flex shrink-0 items-center rounded-sm text-xs font-semibold leading-none text-amber-500 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                                    aria-label={`${lang === "es" ? "Filtrar por" : "Filter by"} ${stars.length} ${lang === "es" ? "estrellas Morningstar" : "Morningstar stars"}: ${row.name}`}
                                    title={`${lang === "es" ? "Filtrar por" : "Filter by"} ${stars.length} ${lang === "es" ? "estrellas Morningstar" : "Morningstar stars"}`}
                                    aria-pressed={normalizedQuery === stars}
                                    onClick={() => onSearchChange?.(stars)}
                                  >
                                    {stars}
                                  </button>
                                ) : null}
                                {badges.length > 0 ? (
                                  <div className={stars ? "ml-auto" : ""}>
                                    <CategoryLabels badges={badges} category={tooltipLabel} name={row.name} lang={lang}
                                      selected={selectedBadges} onSelect={selectLabel} />
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </td>
                        <td
                          className="px-3 py-2 bg-white/95 backdrop-blur whitespace-nowrap text-gray-600 text-xs sm:text-[13px] align-middle"
                        >
                          <CopyIsin isin={row.isin} lang={lang} />
                          <span className="mt-1 block text-center text-[11px] text-slate-500" aria-label={`${texts.inceptionYear}: ${row.inceptionYear ?? texts.noData}`} title={texts.inceptionYear}>{row.inceptionYear ?? "—"}</span>
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
                          row.sortino,
                          "sortino",
                          sortinoStats,
                          { metric: "sortino", addLeftBoundary: true },
                          lang,
                        )}
                        {renderMetricCells(
                          RATIO_LABELS,
                          row.volatility,
                          "vol",
                          volatilityStats,
                          { metric: "volatility", addLeftBoundary: true, addRightBoundary: true },
                          lang,
                        )}
                        <td
                          className={`px-3 py-2 bg-white/95 backdrop-blur text-gray-600 text-[11px] sm:text-xs leading-snug align-middle ${commentColumnWidthClass}`}
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
  const [staleNoticeDismissed, setStaleNoticeDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [shouldAutoRefresh, setShouldAutoRefresh] = useState<boolean | null>(
    null,
  );
  const duplicateIdentifiers = useMemo(
    () => findDuplicateIdentifiers(data?.funds ?? [], data?.plans ?? []),
    [data],
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
        cache: "no-store",
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
        payload = JSON.parse(rawText);
      } catch (jsonErr) {
        throw new SyntaxError(
          (jsonErr as Error).message || "Invalid JSON response",
        );
      }
      payload = validatePayload(payload);
      setData(payload);
      dataRef.current = payload;
      setUsingMockData(false);
      setStatus(payload.isUpdating ? "refreshing" : "ready");
      if (payload.updateFailed) setError("load-failed");

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
      // Never replace a previously loaded real list with fictitious sample funds.
      if (!hasExistingData && import.meta.env.DEV && shouldUseMockData(err)) {
        setData(MOCK_PAYLOAD);
        dataRef.current = MOCK_PAYLOAD;
        setStatus("ready");
        setUsingMockData(true);
        return;
      }
      setError("load-failed");
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
          {duplicateIdentifiers.length > 0 ? (
            <div role="alert" className="order-5 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:col-span-2 md:row-start-3">
              <p className="font-semibold">{texts.duplicateWarning}</p>
              <ul className="mt-2 space-y-1">
                {duplicateIdentifiers.map((duplicate) => (
                  <li key={`${duplicate.field}-${duplicate.value}`}>
                    <span className="font-semibold">{duplicate.field === "isin" ? "ISIN" : "MorningstarId"}: {duplicate.value}</span>
                    {" — "}
                    {duplicate.products.map((product) => `${product.name} (${product.section === "funds" ? texts.fundsTitle : texts.plansTitle})`).join("; ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      <main className="w-full max-w-[1600px] mx-auto px-4 py-5 sm:px-6 lg:px-8 space-y-5">
        {(status === "loading" || status === "refreshing") && (
          <div className="rounded-2xl border border-white/60 bg-white/80 px-4 py-3 text-sm text-gray-600 shadow-sm backdrop-blur">
            {status === "refreshing" ? texts.refreshing : texts.loading}
          </div>
        )}
        {data && !staleNoticeDismissed && [...data.funds, ...data.plans].some((product) => product.isStale) && (
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="flex-1">{texts.staleData}</p>
            <button type="button" onClick={() => setStaleNoticeDismissed(true)}
              aria-label={texts.closeNotice} title={texts.closeNotice}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {texts.error}
            <button type="button" onClick={() => void fetchData(Boolean(dataRef.current))} className="ml-3 rounded-lg border border-red-300 px-3 py-2 font-semibold focus-visible:ring-2 focus-visible:ring-red-400">{texts.retry}</button>
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
