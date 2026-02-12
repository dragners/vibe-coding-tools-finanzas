import React, { useMemo, useState, useEffect, useRef } from "react";

// Sanitize HTML by allowing only safe tags: br, strong, em, a
const sanitizeHtml = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = html;

  const allowedTags = ['BR', 'STRONG', 'EM', 'A', 'B', 'I'];
  const walkNode = (node: Node): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (!allowedTags.includes(element.tagName)) {
        // Replace disallowed element with its text content
        const textNode = document.createTextNode(element.textContent || '');
        element.replaceWith(textNode);
        return;
      }
      // For anchor tags, ensure href doesn't contain javascript:
      if (element.tagName === 'A') {
        const href = element.getAttribute('href') || '';
        if (href.toLowerCase().startsWith('javascript:') || href.toLowerCase().startsWith('data:')) {
          element.removeAttribute('href');
        }
      }
      // Recursively check children
      Array.from(element.childNodes).forEach(walkNode);
    }
  };

  Array.from(div.childNodes).forEach(walkNode);
  return div.innerHTML;
};

const LANG_STORAGE_KEY = "finanzas.lang";
const THEME_STORAGE_KEY = "finanzas.theme";
type ThemeMode = "light" | "dark";

const getStoredLang = (): "es" | "en" => {
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

const fmtEUR = (n: number, locale: string) => n.toLocaleString(locale, {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const formatDuration = (months: number, lang: 'es' | 'en') => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return lang === 'es' ? `${y} años ${m} meses` : `${y} years ${m} months`;
};
const parseNum = (s: string | number): number => {
  if (typeof s === 'number') return isFinite(s) ? s : 0;
  if (!s) return 0;
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? 0 : n;
};
const clampYearsInput = (value: string) => {
  if (value.trim() === "") return "";
  const n = Math.floor(parseNum(value));
  if (!Number.isFinite(n)) return "";
  return String(Math.min(67, Math.max(0, n)));
};
function InfoTip({ text, className = "", lang }: { text: string; className?: string; lang: 'es' | 'en' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('click', onDocClick);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  return (
    <span ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-gray-600 leading-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
        aria-label={lang === 'es' ? 'Más información' : 'More info'}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        ⓘ
      </button>
      {open && (
        <div role="tooltip" className="absolute z-20 mt-2 w-64 max-w-[80vw] rounded-lg border border-gray-200 bg-white p-2 text-xs text-gray-700 shadow-lg right-0">
          {text}
        </div>
      )}
    </span>
  );
}

const TEXTS = {
  es: {
    back: "Volver a Herramientas",
    title: "Calculadora Plan de Pensiones vs Fondo",
    intro: "Compara, con fiscalidad española, aportar a un <b>plan de pensiones</b> frente a un <b>fondo de inversión</b>. Introduce tus datos para ver el <b>valor acumulado a la jubilación</b> y el <b>neto a recibir</b> bajo distintos modos de rescate. El ahorro anual por aportar al plan se estima con tu <i>tipo marginal</i> (estatal + autonómico según comunidad seleccionada). Al rescatar, el plan tributa por tramos de la <i>base general</i> y los fondos por la <i>tarifa del ahorro</i> sobre la ganancia realizada.",
    region: "Comunidad Autónoma",
    salary: "Salario bruto anual actual",
    yearsToRetire: "Años hasta jubilación",
    annualContribution: "Aportación anual (máx. 10.000€)",
    annualContributionTip: "Límites legales de aportación: hasta 1.500€/año en planes individuales (PPI). El tope de 10.000€/año solo aplica cuando existe un plan de empleo (PPE/PPSE) con aportaciones de la empresa y, en su caso, contribuciones del trabajador vinculadas a ese plan.",
    expectedReturn: "TIR anual esperada",
    expectedPublicPension: "Pensión pública prevista (bruto anual)",
    reinvestLabel: "¿Reinvertir el ahorro anual de IRPF en un fondo de inversión?",
    reinvestTip: "Si reinviertes en un fondo el ahorro de IRPF generado por las aportaciones al plan de pensiones, ese ahorro también se invierte y se capitaliza al mismo TIR que el fondo. En rescates parciales, los importes se prorratean entre plan y fondo.",
    no: "No",
    yes: "Sí",
    pensionNetPrev: "Pensión pública neta prevista:",
    marginalType: "Tipo marginal estimado (trabajo):",
    annualIRPFSaving: "Ahorro IRPF anual por aportar al plan:",
    shareLink: "Link permanente",
    linkReady: "Enlace listo para compartir",
    linkCopied: "Enlace copiado",
    retirementValue: "Valor a la jubilación",
    planPlusFund: "Plan de pensiones + Fondo (ahorro IRPF)",
    planOnly: "Plan de pensiones",
    fundInvestment: "Fondo de inversión",
    totalInvested: "Total invertido:",
    totalIRPFSaved: "Total ahorro IRPF (no reinvertido):",
    detailBruto: "Detalle bruto:",
    detailInvertido: "Detalle invertido:",
    plan: "Plan",
    fund: "Fondo",
    fundIRPF: "Fondo (ahorro IRPF)",
    withdrawalsDuration: "Rescates y duración del capital",
    scenario: "Escenario",
    totalNet: "Neto Total",
    totalNetTip: "Importe neto total recibido a partir del capital acumulado (aportaciones + rentabilidad) del plan de pensiones o de los fondos, tras agotar la duración. No incluye los cobros de la pensión pública.",
    totalTaxes: "Impuestos Totales",
    totalTaxesTip: "Total de impuestos satisfechos por las retiradas del capital acumulado del plan de pensiones o de los fondos durante la duración. No incluye los impuestos asociados a la pensión pública.",
    duration: "Duración",
    grossAnnual: "Bruto Anual",
    grossAnnualTip: "Importe bruto anual a retirar antes de impuestos para obtener el neto indicado.",
    withdraw: "Retirar",
    netPerYear: "netos al año",
    totalNetWithPension: "Total neto con pensión:",
    totalWithdrawal: "Rescate total",
    notesTitle: "Notas y supuestos:",
    notes1: "Los importes de “Retirar 10.000/15.000/…” son <b>netos</b> recibidos cada año; se calcula el bruto necesario y se suman a la <b>pensión neta</b>.",
    notes2: "Límites legales de aportación: hasta <b>1.500€</b>/año en <b>planes individuales (PPI)</b>. El tope de <b>10.000€</b>/año solo aplica cuando existe un <b>plan de empleo</b> (PPE/PPSE) con aportaciones de la empresa y, en su caso, contribuciones del trabajador vinculadas a ese plan. En esta calculadora el campo “Aportación anual” se limita a 10.000€ asumiendo ese escenario.",
    notes3: "En retiros parciales, cada año primero se aplica la TIR al capital restante y después se descuenta el retiro bruto necesario para alcanzar el neto; el saldo continúa capitalizándose hasta agotarse.",
    notes4: "La duración de las retiradas se limita a un máximo de <b>35 años</b> (≈ 420 meses). Si la TIR anual es mayor o igual al ritmo de retirada, el capital podría no agotarse; se aplica este tope para reflejar un horizonte razonable de jubilación y evitar resultados poco útiles.",
    notes5: "IRPF general: suma de <i>escala estatal 2025</i> y <i>escala autonómica 2025</i> de la <b>CCAA seleccionada</b>. Incluidas todas las CCAA de régimen común (sin Navarra ni País Vasco).",
    notes6: "IRPF del ahorro: 19%/21%/23%/27%/30% (España · normativa 2025). Los rescates de fondos tributan solo por la ganancia efectivamente realizada cada año.",
    footer: "© David Gonzalez, si quieres saber más sobre mí, visita",
    moreInfo: "Más información",
    langES: "ES",
    langEN: "EN",
  },
  en: {
    back: "Back to Tools",
    title: "Pension Plan vs Fund Calculator",
    intro: "Compare, under Spanish tax rules, contributing to a <b>pension plan</b> versus an <b>investment fund</b>. Enter your data to see the <b>accumulated value at retirement</b> and the <b>net amount received</b> under different withdrawal modes. The annual tax saving from contributing to the plan is estimated with your <i>marginal rate</i> (state + regional according to selected region). Upon withdrawal, the plan is taxed by <i>general income brackets</i> and funds by the <i>savings tax scale</i> on realized gains.",
    region: "Autonomous Community",
    salary: "Current gross annual salary",
    yearsToRetire: "Years until retirement",
    annualContribution: "Annual contribution (max €10,000)",
    annualContributionTip: "Legal contribution limits: up to €1,500/year in individual plans (PPI). The €10,000/year cap only applies when there is an employment plan (PPE/PPSE) with company contributions and, where applicable, worker contributions linked to that plan.",
    expectedReturn: "Expected annual IRR",
    expectedPublicPension: "Expected public pension (gross annual)",
    reinvestLabel: "Reinvest the annual income tax saving in an investment fund?",
    reinvestTip: "If you reinvest in a fund the income tax savings generated by pension plan contributions, that saving is also invested and compounds at the same IRR as the fund. In partial withdrawals, amounts are prorated between plan and fund.",
    no: "No",
    yes: "Yes",
    pensionNetPrev: "Expected net public pension:",
    marginalType: "Estimated marginal rate (work):",
    annualIRPFSaving: "Annual income tax saving from plan contribution:",
    shareLink: "Permanent link",
    linkReady: "Link ready to share",
    linkCopied: "Link copied",
    retirementValue: "Value at retirement",
    planPlusFund: "Pension plan + Fund (tax saving)",
    planOnly: "Pension plan",
    fundInvestment: "Investment fund",
    totalInvested: "Total invested:",
    totalIRPFSaved: "Total income tax saved (not reinvested):",
    detailBruto: "Gross detail:",
    detailInvertido: "Invested detail:",
    plan: "Plan",
    fund: "Fund",
    fundIRPF: "Fund (tax saving)",
    withdrawalsDuration: "Withdrawals and capital duration",
    scenario: "Scenario",
    totalNet: "Total Net",
    totalNetTip: "Total net amount received from the accumulated capital (contributions + return) of the pension plan or funds after exhausting the duration. Does not include public pension payments.",
    totalTaxes: "Total Taxes",
    totalTaxesTip: "Total taxes paid from withdrawals of the accumulated capital of the pension plan or funds during the duration. Does not include taxes associated with the public pension.",
    duration: "Duration",
    grossAnnual: "Annual Gross",
    grossAnnualTip: "Gross annual amount to withdraw before taxes to obtain the indicated net.",
    withdraw: "Withdraw",
    netPerYear: "net per year",
    totalNetWithPension: "Total net with pension:",
    totalWithdrawal: "Lump sum withdrawal",
    notesTitle: "Notes and assumptions:",
    notes1: "Amounts “Withdraw 10,000/15,000/…” are <b>net</b> received each year; the required gross is computed and added to the <b>net pension</b>.",
    notes2: "Legal contribution limits: up to <b>€1,500</b>/year in <b>individual plans (PPI)</b>. The <b>€10,000</b>/year cap only applies when there is an <b>employment plan</b> (PPE/PPSE) with company contributions and, where applicable, worker contributions linked to that plan. In this calculator the “Annual contribution” field is limited to €10,000 assuming that scenario.",
    notes3: "In partial withdrawals, each year the IRR is first applied to the remaining capital and then the gross withdrawal needed to reach the net is deducted; the balance continues compounding until exhausted.",
    notes4: "Withdrawal duration is limited to a maximum of <b>35 years</b> (≈ 420 months). If the annual IRR is greater than or equal to the withdrawal rate, the capital might not be depleted; this cap reflects a reasonable retirement horizon and avoids unhelpful results.",
    notes5: "General income tax: sum of <i>2025 state scale</i> and <i>2025 regional scale</i> of the <b>selected region</b>. Includes all common-regime regions (excluding Navarre and Basque Country).",
    notes6: "Savings tax: 19%/21%/23%/27%/30% (Spain · 2025 rules). Fund withdrawals are taxed only on the gain realized each year.",
    footer: "© David Gonzalez, if you want to know more about me, visit",
    moreInfo: "More info",
    langES: "ES",
    langEN: "EN",
  }
} as const;
const REGIONS = [
  "Andalucía",
  "Aragón",
  "Asturias",
  "Islas Baleares",
  "Canarias",
  "Cantabria",
  "Cataluña",
  "Castilla-La Mancha",
  "Castilla y León",
  "Comunidad de Madrid",
  "Comunidad Valenciana",
  "Extremadura",
  "Galicia",
  "La Rioja",
  "Región de Murcia",
] as const;
type RegionKey = typeof REGIONS[number];
type ScaleSegment = { upTo: number; rate: number };
const SAVINGS_SCALE: ScaleSegment[] = [
  { upTo: 6000, rate: 0.19 },
  { upTo: 50000, rate: 0.21 },
  { upTo: 200000, rate: 0.23 },
  { upTo: 300000, rate: 0.27 },
  { upTo: Infinity, rate: 0.30 },
];
const GENERAL_STATE_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.095 },
  { upTo: 20200, rate: 0.12 },
  { upTo: 35200, rate: 0.15 },
  { upTo: 60000, rate: 0.185 },
  { upTo: 300000, rate: 0.225 },
  { upTo: Infinity, rate: 0.245 },
];
const ANDALUCIA_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 13000, rate: 0.095 },
  { upTo: 21100, rate: 0.12 },
  { upTo: 35200, rate: 0.15 },
  { upTo: 60000, rate: 0.185 },
  { upTo: Infinity, rate: 0.225 },
];
const ARAGON_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 13072.5, rate: 0.095 },
  { upTo: 21210, rate: 0.12 },
  { upTo: 36960, rate: 0.15 },
  { upTo: 52500, rate: 0.185 },
  { upTo: 60000, rate: 0.205 },
  { upTo: 80000, rate: 0.23 },
  { upTo: 90000, rate: 0.24 },
  { upTo: 130000, rate: 0.25 },
  { upTo: Infinity, rate: 0.255 },
];
const ASTURIAS_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.10 },
  { upTo: 17707.2, rate: 0.12 },
  { upTo: 33007.2, rate: 0.14 },
  { upTo: 53407.2, rate: 0.185 },
  { upTo: 70000, rate: 0.215 },
  { upTo: 90000, rate: 0.225 },
  { upTo: 175000, rate: 0.25 },
  { upTo: Infinity, rate: 0.255 },
];
const BALEARES_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 10000, rate: 0.09 },
  { upTo: 18000, rate: 0.1125 },
  { upTo: 30000, rate: 0.1425 },
  { upTo: 48000, rate: 0.175 },
  { upTo: 70000, rate: 0.19 },
  { upTo: 90000, rate: 0.2175 },
  { upTo: 120000, rate: 0.2275 },
  { upTo: 175000, rate: 0.2375 },
  { upTo: Infinity, rate: 0.2475 },
];
const CANARIAS_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.09 },
  { upTo: 17707.2, rate: 0.115 },
  { upTo: 33007.2, rate: 0.14 },
  { upTo: 53407.2, rate: 0.185 },
  { upTo: 90000, rate: 0.235 },
  { upTo: 120000, rate: 0.25 },
  { upTo: Infinity, rate: 0.26 },
];
const CANTABRIA_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 13000, rate: 0.085 },
  { upTo: 21000, rate: 0.11 },
  { upTo: 35200, rate: 0.145 },
  { upTo: 60000, rate: 0.18 },
  { upTo: 90000, rate: 0.225 },
  { upTo: Infinity, rate: 0.245 },
];
const CASTILLA_LA_MANCHA_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.095 },
  { upTo: 20200, rate: 0.12 },
  { upTo: 35200, rate: 0.15 },
  { upTo: 60000, rate: 0.185 },
  { upTo: Infinity, rate: 0.225 },
];
const CASTILLA_Y_LEON_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.09 },
  { upTo: 20200, rate: 0.12 },
  { upTo: 35200, rate: 0.14 },
  { upTo: 60000, rate: 0.185 },
  { upTo: Infinity, rate: 0.215 },
];
const CATALONIA_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.105 },
  { upTo: 17707.2, rate: 0.12 },
  { upTo: 21000, rate: 0.14 },
  { upTo: 33007.2, rate: 0.15 },
  { upTo: 53407.2, rate: 0.188 },
  { upTo: 90000, rate: 0.215 },
  { upTo: 120000, rate: 0.235 },
  { upTo: 175000, rate: 0.245 },
  { upTo: Infinity, rate: 0.255 },
];
const MADRID_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 13362.22, rate: 0.085 },
  { upTo: 19004.63, rate: 0.107 },
  { upTo: 35425.68, rate: 0.128 },
  { upTo: 57320.4, rate: 0.174 },
  { upTo: Infinity, rate: 0.205 },
];
const VALENCIANA_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12000, rate: 0.09 },
  { upTo: 22000, rate: 0.12 },
  { upTo: 32000, rate: 0.15 },
  { upTo: 42000, rate: 0.175 },
  { upTo: 52000, rate: 0.20 },
  { upTo: 62000, rate: 0.225 },
  { upTo: 72000, rate: 0.25 },
  { upTo: 100000, rate: 0.265 },
  { upTo: 150000, rate: 0.275 },
  { upTo: 200000, rate: 0.285 },
  { upTo: Infinity, rate: 0.295 },
];
const EXTREMADURA_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.08 },
  { upTo: 20200, rate: 0.10 },
  { upTo: 24200, rate: 0.16 },
  { upTo: 35200, rate: 0.175 },
  { upTo: 60000, rate: 0.21 },
  { upTo: 80200, rate: 0.235 },
  { upTo: 99200, rate: 0.24 },
  { upTo: 120200, rate: 0.245 },
  { upTo: 300000, rate: 0.25 },
  { upTo: Infinity, rate: 0.25 },
];
const GALICIA_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.09 },
  { upTo: 12985, rate: 0.09 },
  { upTo: 20200, rate: 0.1165 },
  { upTo: 21068, rate: 0.1165 },
  { upTo: 35200, rate: 0.149 },
  { upTo: 47600, rate: 0.184 },
  { upTo: 60000, rate: 0.225 },
  { upTo: Infinity, rate: 0.225 },
];
const LA_RIOJA_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.08 },
  { upTo: 20200, rate: 0.106 },
  { upTo: 35200, rate: 0.136 },
  { upTo: 40000, rate: 0.178 },
  { upTo: 50000, rate: 0.185 },
  { upTo: 60000, rate: 0.19 },
  { upTo: 120000, rate: 0.245 },
  { upTo: Infinity, rate: 0.27 },
];
const MURCIA_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.095 },
  { upTo: 20200, rate: 0.112 },
  { upTo: 34000, rate: 0.133 },
  { upTo: 35200, rate: 0.179 },
  { upTo: 60000, rate: 0.179 },
  { upTo: Infinity, rate: 0.225 },
];
const AUTON_SCALES_2025: Record<RegionKey, ScaleSegment[]> = {
  "Andalucía": ANDALUCIA_AUTON_SCALE_2025,
  "Aragón": ARAGON_AUTON_SCALE_2025,
  "Asturias": ASTURIAS_AUTON_SCALE_2025,
  "Islas Baleares": BALEARES_AUTON_SCALE_2025,
  "Canarias": CANARIAS_AUTON_SCALE_2025,
  "Cantabria": CANTABRIA_AUTON_SCALE_2025,
  "Cataluña": CATALONIA_AUTON_SCALE_2025,
  "Castilla-La Mancha": CASTILLA_LA_MANCHA_AUTON_SCALE_2025,
  "Castilla y León": CASTILLA_Y_LEON_AUTON_SCALE_2025,
  "Comunidad de Madrid": MADRID_AUTON_SCALE_2025,
  "Comunidad Valenciana": VALENCIANA_AUTON_SCALE_2025,
  "Extremadura": EXTREMADURA_AUTON_SCALE_2025,
  "Galicia": GALICIA_AUTON_SCALE_2025,
  "La Rioja": LA_RIOJA_AUTON_SCALE_2025,
  "Región de Murcia": MURCIA_AUTON_SCALE_2025,
};
function assertValidScale(scale: ScaleSegment[], name: string) {
  let last = -Infinity;
  for (const seg of scale) {
    if (!(seg.upTo > last)) throw new Error(`Escala ${name}: 'upTo' debe ser estrictamente creciente`);
    last = seg.upTo;
  }
  if (scale[scale.length - 1].upTo !== Infinity) throw new Error(`Escala ${name}: el último tramo debe acabar en Infinity`);
}
if (typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production") {
  assertValidScale(SAVINGS_SCALE, "Ahorro 2025");
  assertValidScale(GENERAL_STATE_SCALE_2025, "General estatal 2025");
  for (const [ccaa, scale] of Object.entries(AUTON_SCALES_2025)) {
    assertValidScale(scale as ScaleSegment[], `Autonómica 2025 · ${ccaa}`);
  }
}
function taxFromScale(base: number, scale: ScaleSegment[]) {
  if (base <= 0) return 0;
  let taxed = 0;
  let prev = 0;
  for (const seg of scale) {
    const amount = Math.min(base, seg.upTo) - prev;
    if (amount > 0) {
      taxed += amount * seg.rate;
      prev += amount;
    }
    if (prev >= base) break;
  }
  return taxed;
}
function generalTax(base: number, region: RegionKey) {
  const auton = AUTON_SCALES_2025[region];
  return taxFromScale(base, GENERAL_STATE_SCALE_2025) + taxFromScale(base, auton);
}
function generalMarginalRate(base: number, region: RegionKey) {
  return marginalByDiff(base, region, 10); // 10€ para suavizar bordes de tramo
}
function marginalByDiff(base: number, region: RegionKey, step = 10) {
  if (step <= 0) step = 1;
  const t0 = generalTax(base, region);
  const t1 = generalTax(base + step, region);
  return (t1 - t0) / step;
}
function savingsTax(amount: number) {
  return taxFromScale(amount, SAVINGS_SCALE);
}
function fvAnnuity(pmt: number, r: number, n: number) {
  if (n <= 0) return 0;
  if (r === 0) return pmt * n;
  return (pmt * (Math.pow(1 + r, n) - 1)) / r;
}
const WITHDRAWALS = [10000, 15000, 20000, 25000, 35000] as const;
const MAX_WITHDRAWAL_YEARS = 35 as const;

