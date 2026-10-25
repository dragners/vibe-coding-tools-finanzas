const COLORS = {
  equity: "bg-rose-100 text-rose-700 border-rose-200",
  bond: "bg-emerald-100 text-emerald-700 border-emerald-200",
  moneyMarket: "bg-lime-100 text-lime-800 border-lime-200",
  mixed: "bg-amber-100 text-amber-800 border-amber-200",
  alternative: "bg-purple-100 text-purple-700 border-purple-200",
  violet: "bg-violet-100 text-violet-700 border-violet-200",
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  sky: "bg-sky-100 text-sky-700 border-sky-200",
  cyan: "bg-cyan-100 text-cyan-800 border-cyan-200",
  teal: "bg-teal-100 text-teal-700 border-teal-200",
  green: "bg-green-100 text-green-700 border-green-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  indexed: "bg-cyan-100 text-cyan-700 border-cyan-200",
  neutral: "bg-slate-100 text-neutral-700 border-slate-200",
};

// Keep the asset identity stable. Focus colours avoid rose/pink alongside
// equities, and green alongside bonds; opaque tints stay readable in both themes.
export const CATEGORY_BADGES = {
  equity: { es: "Acciones", en: "Equity", style: COLORS.equity },
  bond: { es: "Bonos", en: "Bonds", style: COLORS.bond },
  moneyMarket: { es: "Monetario", en: "Cash", style: COLORS.moneyMarket, searchTerms: ["monetario", "monetarios", "money market", "cash"] },
  mixed: { es: "Mixto", en: "Mixed", style: COLORS.mixed },
  alternative: { es: "Alternat.", en: "Alternat.", style: COLORS.alternative },
  otherAssets: { es: "Otros", en: "Other", style: COLORS.neutral },
  global: { es: "Global", en: "Global", style: COLORS.violet },
  europe: { es: "Europa", en: "Europe", style: COLORS.indigo },
  eurozone: { es: "Eurozona", en: "Eurozone", style: COLORS.blue },
  asia: { es: "Asia-Pac.", en: "Asia-Pac.", style: COLORS.cyan },
  emerging: { es: "Emergentes", en: "Emerging", style: COLORS.alternative },
  frontier: { es: "Frontera", en: "Frontier", style: COLORS.orange },
  india: { es: "India", en: "India", style: COLORS.yellow },
  china: { es: "China", en: "China", style: COLORS.sky },
  tech: { es: "Tecnología", en: "Technology", style: COLORS.sky },
  ecology: { es: "Ecología", en: "Ecology", style: COLORS.green },
  resources: { es: "Recursos", en: "Resources", style: COLORS.orange },
  metals: { es: "Metales", en: "Metals", style: COLORS.yellow },
  smallCap: { es: "Small cap", en: "Small cap", style: COLORS.blue },
  value: { es: "Value", en: "Value", style: COLORS.teal },
  growth: { es: "Growth", en: "Growth", style: COLORS.violet },
  dividend: { es: "Dividendos", en: "Dividends", style: COLORS.green },
  flexCap: { es: "Flex. cap", en: "Flex. cap", style: COLORS.indigo },
  highYield: { es: "High yield", en: "High yield", style: COLORS.orange },
  catBond: { es: "Cat Bond", en: "Cat Bond", style: COLORS.yellow, searchTerms: ["cat bonds", "bonos catástrofe", "bonos catastrofe", "catastrophe bonds"] },
  shortTerm: { es: "Corto plazo", en: "Short term", style: COLORS.sky },
  government: { es: "Gobierno", en: "Government", style: COLORS.violet },
  corporate: { es: "Corporativo", en: "Corporate", style: COLORS.indigo },
  flexible: { es: "Flexible", en: "Flexible", style: COLORS.blue },
  cautious: { es: "Conservador", en: "Cautious", style: COLORS.sky },
  trend: { es: "Tendencias", en: "Trend", style: COLORS.orange },
  euro: { es: "EUR", en: "EUR", style: COLORS.indigo },
  other: { es: "Otros", en: "Other", style: COLORS.neutral },
  unknown: { es: "Sin categ.", en: "Unclassified", style: COLORS.neutral },
  indexed: { es: "Index", en: "Index", style: COLORS.indexed },
  active: { es: "Activa", en: "Active", style: COLORS.neutral },
} as const;

export type BadgeVariant = keyof typeof CATEGORY_BADGES;
export type CategoryBadge = { text: string; variant: BadgeVariant; searchTerms?: readonly string[] };

const FILTER_LABELS: Partial<Record<BadgeVariant, { es: string; en: string }>> = {
  alternative: { es: "Alternativos", en: "Alternatives" },
  moneyMarket: { es: "Monetario", en: "Money market" },
  asia: { es: "Asia-Pacífico", en: "Asia-Pacific" },
  smallCap: { es: "Pequeña capitalización", en: "Small capitalisation" },
  flexCap: { es: "Capitalización flexible", en: "Flexible capitalisation" },
  resources: { es: "Recursos naturales", en: "Natural resources" },
  metals: { es: "Metales preciosos", en: "Precious metals" },
  unknown: { es: "Sin categoría", en: "Unclassified" },
  euro: { es: "Euro (EUR)", en: "Euro (EUR)" },
  indexed: { es: "Pasiva", en: "Passive" },
};

export function getCategoryFilterLabel(variant: BadgeVariant, lang: "es" | "en") {
  return FILTER_LABELS[variant]?.[lang] ?? CATEGORY_BADGES[variant][lang];
}

// The middle badge uses the most specific useful focus. For instance, emerging
// markets take precedence over "Global", and short duration over corporate debt.
const FOCUS_RULES: [RegExp, BadgeVariant][] = [
  [/\bcat(?:astrophe)?[ -]+(?:bonds?|bd)\b/, "catBond"],
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

export function getCategoryBadges(category: string, lang: "es" | "en", indexed?: boolean, name = ""): CategoryBadge[] {
  const normalized = category.trim().toLowerCase();
  const asset: BadgeVariant = /\bmoney[ -]+market\b/.test(normalized) ? "moneyMarket"
    : /allocation|balanced/.test(normalized) ? "mixed"
    : /systematic trend/.test(normalized) ? "alternative"
    : /equity/.test(normalized) ? "equity"
    : /bond/.test(normalized) ? "bond" : "otherAssets";
  // Morningstar groups catastrophe bonds under Other Bond. Use the explicit
  // product name to refine that broad category without changing the source data.
  const namedCatBond = asset === "bond" && /\bcat(?:astrophe)?[ -]+(?:bonds?|bd)\b/i.test(name);
  const focus = namedCatBond ? "catBond" : FOCUS_RULES.find(([pattern]) => pattern.test(normalized))?.[1] ?? "unknown";
  const variants: BadgeVariant[] = [asset, focus, indexed ? "indexed" : "active"];
  return variants.map((variant) => {
    const definition = CATEGORY_BADGES[variant];
    return { variant, text: definition[lang], searchTerms: "searchTerms" in definition ? definition.searchTerms : [] };
  });
}
