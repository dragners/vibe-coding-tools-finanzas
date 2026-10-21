const COLORS = {
  equity: "bg-rose-100/80 text-rose-700 border-rose-200",
  bond: "bg-emerald-100/80 text-emerald-700 border-emerald-200",
  mixed: "bg-amber-100/80 text-amber-800 border-amber-200",
  alternative: "bg-purple-100/80 text-purple-700 border-purple-200",
  region: "bg-violet-100/80 text-violet-700 border-violet-200",
  sector: "bg-teal-100/80 text-teal-700 border-teal-200",
  focus: "bg-blue-100/80 text-blue-700 border-blue-200",
  indexed: "bg-cyan-100/80 text-cyan-700 border-cyan-200",
  neutral: "bg-slate-100/80 text-slate-700 border-slate-200",
};

export const CATEGORY_BADGES = {
  equity: { es: "Acciones", en: "Equity", style: COLORS.equity },
  bond: { es: "Bonos", en: "Bonds", style: COLORS.bond },
  mixed: { es: "Mixto", en: "Mixed", style: COLORS.mixed },
  alternative: { es: "Alternat.", en: "Alternat.", style: COLORS.alternative },
  otherAssets: { es: "Otros", en: "Other", style: COLORS.neutral },
  global: { es: "Global", en: "Global", style: COLORS.region },
  europe: { es: "Europa", en: "Europe", style: COLORS.region },
  eurozone: { es: "Eurozona", en: "Eurozone", style: COLORS.region },
  asia: { es: "Asia-Pac.", en: "Asia-Pac.", style: COLORS.region },
  emerging: { es: "Emergentes", en: "Emerging", style: COLORS.region },
  frontier: { es: "Frontera", en: "Frontier", style: COLORS.region },
  india: { es: "India", en: "India", style: COLORS.region },
  china: { es: "China", en: "China", style: COLORS.region },
  tech: { es: "Tecnología", en: "Technology", style: COLORS.sector },
  ecology: { es: "Ecología", en: "Ecology", style: COLORS.sector },
  resources: { es: "Recursos", en: "Resources", style: COLORS.sector },
  metals: { es: "Metales", en: "Metals", style: COLORS.sector },
  smallCap: { es: "Small cap", en: "Small cap", style: COLORS.focus },
  value: { es: "Value", en: "Value", style: COLORS.focus },
  growth: { es: "Growth", en: "Growth", style: COLORS.focus },
  dividend: { es: "Dividendos", en: "Dividends", style: COLORS.focus },
  flexCap: { es: "Flex. cap", en: "Flex. cap", style: COLORS.focus },
  highYield: { es: "High yield", en: "High yield", style: COLORS.focus },
  shortTerm: { es: "Corto plazo", en: "Short term", style: COLORS.focus },
  government: { es: "Gobierno", en: "Government", style: COLORS.focus },
  corporate: { es: "Corporativo", en: "Corporate", style: COLORS.focus },
  flexible: { es: "Flexible", en: "Flexible", style: COLORS.focus },
  cautious: { es: "Conservador", en: "Cautious", style: COLORS.focus },
  trend: { es: "Tendencias", en: "Trend", style: COLORS.focus },
  euro: { es: "EUR", en: "EUR", style: COLORS.region },
  other: { es: "Otros", en: "Other", style: COLORS.neutral },
  unknown: { es: "Sin categ.", en: "Unclassified", style: COLORS.neutral },
  indexed: { es: "Index", en: "Index", style: COLORS.indexed },
  active: { es: "Activa", en: "Active", style: COLORS.neutral },
} as const;

export type BadgeVariant = keyof typeof CATEGORY_BADGES;
export type CategoryBadge = { text: string; variant: BadgeVariant };

// The middle badge uses the most specific useful focus. For instance, emerging
// markets take precedence over "Global", and short duration over corporate debt.
const FOCUS_RULES: [RegExp, BadgeVariant][] = [
  [/precious metals/, "metals"],
  [/natural resources/, "resources"],
  [/technology/, "tech"],
  [/ecology/, "ecology"],
  [/frontier/, "frontier"],
  [/emerging/, "emerging"],
  [/india/, "india"],
  [/china/, "china"],
  [/asia.pacific/, "asia"],
  [/systematic trend/, "trend"],
  [/high yield/, "highYield"],
  [/short[ -]term/, "shortTerm"],
  [/government bond/, "government"],
  [/corporate bond/, "corporate"],
  [/flexible (?:bond|allocation)/, "flexible"],
  [/cautious allocation/, "cautious"],
  [/eurozone/, "eurozone"],
  [/europe/, "europe"],
  [/small(?:\/mid)?(?:-cap| equity)/, "smallCap"],
  [/\bvalue\b/, "value"],
  [/\bgrowth\b/, "growth"],
  [/equity income/, "dividend"],
  [/flex-cap/, "flexCap"],
  [/global/, "global"],
  [/\beur\b/, "euro"],
  [/other bond/, "other"],
];

export function getCategoryBadges(category: string, lang: "es" | "en", indexed?: boolean): CategoryBadge[] {
  const normalized = category.trim().toLowerCase();
  const asset: BadgeVariant = /allocation|balanced/.test(normalized) ? "mixed"
    : /systematic trend/.test(normalized) ? "alternative"
    : /equity/.test(normalized) ? "equity"
    : /bond/.test(normalized) ? "bond" : "otherAssets";
  const focus = FOCUS_RULES.find(([pattern]) => pattern.test(normalized))?.[1] ?? "unknown";
  const variants: BadgeVariant[] = [asset, focus, indexed ? "indexed" : "active"];
  return variants.map((variant) => ({ variant, text: CATEGORY_BADGES[variant][lang] }));
}