function netFromPlanGross(gross: number, pensionAnnual: number, region: RegionKey) {
  const tax = Math.max(0, generalTax(pensionAnnual + gross, region) - generalTax(pensionAnnual, region));
  return gross - tax;
}
function grossFromPlanNet(targetNet: number, pensionAnnual: number, region: RegionKey) {
  if (targetNet <= 0) return 0;
  let lo = 0, hi = targetNet * 1.5 + 100;
  while (netFromPlanGross(hi, pensionAnnual, region) < targetNet) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const net = netFromPlanGross(mid, pensionAnnual, region);
    if (net >= targetNet) hi = mid; else lo = mid;
  }
  return hi;
}
function netFromFundGross(gross: number, gainFraction: number) {
  const realizedGain = gross * gainFraction;
  const tax = savingsTax(realizedGain);
  return gross - tax;
}
function grossFromFundNet(targetNet: number, gainFraction: number) {
  if (targetNet <= 0) return 0;
  if (gainFraction <= 0) return targetNet;
  let lo = 0, hi = targetNet / (1 - 0.30) + 100;
  while (netFromFundGross(hi, gainFraction) < targetNet) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const net = netFromFundGross(mid, gainFraction);
    if (net >= targetNet) hi = mid; else lo = mid;
  }
  return hi;
}
function simulatePlanWithdrawals(params: {
  startCapital: number;
  pensionAnnual: number;
  annualNetWithdrawal: number;
  r: number;
  region: RegionKey;
}) {
  const { startCapital, pensionAnnual, annualNetWithdrawal, r, region } = params;
  let value = startCapital;
  let year = 0;
  let totalGross = 0;
  let totalTax = 0;
  let totalNet = 0;
  let lastNet = 0;
  while (value > 1e-6 && year < MAX_WITHDRAWAL_YEARS) {
    year += 1;
    value *= 1 + r;
    const grossNeeded = grossFromPlanNet(annualNetWithdrawal, pensionAnnual, region);
    const w = Math.min(grossNeeded, value);
    const tax = Math.max(0, generalTax(pensionAnnual + w, region) - generalTax(pensionAnnual, region));
    const net = w - tax;
    value -= w;
    totalGross += w;
    totalTax += tax;
    totalNet += net;
    lastNet = net;
    if (w <= 0) break;
  }
  let fullYears = 0;
  if (year > 0) {
    fullYears = (year - 1) + (lastNet > 0 ? lastNet / Math.max(annualNetWithdrawal, 1) : 0);
  }
  const months = Math.min(MAX_WITHDRAWAL_YEARS * 12, Math.max(0, Math.round(fullYears * 12)));
  return { yearsFloat: fullYears, months, totalGross, totalTax, totalNet };
}
function simulateFundWithdrawals(params: {
  startValue: number;
  costBasis: number;
  annualNetWithdrawal: number;
  r: number;
}) {
  let { startValue, costBasis, annualNetWithdrawal, r } = params;
  let value = startValue;
  let year = 0;
  let totalGross = 0;
  let totalTax = 0;
  let totalNet = 0;
  let lastNet = 0;
  while (value > 1e-6 && year < MAX_WITHDRAWAL_YEARS) {
    year += 1;
    value *= 1 + r;
    const gainFraction = value > 0 ? Math.max(0, (value - costBasis) / value) : 0;
    const grossNeeded = grossFromFundNet(annualNetWithdrawal, gainFraction);
    const w = Math.min(grossNeeded, value);
    const realizedGain = w * gainFraction;
    const tax = savingsTax(realizedGain);
    const net = w - tax;
    const basisRedeemed = w * (value > 0 ? costBasis / value : 1);
    costBasis = Math.max(0, costBasis - basisRedeemed);
    value = Math.max(0, value - w);
    totalGross += w;
    totalTax += tax;
    totalNet += net;
    lastNet = net;
    if (w <= 0) break;
  }
  let fullYears = 0;
  if (year > 0) {
    fullYears = (year - 1) + (lastNet > 0 ? lastNet / Math.max(annualNetWithdrawal, 1) : 0);
  }
  const months = Math.min(MAX_WITHDRAWAL_YEARS * 12, Math.max(0, Math.round(fullYears * 12)));
  return { yearsFloat: fullYears, months, totalGross, totalTax, totalNet };
}
function simulateCombinedWithdrawals(params: {
  startPlanCapital: number;
  startReinvValue: number;
  reinvCostBasis: number;
  pensionAnnual: number;
  annualNetWithdrawal: number;
  r: number;
  region: RegionKey;
}) {
  let { startPlanCapital, startReinvValue, reinvCostBasis, pensionAnnual, annualNetWithdrawal, r, region } = params;
  let planValue = startPlanCapital;
  let reinvValue = startReinvValue;
  let basis = reinvCostBasis;
  let year = 0;
  let totalGross = 0;
  let totalTax = 0;
  let totalNet = 0;
  let planNetTot = 0;
  let planTaxTot = 0;
  let reinvNetTot = 0;
  let reinvTaxTot = 0;
  let lastNet = 0;
  while ((planValue > 1e-6 || reinvValue > 1e-6) && year < MAX_WITHDRAWAL_YEARS) {
    year += 1;
    planValue *= 1 + r;
    reinvValue *= 1 + r;
    const avail = planValue + reinvValue;
    if (avail <= 1e-12) break;
    const sharePlan = avail > 0 ? planValue / avail : 0;
    const netPlanTarget = annualNetWithdrawal * sharePlan;
    const grossPlanNeeded = grossFromPlanNet(netPlanTarget, pensionAnnual, region);
    const wPlan = Math.min(grossPlanNeeded, planValue);
    const taxPlan = Math.max(0, generalTax(pensionAnnual + wPlan, region) - generalTax(pensionAnnual, region));
    const netPlan = wPlan - taxPlan;
    planValue = Math.max(0, planValue - wPlan);
    const remainingNet = annualNetWithdrawal - netPlan;
    const gainFraction = reinvValue > 0 ? Math.max(0, (reinvValue - basis) / reinvValue) : 0;
    const grossReinvNeeded = grossFromFundNet(remainingNet, gainFraction);
    const wReinv = Math.min(grossReinvNeeded, reinvValue);
    const realizedGain = wReinv * gainFraction;
    const taxReinv = savingsTax(realizedGain);
    const netReinv = wReinv - taxReinv;
    const basisRedeemed = wReinv * (reinvValue > 0 ? basis / reinvValue : 1);
    basis = Math.max(0, basis - basisRedeemed);
    reinvValue = Math.max(0, reinvValue - wReinv);
    const netTotal = netPlan + netReinv;
    totalGross += wPlan + wReinv;
    totalTax += taxPlan + taxReinv;
    totalNet += netTotal;
    planNetTot += netPlan;
    planTaxTot += taxPlan;
    reinvNetTot += netReinv;
    reinvTaxTot += taxReinv;
    lastNet = netTotal;
    if (wPlan + wReinv <= 0) break;
  }
  let fullYears = 0;
  if (year > 0) {
    fullYears = (year - 1) + (lastNet > 0 ? lastNet / Math.max(annualNetWithdrawal, 1) : 0);
  }
  const months = Math.min(MAX_WITHDRAWAL_YEARS * 12, Math.max(0, Math.round(fullYears * 12)));
  return {
    yearsFloat: fullYears,
    months,
    totalGross,
    totalTax,
    totalNet,
    planNet: planNetTot,
    planTax: planTaxTot,
    reinvNet: reinvNetTot,
    reinvTax: reinvTaxTot,
  };
}

function runTests() {
  const approx = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
  console.assert(approx(savingsTax(1000), 190), "savingsTax 1000 => 190");
  console.assert(approx(savingsTax(7000), 6000 * 0.19 + 1000 * 0.21), "savingsTax tramos");
  console.assert(approx(savingsTax(51000), 6000 * 0.19 + 44000 * 0.21 + 1000 * 0.23), "savingsTax salto 50k");
  console.assert(approx(savingsTax(6000), 6000 * 0.19), "savingsTax umbral 6k");
  console.assert(approx(fvAnnuity(1500, 0, 10), 15000), "fvAnnuity r=0");
  console.assert(approx(Math.round(fvAnnuity(1000, 0.05, 1)), 1000), "fvAnnuity 1 año r>0 (aprox)");
  console.assert(generalTax(0, "Cataluña") === 0, "generalTax 0 => 0");
  const mgCAT = generalMarginalRate(50000, "Cataluña");
  const mgMAD = generalMarginalRate(50000, "Comunidad de Madrid");
  console.assert(mgMAD < mgCAT, "marginal Madrid < Cataluña (esperado)");
  const mgVAL = generalMarginalRate(250000, "Comunidad Valenciana");
  const mgMAD_hi = generalMarginalRate(250000, "Comunidad de Madrid");
  console.assert(mgVAL > mgMAD_hi, "Valenciana debería tener mayor marginal alto que Madrid");
  const mgEXT_low = generalMarginalRate(10000, "Extremadura");
  const mgCYL_low = generalMarginalRate(10000, "Castilla y León");
  console.assert(mgEXT_low < mgCYL_low, "Extremadura tiene mínimo autonómico más bajo que CyL");
  const z1 = simulatePlanWithdrawals({ startCapital: 0, pensionAnnual: 0, annualNetWithdrawal: 10000, r: 0.05, region: "Cataluña" });
  console.assert(z1.months === 0, "Plan con 0 capital inicial debe dar 0 meses");
  const z2 = simulateFundWithdrawals({ startValue: 0, costBasis: 0, annualNetWithdrawal: 10000, r: 0.05 });
  console.assert(z2.months === 0, "Fondo con 0 valor inicial debe dar 0 meses");
  const z3 = simulateCombinedWithdrawals({ startPlanCapital: 0, startReinvValue: 0, reinvCostBasis: 0, pensionAnnual: 0, annualNetWithdrawal: 10000, r: 0.05, region: "Cataluña" });
  console.assert(z3.months === 0, "Combinado con 0 capital inicial debe dar 0 meses");
  const capFund = simulateFundWithdrawals({ startValue: 1e9, costBasis: 1e9, annualNetWithdrawal: 1000, r: 0.1 });
  console.assert(capFund.months === MAX_WITHDRAWAL_YEARS * 12, "Cap duración (fondo): <= 35 años");
  const capPlan = simulatePlanWithdrawals({ startCapital: 1e9, pensionAnnual: 0, annualNetWithdrawal: 1000, r: 0.1, region: "Cataluña" });
  console.assert(capPlan.months === MAX_WITHDRAWAL_YEARS * 12, "Cap duración (plan): <= 35 años");
  const capComb = simulateCombinedWithdrawals({ startPlanCapital: 5e8, startReinvValue: 5e8, reinvCostBasis: 5e8, pensionAnnual: 0, annualNetWithdrawal: 1000, r: 0.1, region: "Cataluña" });
  console.assert(capComb.months === MAX_WITHDRAWAL_YEARS * 12, "Cap duración (combinado): <= 35 años");
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

if (typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production") { runTests(); }
export default function App() {
  const [lang, setLang] = useState<'es' | 'en'>(getStoredLang);
  const [themeChoice, setThemeChoice] = useState<ThemeMode | null>(getStoredThemeChoice);
  const [salaryInput, setSalaryInput] = useState("45000");
  const [yearsInput, setYearsInput] = useState("25");
  const [annualContributionInput, setAnnualContributionInput] = useState("1500");
  const [tir, setTir] = useState(5); // %
  const [pensionInput, setPensionInput] = useState("22000");
  const [reinvestSavings, setReinvestSavings] = useState(false);
  const [region, setRegion] = useState<RegionKey>("Cataluña");
  const [shareUrl, setShareUrl] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const t = TEXTS[lang];
  const locale = lang === 'es' ? 'es-ES' : 'en-US';
  const activeTheme = resolveTheme(themeChoice);
  const fmt = (n: number) => fmtEUR(n, locale);
  const fmtDur = (months: number) => formatDuration(months, lang);
  const hasLoadedParams = useRef(false);

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
    if (typeof window === "undefined" || hasLoadedParams.current) return;
    hasLoadedParams.current = true;
    const params = new URLSearchParams(window.location.search);
    const urlLang = params.get("lang");
    if (urlLang === "es" || urlLang === "en") {
      setLang(urlLang);
    }
    const regionParam = params.get("region");
    if (regionParam && REGIONS.includes(regionParam as RegionKey)) {
      setRegion(regionParam as RegionKey);
    }
    const salaryParam = params.get("salary");
    if (salaryParam !== null && salaryParam !== "") {
      setSalaryInput(salaryParam);
    }
    const yearsParam = params.get("years");
    if (yearsParam !== null && yearsParam !== "") {
      setYearsInput(clampYearsInput(yearsParam));
    }
    const contribParam = params.get("contrib");
    if (contribParam !== null && contribParam !== "") {
      setAnnualContributionInput(contribParam);
    }
    const tirParam = params.get("tir");
    if (tirParam !== null && tirParam !== "") {
      const parsed = Number(tirParam);
      if (Number.isFinite(parsed)) {
        setTir(Math.min(25, Math.max(0, parsed)));
      }
    }
    const pensionParam = params.get("pension");
    if (pensionParam !== null && pensionParam !== "") {
      setPensionInput(pensionParam);
    }
    const reinvestParam = params.get("reinvest");
    if (reinvestParam !== null && reinvestParam !== "") {
      setReinvestSavings(reinvestParam === "1" || reinvestParam === "true");
    }
  }, []);
  const buildShareUrl = () => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("lang", lang);
    url.searchParams.set("region", region);
    url.searchParams.set("salary", salaryInput);
    url.searchParams.set("years", yearsInput);
    url.searchParams.set("contrib", annualContributionInput);
    url.searchParams.set("tir", String(tir));
    url.searchParams.set("pension", pensionInput);
    url.searchParams.set("reinvest", reinvestSavings ? "1" : "0");
    return url.toString();
  };
  const handleShareLink = async () => {
    const url = buildShareUrl();
    setShareUrl(url);
    if (!url) return;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        setShareStatus(t.linkCopied);
        return;
      } catch {
        setShareStatus(t.linkReady);
        return;
      }
    }
    setShareStatus(t.linkReady);
  };
  const salary = useMemo(() => Math.max(0, parseNum(salaryInput)), [salaryInput]);
  const years = useMemo(() => Math.min(67, Math.max(0, Math.floor(parseNum(yearsInput)))), [yearsInput]);
  const annualContributionRaw = useMemo(() => Math.max(0, parseNum(annualContributionInput)), [annualContributionInput]);
  const pension = useMemo(() => Math.max(0, parseNum(pensionInput)), [pensionInput]);
  const pensionNet = useMemo(() => pension - generalTax(pension, region), [pension, region]);
  const r = useMemo(() => Math.max(0, Math.min(0.25, tir / 100)), [tir]);
  const contrib = useMemo(() => Math.min(10000, annualContributionRaw), [annualContributionRaw]);
  const N = useMemo(() => years, [years]);
  const marginalGeneral = useMemo(() => generalMarginalRate(salary, region), [salary, region]);
  const accFV = useMemo(() => fvAnnuity(contrib, r, N), [contrib, r, N]);
  const planFV = accFV;
  const fundFV = accFV;
  const fundCost = useMemo(() => contrib * N, [contrib, N]);
  const planCost = fundCost;
  const annualIRPFSaving = useMemo(() => contrib * marginalGeneral, [contrib, marginalGeneral]);
  const totalIRPFSaved = useMemo(() => annualIRPFSaving * N, [annualIRPFSaving, N]);
  const reinvestFV = useMemo(
    () => (reinvestSavings ? fvAnnuity(annualIRPFSaving, r, N) : 0),
    [annualIRPFSaving, r, N, reinvestSavings]
  );
  const reinvestCost = useMemo(
    () => (reinvestSavings ? annualIRPFSaving * N : 0),
    [annualIRPFSaving, N, reinvestSavings]
  );
  const combinedPlanBruto = useMemo(() => (reinvestSavings ? planFV + reinvestFV : planFV), [reinvestSavings, planFV, reinvestFV]);
  const combinedPlanInvertido = useMemo(() => (reinvestSavings ? planCost + reinvestCost : planCost), [reinvestSavings, planCost, reinvestCost]);
  const planTaxLump = useMemo(
    () => Math.max(0, generalTax(pension + planFV, region) - generalTax(pension, region)),
    [pension, planFV, region]
  );
  const planNetLump = useMemo(() => planFV - planTaxLump, [planFV, planTaxLump]);
  const fundGain = useMemo(() => Math.max(0, fundFV - fundCost), [fundFV, fundCost]);
  const fundTaxLump = useMemo(() => savingsTax(fundGain), [fundGain]);
  const fundNetLump = useMemo(() => fundFV - fundTaxLump, [fundFV, fundTaxLump]);
  const reinvGain = useMemo(() => Math.max(0, reinvestFV - reinvestCost), [reinvestFV, reinvestCost]);
  const reinvTaxLump = useMemo(() => savingsTax(reinvGain), [reinvGain]);
  const reinvNetLump = useMemo(() => reinvestFV - reinvTaxLump, [reinvestFV, reinvTaxLump]);
  const combinedNetLump = useMemo(
    () => (reinvestSavings ? planNetLump + reinvNetLump : planNetLump),
    [reinvestSavings, planNetLump, reinvNetLump]
  );
  const combinedTaxLump = useMemo(
    () => (reinvestSavings ? planTaxLump + reinvTaxLump : planTaxLump),
    [reinvestSavings, planTaxLump, reinvTaxLump]
  );
  const planSims = useMemo(
    () => WITHDRAWALS.map((w) => ({ w, ...simulatePlanWithdrawals({ startCapital: planFV, pensionAnnual: pension, annualNetWithdrawal: w, r, region }) })),
    [planFV, pension, r, region]
  );
  const fundSims = useMemo(
    () => WITHDRAWALS.map((w) => ({ w, ...simulateFundWithdrawals({ startValue: fundFV, costBasis: fundCost, annualNetWithdrawal: w, r }) })),
    [fundFV, fundCost, r]
  );
  const combinedSims = useMemo(
    () => (!reinvestSavings
      ? []
      : WITHDRAWALS.map((w) =>
          simulateCombinedWithdrawals({
            startPlanCapital: planFV,
            startReinvValue: reinvestFV,
            reinvCostBasis: reinvestCost,
            pensionAnnual: pension,
            annualNetWithdrawal: w,
            r,
            region,
          })
        )
    ),
    [planFV, reinvestFV, reinvestCost, pension, r, region, reinvestSavings]
  );

  const planGrossAnns = useMemo(
    () => WITHDRAWALS.map((w) => grossFromPlanNet(w, pension, region)),
    [pension, region]
  );
  const fundGainFraction = useMemo(
    () => (fundFV > 0 ? Math.max(0, (fundFV - fundCost) / fundFV) : 0),
    [fundFV, fundCost]
  );
  const fundGrossAnns = useMemo(
    () => WITHDRAWALS.map((w) => grossFromFundNet(w, fundGainFraction)),
    [fundGainFraction]
  );
  const combinedGrossAnns = useMemo(
    () =>
      (!reinvestSavings
        ? []
        : WITHDRAWALS.map((w) => {
            const avail = planFV + reinvestFV;
            const sharePlan = avail > 0 ? planFV / avail : 0;
            const netPlan = w * sharePlan;
            const grossPlan = grossFromPlanNet(netPlan, pension, region);
            const remainingNet = w - netPlan;
            const gainFraction = reinvestFV > 0 ? Math.max(0, (reinvestFV - reinvestCost) / reinvestFV) : 0;
            const grossReinv = grossFromFundNet(remainingNet, gainFraction);
            return { total: grossPlan + grossReinv, plan: grossPlan, reinv: grossReinv };
          })),
    [reinvestSavings, planFV, reinvestFV, reinvestCost, pension, region]
  );
  return (
    <div className="relative min-h-screen text-gray-900">
      
      <style>{`
        .landing-bg{
          position: fixed;
          inset: 0;
          z-index: -1;
          background:
            radial-gradient(900px 600px at 10% 0%, rgba(14,165,233,.12), transparent 60%),
            radial-gradient(900px 600px at 90% -10%, rgba(2,132,199,.10), transparent 60%),
            linear-gradient(180deg, #ffffff 0%, #f8fbff 60%, #ffffff 100%),
            linear-gradient(to bottom, rgba(15,23,42,.04) 1px, transparent 1px),
            linear-gradient(to right, rgba(15,23,42,.04) 1px, transparent 1px);
          background-size: auto, auto, 100% 100%, 24px 24px, 24px 24px;
          background-position: center;
        }
        html[data-theme="dark"] .landing-bg{
          background:
            radial-gradient(900px 600px at 10% 0%, rgba(14,165,233,.20), transparent 62%),
            radial-gradient(900px 600px at 90% -10%, rgba(8,47,73,.55), transparent 62%),
            linear-gradient(180deg,#020617 0%,#0f172a 60%,#020617 100%),
            linear-gradient(to bottom, rgba(148,163,184,.10) 1px, transparent 1px),
            linear-gradient(to right, rgba(148,163,184,.10) 1px, transparent 1px);
        }
      `}</style>
      <div className="landing-bg" aria-hidden />
      
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline"
          >
            <span aria-hidden>←</span>
            {t.back}
          </a>
          <div className="flex items-center gap-2">
            <div
              className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
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
            <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm" role="group" aria-label="Language">
              <button
                type="button"
                onClick={() => setLang("es")}
                aria-pressed={lang === "es"}
                className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  lang === "es" ? "bg-cyan-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {t.langES}
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                aria-pressed={lang === "en"}
                className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  lang === "en" ? "bg-cyan-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {t.langEN}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-3">{t.title}</h1>
        <p className="text-sm md:text-base text-gray-700 mb-6" dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.intro) }} />
        <div className="grid grid-cols-1 gap-6">
          
          <div>
            <div className="bg-white rounded-2xl shadow p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-sm">{t.region}</label>
                  <select
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus-visible:outline-none"
                    value={region}
                    onChange={(e) => setRegion(e.target.value as RegionKey)}
                  >
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm">{t.salary}</label>
                  <div className="relative">
                    <input
                      type="number"
                      className="w-full border rounded-xl p-2 pr-10 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus-visible:outline-none"
                      value={salaryInput}
                      onChange={(e) => setSalaryInput(e.target.value)}
                      min={0}
                      step={1000}
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-gray-500 pointer-events-none">€</span>
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm">{t.yearsToRetire}</label>
                  <input
                    type="number"
                    className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus-visible:outline-none"
                    value={yearsInput}
                    onChange={(e) => setYearsInput(clampYearsInput(e.target.value))}
                    min={0}
                    max={67}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm">{t.annualContribution} <InfoTip lang={lang} className="ml-1 align-middle" text={t.annualContributionTip}/></label>
                  <div className="relative">
                    <input
                      type="number"
                      className="w-full border rounded-xl p-2 pr-10 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus-visible:outline-none"
                      value={annualContributionInput}
                      onChange={(e) => setAnnualContributionInput(e.target.value)}
                      min={0}
                      max={10000}
                      onBlur={() => { const n = parseNum(annualContributionInput); const c = Math.min(10000, Math.max(0, n)); setAnnualContributionInput(String(c)); }}
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-gray-500 pointer-events-none">€</span>
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm">{t.expectedReturn}: {tir}%</label>
                  <input
                    type="range"
                    className="w-full accent-cyan-600"
                    min={0}
                    max={25}
                    step={0.1}
                    value={tir}
                    onChange={(e) => setTir(Number(e.target.value))}
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="block text-sm">{t.expectedPublicPension}</label>
                  <div className="relative">
                    <input
                      type="number"
                      className="w-full border rounded-xl p-2 pr-10 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 focus-visible:outline-none"
                      value={pensionInput}
                      onChange={(e) => setPensionInput(e.target.value)}
                      min={0}
                      step={500}
                    />
                    <span className="absolute inset-y-0 right-3 flex items-center text-gray-500 pointer-events-none">€</span>
                  </div>
                </div>
                <div className="md:col-span-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 md:items-center md:gap-4">
                    <div>
                      <label className="block text-sm mb-2">{t.reinvestLabel} <InfoTip lang={lang} className="ml-1 align-middle" text={t.reinvestTip} /></label>
                      <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1" role="radiogroup" aria-label={t.reinvestLabel}>
                        <label className="cursor-pointer">
                          <input type="radio" name="reinv" value="no" className="sr-only peer" checked={!reinvestSavings} onChange={() => setReinvestSavings(false)} />
                          <span className="px-3 py-1.5 text-sm rounded-lg block select-none text-gray-700 peer-checked:bg-cyan-600 peer-checked:text-white">{t.no}</span>
                        </label>
                        <label className="cursor-pointer">
                          <input type="radio" name="reinv" value="si" className="sr-only peer" checked={reinvestSavings} onChange={() => setReinvestSavings(true)} />
                          <span className="px-3 py-1.5 text-sm rounded-lg block select-none text-gray-700 peer-checked:bg-cyan-600 peer-checked:text-white">{t.yes}</span>
                        </label>
                      </div>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={handleShareLink}
                          className="px-3 py-1.5 text-sm rounded-lg border border-cyan-600 text-cyan-700 hover:bg-cyan-50"
                        >
                          {t.shareLink}
                        </button>
                        {shareUrl ? (
                          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                              {t.linkReady}
                            </p>
                            <div className="mt-3 flex flex-1 flex-wrap items-center gap-3">
                              <input
                                type="text"
                                readOnly
                                value={shareUrl}
                                className="min-w-[260px] flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs text-slate-700 shadow-sm"
                              />
                              {shareStatus === t.linkCopied ? (
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                                  {t.linkCopied}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 md:text-right mt-3 md:mt-0">
                      <div className="space-y-2 md:text-right">
                        <div>
                          {t.pensionNetPrev}{" "}
                          <span className="font-semibold text-gray-900 text-base md:text-lg">{fmt(pensionNet)}</span>
                        </div>
                        <div>
                          {t.marginalType}{" "}
                          <span className="font-semibold text-gray-900 text-base md:text-lg">{(marginalGeneral * 100).toFixed(1)}%</span>
                        </div>
                        <div>
                          {t.annualIRPFSaving}{" "}
                          <span className="font-semibold text-gray-900 text-base md:text-lg">{fmt(annualIRPFSaving)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
              </div>
            </div>
          </div>
          
          <div className="space-y-6">
            <h2 className="text-xl md:text-2xl font-bold">{t.retirementValue}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="bg-white rounded-2xl shadow p-4">
                <div className="text-base font-semibold text-gray-700">{reinvestSavings ? t.planPlusFund : t.planOnly}</div>
                <div className="text-xl font-bold">{fmt(combinedPlanBruto)}</div>
                <div className="mt-2 text-sm">{t.totalInvested} <b>{fmt(combinedPlanInvertido)}</b></div>
                {reinvestSavings ? (
                  <>
                    <div className="text-xs text-gray-500 mt-2">{t.detailBruto} {t.plan} {fmt(planFV)} · {t.fundIRPF} {fmt(reinvestFV)}</div>
                    <div className="text-xs text-gray-500">{t.detailInvertido} {t.plan} {fmt(planCost)} · {t.fundIRPF} {fmt(reinvestCost)}</div>
                  </>
                ) : (
                  <>
                    <div className="mt-1 text-sm">{t.totalIRPFSaved} <b>{fmt(totalIRPFSaved)}</b></div>
                    <div className="text-xs text-gray-500 mt-2">{t.detailBruto} {t.plan} {fmt(planFV)}</div>
                    <div className="text-xs text-gray-500">{t.detailInvertido} {t.plan} {fmt(planCost)}</div>
                  </>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow p-4">
                <div className="text-base font-semibold text-gray-700">{t.fundInvestment}</div>
                <div className="text-xl font-bold">{fmt(fundFV)}</div>
                <div className="mt-2 text-sm">{t.totalInvested} <b>{fmt(fundCost)}</b></div>
                <div className="text-xs text-gray-500 mt-2">{t.detailBruto} {t.fund} {fmt(fundFV)}</div>
                <div className="text-xs text-gray-500">{t.detailInvertido} {t.fund} {fmt(fundCost)}</div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-semibold mb-3">{t.withdrawalsDuration}</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="py-2 pr-3">{t.scenario}</th>
                      <th className="py-2 pr-3 text-center">{t.totalNet} <InfoTip lang={lang} className="ml-1 align-middle" text={t.totalNetTip} /></th>
                      <th className="py-2 pr-3 text-center">{t.totalTaxes} <InfoTip lang={lang} className="ml-1 align-middle" text={t.totalTaxesTip} /></th>
                      <th className="py-2 pr-3 text-center">{t.duration}</th>
                      <th className="py-2 pr-3 text-center">{t.grossAnnual} <InfoTip lang={lang} className="ml-1 align-middle" text={t.grossAnnualTip} /></th>
                    </tr>
                  </thead>
                  <tbody>

                    <tr>
                      <td colSpan={5} className="bg-slate-200 text-slate-800 font-semibold uppercase tracking-wide py-2 px-3 rounded">
                        {reinvestSavings ? t.planPlusFund : t.planOnly}
                      </td>
                    </tr>
                    
                    {WITHDRAWALS.map((w, idx) => {
                      const ps = planSims[idx];
                      const cs = combinedSims[idx];
                      return (
                        <tr key={`plan-${w}`} className="border-t bg-gray-50">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{t.withdraw} {fmt(w)} {t.netPerYear}</div>
                            <div className="text-xs text-gray-500">{t.totalNetWithPension} {fmt(pensionNet + w)}</div>
                          </td>
                          <td className="py-2 pr-3 text-center">
                            {fmt(reinvestSavings ? cs.totalNet : ps.totalNet)}
                            {reinvestSavings && (
                              <span className="text-gray-500 text-xs"> ({fmt(cs.planNet)} + {fmt(cs.reinvNet)})</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-gray-600 text-center">
                            {fmt(reinvestSavings ? cs.totalTax : ps.totalTax)}
                            {reinvestSavings && (
                              <span className="text-gray-500 text-xs"> ({fmt(cs.planTax)} + {fmt(cs.reinvTax)})</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-center">{fmtDur(reinvestSavings ? cs.months : ps.months)}</td>
                          <td className="py-2 pr-3 text-center">
                            {fmt(reinvestSavings ? combinedGrossAnns[idx].total : planGrossAnns[idx])}
                            {reinvestSavings && (
                              <span className="text-gray-500 text-xs"> ({fmt(combinedGrossAnns[idx].plan)} + {fmt(combinedGrossAnns[idx].reinv)})</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    <tr className="border-t bg-gray-50">
                      <td className="py-2 pr-3 font-medium">{t.totalWithdrawal}</td>
                      <td className="py-2 pr-3 text-center">
                        {fmt(reinvestSavings ? combinedNetLump : planNetLump)}
                        {reinvestSavings && (
                          <span className="text-gray-500 text-xs"> ({fmt(planNetLump)} + {fmt(reinvNetLump)})</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 text-center">
                        {fmt(reinvestSavings ? combinedTaxLump : planTaxLump)}
                        {reinvestSavings && (
                          <span className="text-gray-500 text-xs"> ({fmt(planTaxLump)} + {fmt(reinvTaxLump)})</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-center">—</td>
                      <td className="py-2 pr-3 text-center">—</td>
                    </tr>

                    <tr>
                      <td colSpan={5} className="bg-slate-200 text-slate-800 font-semibold uppercase tracking-wide py-2 px-3 rounded mt-2">
                        {t.fundInvestment}
                      </td>
                    </tr>
                    {WITHDRAWALS.map((w, idx) => {
                      const fs = fundSims[idx];
                      return (
                        <tr key={`fund-${w}`} className="border-t bg-white">
                          <td className="py-2 pr-3">
                            <div className="font-medium">{t.withdraw} {fmt(w)} {t.netPerYear}</div>
                            <div className="text-xs text-gray-500">{t.totalNetWithPension} {fmt(pensionNet + w)}</div>
                          </td>
                          <td className="py-2 pr-3 text-center">{fmt(fs.totalNet)}</td>
                          <td className="py-2 pr-3 text-gray-600 text-center">{fmt(fs.totalTax)}</td>
                          <td className="py-2 pr-3 text-center">{fmtDur(fs.months)}</td>
                          <td className="py-2 pr-3 text-center">{fmt(fundGrossAnns[idx])}</td>
                        </tr>
                      );
                    })}

                    <tr className="border-t bg-white">
                      <td className="py-2 pr-3 font-medium">{t.totalWithdrawal}</td>
                      <td className="py-2 pr-3 text-center">{fmt(fundNetLump)}</td>
                      <td className="py-2 pr-3 text-gray-600 text-center">{fmt(fundTaxLump)}</td>
                      <td className="py-2 pr-3 text-center">—</td>
                      <td className="py-2 pr-3 text-center">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <div className="text-xs text-gray-600 leading-relaxed mt-4">
                <p className="mb-2">{t.notesTitle}</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.notes1) }} />
                  <li dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.notes2) }} />
                  <li dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.notes3) }} />
                  <li dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.notes4) }} />
                  <li dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.notes5) }} />
                  <li dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.notes6) }} />
                </ul>
              </div>
              <div className="mt-6 text-sm text-gray-600">{t.footer} <a className="text-cyan-700 hover:underline" href="https://dragner.net/" target="_blank" rel="noopener"><strong>dragner.net</strong></a></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
