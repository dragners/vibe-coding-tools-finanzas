import React, { useMemo, useState, useEffect, useRef, useId } from "react";

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

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const roundStep05 = (n: number) => Math.round(n * 20) / 20;

function pmt(monthlyRate: number, nMonths: number, principal: number) {
  if (nMonths <= 0) return 0;
  if (monthlyRate === 0) return principal / nMonths;
  const r = monthlyRate;
  return (principal * r) / (1 - Math.pow(1 + r, -nMonths));
}

function taeFromFlows(principal: number, monthlyPayment: number, nMonths: number, extraMonthlyCost: number) {
  if (principal <= 0 || nMonths <= 0 || monthlyPayment < 0) return 0;
  const f = (r: number) => {
    let pv = 0;
    const cash = monthlyPayment + extraMonthlyCost;
    for (let k = 1; k <= nMonths; k++) pv += cash / Math.pow(1 + r, k);
    return principal - pv;
  };
  let lo = 0.0, hi = 1.0;
  let fhi = f(hi);
  let guard = 0;
  while (fhi < 0 && hi < 10 && guard < 32) { hi *= 2; fhi = f(hi); guard++; }
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (fm === 0) { lo = hi = mid; break; }
    if (fm > 0) hi = mid; else lo = mid;
  }
  const rMonthly = (lo + hi) / 2;
  const tae = Math.pow(1 + rMonthly, 12) - 1;
  return Math.max(0, tae);
}

function formatEUR(n: number, locale: string) {
  return n.toLocaleString(locale, { style: "currency", currency: "EUR" });
}
function formatPct(n: number, locale: string) {
  return n.toLocaleString(locale, { style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toComma2(n: number) { return isFinite(n) ? n.toFixed(2).replace('.', ',') : ''; }

type ProductKey = "nom" | "sh" | "sv" | "otros";

type Product = {
  bonifPct: number;
  annualCost: number;
  enabled: boolean;
};

const LANG_STORAGE_KEY = "finanzas.lang";

const getStoredLang = (): Lang => {
  if (typeof window === "undefined") {
    return "es";
  }
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  return stored === "en" ? "en" : "es";
};

type MortgageLine = {
  id: string;
  bank: string;
  tinPct: number;
  products: Record<ProductKey, Product>;
};

const newLine = (i: number): MortgageLine => ({
  id: Math.random().toString(36).slice(2),
  bank: `Banco ${i}`,
  tinPct: 2.0,
  products: {
    nom:   { bonifPct: 0.0, annualCost: 0, enabled: true },
    sh:    { bonifPct: 0.0, annualCost: 0, enabled: true },
    sv:    { bonifPct: 0.0, annualCost: 0, enabled: true },
    otros: { bonifPct: 0.0, annualCost: 0, enabled: true },
  }
});

const PRODUCT_LABEL: Record<ProductKey, string> = { nom: "Nom", sh: "SH", sv: "SV", otros: "Otros" };

const TEXTS = {
  es: {
    back: "Volver a Herramientas",
    title: "Comparador de Ofertas de Hipoteca",
    subtitle: "Compara fácilmente las ofertas de hipotecas calculando el TIN y el TAE teniendo en cuenta todos los productos que bonifican las hipotecas.",
    amount: "Importe a Financiar",
    amountInfo: "En el Importe a financiar no incluyas la entrada ni otros impuestos.",
    term: "Plazo",
    lines: "Ofertas a comparar",
    addLine: "Añadir hipoteca",
    max10: "Máx. 10",
    bank: "Banco",
    tinBase: "TIN",
    tinInfo: "Interés sin Bonificar.",
    bonif: "Bonificación",
    annualCost: "Coste anual",
    selector: "Productos a tener en cuenta",
    results: "Comparativa",
    monthlyNo: "Cuota mensual",
    taeNo: "TAE",
    costAnnualProducts: "Coste Anual con Productos",
    costAnnualInfo: "Incluye cuota mensual × 12 + coste de productos.",
    costTotalHip: "Coste Total Hipoteca",
    costTotalInfoNoProd: "No incluye el coste de productos.",
    productsCol: "Productos",
    productsInfo: "Para cada banco, selecciona los productos que quieras incluir para calcular el coste con bonificaciones.",
    monthlyYes: "Cuota mensual",
    taeYes: "TAE",
    products: "Productos",
    interests: "Intereses",
    payroll: "Nómina",
    payrollInfo: "Nómina y otros productos vinculados que no tengan coste pero sí obliguen su uso, como tarjetas de crédito.",
    homeIns: "Seguro de Hogar",
    lifeIns: "Seguro de Vida",
    others: "Otros",
    notesTitle: "Notas",
    notes1: "El TIN es el tipo nominal anual; la TAE refleja la capitalización (p. ej., mensual): TAE ≈ (1 + TIN/12)^12 − 1, por eso suele ser ligeramente mayor que el TIN.",
    notes2: "La TAE se estima como la TIR anual de los flujos mensuales, prorrateando el coste anual de productos a coste mensual.",
    notes3: "En la columna Productos puedes activar o desactivar Nómina, Seguro de Hogar, Seguro de Vida y Otros para incluirlos en el cálculo bonificado.",
    notes4: "Cálculo de cuota con amortización francesa. Las bonificaciones restan puntos porcentuales al TIN base.",
    langES: "ES",
    langEN: "EN",
    useComma: "Usa coma para decimales",
    minus05: "−0,05",
    plus05: "+0,05",
    delete: "Eliminar línea",
  },
  en: {
    back: "Back to Tools",
    title: "Mortgage Offer Comparator",
    subtitle: "This tool compares mortgage offers computing nominal rate (TIN) and APR (TAE), taking into account all discount-linked products.",
    amount: "Amount to finance",
    amountInfo: "Do not include the down payment or taxes in the financed amount.",
    term: "Term",
    lines: "Offers to compare",
    addLine: "Add mortgage",
    max10: "Max 10",
    bank: "Bank",
    tinBase: "TIN",
    tinInfo: "Base interest (no discounts).",
    bonif: "Discount",
    annualCost: "Annual cost",
    selector: "Products to include",
    results: "Comparison",
    monthlyNo: "Monthly payment",
    taeNo: "APR / TAE",
    costAnnualProducts: "Annual Cost with Products",
    costAnnualInfo: "Includes monthly payment × 12 + product costs.",
    costTotalHip: "Mortgage Total Cost",
    costTotalInfoNoProd: "Does not include product costs.",
    productsCol: "Products",
    productsInfo: "For each bank, select the products you want to include to compute the discounted cost.",
    monthlyYes: "Monthly payment",
    taeYes: "APR",
    products: "Products",
    interests: "Interest",
    payroll: "Payroll",
    payrollInfo: "Payroll and other linked products without direct cost but required usage, like credit cards.",
    homeIns: "Home insurance",
    lifeIns: "Life insurance",
    others: "Other",
    notesTitle: "Notes",
    notes1: "TIN is the nominal annual rate; APR reflects compounding (e.g., monthly): APR ≈ (1 + TIN/12)^12 − 1, so it's slightly higher than TIN.",
    notes2: "APR is estimated via IRR on monthly cashflows; product annual costs are pro‑rated monthly.",
    notes3: "In the Products column you can toggle Payroll, Home, Life and Other to include them in the discounted calculation.",
    notes4: "Monthly payment uses the French amortization method. Discounts subtract percentage points from the base TIN.",
    langES: "ES",
    langEN: "EN",
    useComma: "Use comma for decimals",
    minus05: "−0.05",
    plus05: "+0.05",
    delete: "Delete row",
  }
} as const;

type Lang = keyof typeof TEXTS;

type I18n = { [K in keyof typeof TEXTS['es']]: string };

function InfoTip({ content, label = 'Información', side = 'bottom', className = '' }: { content: React.ReactNode; label?: string; side?: 'top' | 'bottom'; className?: string; }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border align-middle focus:outline-none focus:ring-2 focus:ring-cyan-500 ${open ? 'border-cyan-400 text-cyan-700 bg-cyan-50' : 'border-gray-300 text-gray-600 bg-white'}`}
      >
        i
      </button>
      {open && (
        <div
          ref={popRef}
          id={id}
          role="tooltip"
          className={`absolute z-50 ${side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-1/2 -translate-x-1/2 max-w-[260px] text-xs p-2 rounded-lg border bg-white shadow-lg text-gray-700`}
        >
          {content}
        </div>
      )}
    </span>
  );
}

function PercentInput({ value, min, max, onChange, t }: { value: number; min: number; max: number; onChange: (v: number) => void; t: I18n; }) {
  const [text, setText] = useState<string>(toComma2(value));
  const [dotError, setDotError] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused && text === "") setText(toComma2(value));
  }, [value]);

  const apply = (raw: string) => {
    setText(raw);
    if (raw === "") { setDotError(false); return; }
    const hasDot = raw.includes(".");
    setDotError(hasDot);
    if (hasDot) return;
    const cleaned = raw.replace(/[^0-9,]/g, "").replace(",", ".");
    const num = Number(cleaned);
    if (!isNaN(num)) {
      const bounded = clamp(num, min, max);
      onChange(bounded);
    }
  };

  const bump = (delta: number) => {
    const next = clamp(roundStep05((isFinite(value) ? value : 0) + delta), min, max);
    onChange(next);
    setText(toComma2(next));
    setDotError(false);
  };

  const onBlur: React.FocusEventHandler<HTMLInputElement> = () => {
    setFocused(false);
    if (text === "") return;
    if (text.includes(".")) return;
    const cleaned = text.replace(/[^0-9,]/g, "").replace(",", ".");
    const num = Number(cleaned);
    if (!isNaN(num)) onChange(clamp(num, min, max));
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); bump(+0.05); }
    if (e.key === 'ArrowDown') { e.preventDefault(); bump(-0.05); }
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        className={`w-full border rounded-xl p-2 pr-10 focus:outline-none focus:ring-2 ${dotError ? 'border-red-500 ring-red-400 focus:ring-red-400' : 'focus:ring-cyan-500 focus:border-cyan-500'}`}
        value={text}
        onChange={(e) => apply(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder="0,00"
        aria-invalid={dotError}
        title={dotError ? t.useComma : ''}
      />
      {!focused && (
        <span className="absolute inset-y-0 right-2 flex items-center text-gray-500 pointer-events-none">%</span>
      )}
      {focused && (
        <div className="absolute inset-y-0 right-1 flex flex-col divide-y border-l rounded-r-md bg-white shadow-sm overflow-hidden select-none">
          <button
            type="button"
            aria-label={t.plus05}
            onMouseDown={(e)=>e.preventDefault()}
            onClick={()=>bump(+0.05)}
            className="w-6 flex-1 text-[10px] leading-none hover:bg-gray-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mx-auto mt-1 h-3 w-3"><path fillRule="evenodd" d="M14.78 12.28a.75.75 0 01-1.06 0L10 8.56l-3.72 3.72a.75.75 0 01-1.06-1.06l4.25-4.25a.75.75 0 011.06 0l4.25 4.25c.3.3.3.77 0 1.06z" clipRule="evenodd"/></svg>
          </button>
          <button
            type="button"
            aria-label={t.minus05}
            onMouseDown={(e)=>e.preventDefault()}
            onClick={()=>bump(-0.05)}
            className="w-6 flex-1 text-[10px] leading-none hover:bg-gray-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mx-auto mb-1 h-3 w-3"><path fillRule="evenodd" d="M5.22 7.72a.75.75 0 011.06 0L10 11.44l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 8.78a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}

function MoneyInput({ value, onChange, t }: { value: number; onChange: (v: number) => void; t: I18n; }) {
  const [text, setText] = useState<string>(toComma2(value));
  const [dotError, setDotError] = useState(false);
  const [focused, setFocused] = useState(false);
  const [wantsDecimals, setWantsDecimals] = useState<boolean>(true);

  useEffect(() => {
    if (!focused && text !== "") {
      setText(wantsDecimals ? toComma2(value) : String(Math.trunc(value)));
    }
  }, [value]);

  const apply = (raw: string) => {
    setText(raw);
    if (raw === "") { setDotError(false); return; }
    const hasDot = raw.includes(".");
    setDotError(hasDot);
    if (hasDot) return;
    setWantsDecimals(raw.includes(","));
    const cleaned = raw.replace(/[^0-9,]/g, "").replace(",", ".");
    const num = Number(cleaned);
    if (!isNaN(num)) onChange(num);
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        className={`w-full border rounded-xl p-2 pr-8 focus:outline-none focus:ring-2 ${dotError ? 'border-red-500 ring-red-400 focus:ring-red-400' : 'focus:ring-cyan-500 focus:border-cyan-500'}`}
        value={text}
        onChange={(e) => apply(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); if (text !== "") setText(wantsDecimals ? toComma2(value) : String(Math.trunc(value))); }}
        placeholder="0,00"
        aria-invalid={dotError}
        title={dotError ? t.useComma : ''}
      />
      <span className="absolute inset-y-0 right-2 flex items-center text-gray-500 pointer-events-none">€</span>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>(getStoredLang);
  const t: I18n = TEXTS[lang];
  const locale = lang === "es" ? "es-ES" : "en-GB";

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const [amount, setAmount] = useState<number>(250000);
  const [years, setYears] = useState<number>(30);
  const nMonths = useMemo(() => clamp(Math.round(years * 12), 1, 80 * 12), [years]);

  const [lines, setLines] = useState<MortgageLine[]>([newLine(1), newLine(2)]);

  const canAdd = lines.length < 10;

  const addLine = () => { if (!canAdd) return; setLines(prev => [...prev, newLine(prev.length + 1)]); };
  const deleteLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

  const updateLine = (id: string, patch: Partial<MortgageLine>) => {
    setLines(prev => prev.map(l => (l.id === id ? { ...l, ...patch, products: patch.products ? { ...l.products, ...patch.products } : l.products } : l)));
  };
  const updateProduct = (id: string, key: ProductKey, patch: Partial<Product>) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, products: { ...l.products, [key]: { ...l.products[key], ...patch } } } : l));
  };

  type LineComputed = {
    id: string; bank: string;
    tinBasePct: number; monthlyNo: number; taeNo: number; totalNo: number; interestNo: number;
    tinBonifPct: number; monthlyYes: number; annualProducts: number; annualTotal: number; taeYes: number; totalYesNoProd: number; interestYes: number;
  };

  const computed: LineComputed[] = useMemo(() => {
    return lines.map(l => {
      const baseTin = Math.max(0, l.tinPct);
      const monthlyNo = pmt(baseTin / 100 / 12, nMonths, amount);
      const taeNo = taeFromFlows(amount, monthlyNo, nMonths, 0);
      const totalNo = monthlyNo * nMonths;
      const interestNo = Math.max(0, totalNo - amount);
      let bonifPts = 0, annualCost = 0;
      (Object.keys(l.products) as ProductKey[]).forEach(k => { const p = l.products[k]; if (p.enabled) { bonifPts += Math.max(0, p.bonifPct); annualCost += Math.max(0, p.annualCost); } });
      const tinBonif = Math.max(0, baseTin - bonifPts);
      const monthlyYes = pmt(tinBonif / 100 / 12, nMonths, amount);
      const annualTotal = monthlyYes * 12 + annualCost;
      const taeYes = taeFromFlows(amount, monthlyYes, nMonths, annualCost / 12);
      const totalYesNoProd = monthlyYes * nMonths;
      const interestYes = Math.max(0, totalYesNoProd - amount);
      return { id: l.id, bank: l.bank || "—", tinBasePct: baseTin, monthlyNo, taeNo, totalNo, interestNo, tinBonifPct: tinBonif, monthlyYes, annualProducts: annualCost, annualTotal, taeYes, totalYesNoProd, interestYes };
    });
  }, [lines, amount, nMonths]);

  return (
    <>
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
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline">
              <span aria-hidden="true">←</span>{TEXTS[lang].back}
            </a>
            <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1" role="radiogroup" aria-label="Language">
              <label className="cursor-pointer">
                <input type="radio" name="lang" className="sr-only peer" checked={lang==='es'} onChange={()=>setLang('es')} />
                <span className="px-3 py-1.5 text-sm rounded-lg block select-none text-gray-700 peer-checked:bg-cyan-600 peer-checked:text-white">{TEXTS[lang].langES}</span>
              </label>
              <label className="cursor-pointer">
                <input type="radio" name="lang" className="sr-only peer" checked={lang==='en'} onChange={()=>setLang('en')} />
                <span className="px-3 py-1.5 text-sm rounded-lg block select-none text-gray-700 peer-checked:bg-cyan-600 peer-checked:text-white">{TEXTS[lang].langEN}</span>
              </label>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6">
          <h1 className="text-3xl md:text-4xl font-extrabold mb-2">{t.title}</h1>
          <p className="text-sm md:text-base text-gray-700 mb-6">{t.subtitle}</p>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div>
                  <label className="block text-base md:text-lg font-semibold flex items-center gap-1.5">
                    {t.amount}
                    <InfoTip className="ml-1" content={t.amountInfo} label="Información: Importe a financiar" />
                  </label>
                  <div className="relative mt-1">
                    <input type="number" className="w-full border rounded-xl p-2 pr-10 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      value={amount} onChange={(e)=>setAmount(clamp(Number(e.target.value)||0,0,50_000_000))} min={0} step={1000} />
                    <span className="absolute inset-y-0 right-3 flex items-center text-gray-500 pointer-events-none">€</span>
                  </div>
                </div>
                <div>
                  <label className="block text-base md:text-lg font-semibold">{t.term}</label>
                  <div className="space-y-1.5 mt-1">
                    <input type="range" className="w-full accent-cyan-600" min={0} max={40} step={1} value={years}
                      onChange={(e)=>setYears(clamp(Number(e.target.value)||0,0,40))} />
                    <div className="text-center text-sm font-medium">{years} {lang==='es'?'años':'yrs'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">{t.lines}</h2>
                <div className="flex items-center gap-2">
                  <button onClick={addLine} disabled={!canAdd} className="px-3 py-1.5 text-sm rounded-lg bg-cyan-600 text-white disabled:opacity-50">+ {t.addLine}</button>
                  <span className="text-xs text-gray-500">{t.max10}</span>
                </div>
              </div>

              <div className="grid grid-cols-10 gap-3 text-xs font-medium text-gray-600 border-b pb-2">
                <div className="col-span-2">{t.bank}</div>
                <div className="col-span-1 inline-flex items-center gap-1">{t.tinBase}
                  <InfoTip className="ml-1" content={t.tinInfo} label="Información: TIN" />
                </div>
                <div className="col-span-1">
                  <span>{t.payroll}</span>
                  <InfoTip className="ml-1" content={t.payrollInfo} label="Información: Nómina" />
                  <br/>
                  <span className="font-normal">{t.bonif}</span>
                </div>
                <div className="col-span-2">{t.homeIns}<br/><span className="font-normal">{t.bonif} · {t.annualCost}</span></div>
                <div className="col-span-2">{t.lifeIns}<br/><span className="font-normal">{t.bonif} · {t.annualCost}</span></div>
                <div className="col-span-2">{t.others}<br/><span className="font-normal">{t.bonif} · {t.annualCost}</span></div>
              </div>

              <div className="space-y-3 mt-2">
                {lines.map((l) => (
                  <div key={l.id} className="relative grid grid-cols-10 gap-3 items-start pr-6">
                    <input className="col-span-2 border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                      value={l.bank} onChange={(e)=>updateLine(l.id,{ bank:e.target.value.slice(0,20) })} maxLength={20} />
                    <div className="col-span-1"><PercentInput value={l.tinPct} min={0} max={30} onChange={(v)=>updateLine(l.id,{ tinPct: v })} t={t} /></div>
                    <div className="col-span-1"><PercentInput value={l.products.nom.bonifPct} min={0} max={5} onChange={(v)=>updateProduct(l.id,'nom',{ bonifPct: v })} t={t} /></div>
                    {["sh","sv","otros"].map((k) => (
                      <div key={k} className="col-span-2 grid grid-cols-2 gap-2">
                        <PercentInput value={l.products[k as ProductKey].bonifPct} min={0} max={5} onChange={(v)=>updateProduct(l.id,k as ProductKey,{ bonifPct: v })} t={t} />
                        <MoneyInput value={l.products[k as ProductKey].annualCost} onChange={(v)=>updateProduct(l.id,k as ProductKey,{ annualCost: v })} t={t} />
                      </div>
                    ))}
                    <button
                      type="button"
                      aria-label={t.delete}
                      onClick={() => deleteLine(l.id)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-red-600 hover:text-red-700"
                      title={t.delete}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M3.75 6.75h16.5"/>
                        <path d="M9.75 3.75h4.5a1 1 0 0 1 1 1v2H8.75v-2a1 1 0 0 1 1-1z"/>
                        <path d="M6.75 6.75l.9 11.1A2.25 2.25 0 0 0 9.9 20.25h4.2a2.25 2.25 0 0 0 2.25-2.4l.9-11.1"/>
                        <path d="M10 10.5v7"/><path d="M14 10.5v7"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-4">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-gray-600">
                      <th className="py-1 px-2 text-center bg-gray-50/80 rounded-tl-md border-2 border-gray-200 border-r-4" colSpan={1}>{t.results}</th>
                      <th className="py-1 px-2 text-center bg-gray-50/80 border-2 border-gray-200" colSpan={3}>Sin Bonificaciones</th>
                      <th className="py-1 px-2 text-center bg-gray-50/80 rounded-tr-md border-2 border-gray-200" colSpan={5}>Con Productos Bonificadores</th>
                    </tr>
                    <tr className="text-gray-600">
                      <th className="py-2 pr-3 text-left border-r-2 border-gray-200">{t.bank}</th>
                      <th className="py-2 pr-3 text-center border-l-2 border-gray-200">{t.monthlyNo}</th>
                      <th className="py-2 pr-3 text-center">{t.taeNo}</th>
                      <th className="py-2 pr-3 text-center border-r-2 border-gray-200">{t.costTotalHip}
                        <InfoTip className="ml-1" content={t.costTotalInfoNoProd} label="Información: Coste Total Hipoteca" />
                      </th>

                      <th className="py-2 pr-3 text-center border-l-2 border-gray-200">{t.productsCol}
                        <InfoTip className="ml-1" content={t.productsInfo} label="Información: Productos" />
                      </th>
                      <th className="py-2 pr-3 text-center">{t.monthlyYes}</th>
                      <th className="py-2 pr-3 text-center">{t.costAnnualProducts}
                        <InfoTip className="ml-1" content={t.costAnnualInfo} label="Información: Coste anual con productos" />
                      </th>
                      <th className="py-2 pr-3 text-center">{t.taeYes}</th>
                      <th className="py-2 pr-3 text-center">{t.costTotalHip}
                        <InfoTip className="ml-1" content={t.costTotalInfoNoProd} label="Información: Coste Total Hipoteca" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {computed.map((c) => {
                      const line = lines.find(x => x.id === c.id)!;
                      return (
                        <tr key={c.id} className="border-t align-top">
                          <td className="py-2 pr-3 font-medium border-r-2 border-gray-200">
                            {c.bank}
                            <div className="text-xs text-gray-500">TIN: {c.tinBasePct.toFixed(2)}% → {c.tinBonifPct.toFixed(2)}%</div>
                          </td>
                          <td className="py-2 pr-3 text-center border-l-2 border-gray-200">{formatEUR(c.monthlyNo, locale)}</td>
                          <td className="py-2 pr-3 text-center">{formatPct(c.taeNo, locale)}</td>
                          <td className="py-2 pr-3 text-center border-r-2 border-gray-200">{formatEUR(c.totalNo, locale)}
                            <div className="text-xs text-gray-500">{t.interests}: {formatEUR(c.interestNo, locale)}</div>
                          </td>
                          <td className="py-2 pr-3 text-center border-l-2 border-gray-200">
                            <div className="inline-flex gap-0 justify-center" role="group" aria-label={t.selector}>
                              {(["nom","sh","sv","otros"] as ProductKey[]).map((k) => (
                                <label key={k} className="cursor-pointer">
                                  <input type="checkbox" className="sr-only peer" checked={line.products[k].enabled}
                                    onChange={(e)=>updateProduct(line.id,k,{ enabled: e.target.checked })} />
                                  <span className="px-1.5 py-0.5 text-[10px] border border-gray-300 block select-none text-gray-700 hover:bg-gray-50 peer-checked:bg-cyan-600 peer-checked:text-white peer-checked:border-cyan-600 -ml-px first:ml-0 rounded-none first:rounded-l-full last:rounded-r-full">
                                    {PRODUCT_LABEL[k]}
                                  </span>
                                </label>
                              ))}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-center">{formatEUR(c.monthlyYes, locale)}</td>
                          <td className="py-2 pr-3 text-center">{formatEUR(c.annualTotal, locale)}
                            {c.annualProducts > 0 && (
                              <div className="text-xs text-gray-500">{t.products}: {formatEUR(c.annualProducts, locale)}</div>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-center">{formatPct(c.taeYes, locale)}</td>
                          <td className="py-2 pr-3 text-center">{formatEUR(c.totalYesNoProd, locale)}
                            <div className="text-xs text-gray-500">{t.interests}: {formatEUR(c.interestYes, locale)}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="text-xs text-gray-600 leading-relaxed mt-4">
                <p className="mb-1 font-medium">{t.notesTitle}</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>{t.notes1}</li>
                  <li>{t.notes2}</li>
                  <li>{t.notes3}</li>
                  <li>{t.notes4}</li>
                </ul>
              </div>
            </div>

            <div className="text-base md:text-lg text-gray-500 mt-6">
              © David Gonzalez, si quieres saber más sobre mí, visita <a href="https://dragner.net" className="text-cyan-600 hover:underline" target="_blank" rel="noreferrer">dragner.net</a>
            </div>
          </div>
        </div>
      </div>

      {((import.meta as any).env?.DEV) && (
        <script dangerouslySetInnerHTML={{__html: `
          try {
            const approx = (a,b,eps=1e-6)=>Math.abs(a-b)<eps;
            (function(){ const cuota = ${pmt.toString()}(0, 12, 1200); if (!approx(cuota, 100)) console.warn('[TEST] PMT r=0 esperado 100, obtenido', cuota); })();
            (function(){ const f=${taeFromFlows.toString()}; const a=f(100000,500,360,0), b=f(100000,500,360,50); if (!(b>a)) console.warn('[TEST] TAE con coste debería ser mayor que sin coste'); })();
            (function(){ const pm=${pmt.toString()}; const mNo=pm(0.02/12,360,250000), mYes=pm(0.015/12,360,250000); if(!(mYes<mNo)) console.warn('[TEST] Cuota con TIN bonificado debería ser menor'); })();
            (function(){ const pm=${pmt.toString()}; const principal=200000, r=0.02/12, n=360; const m=pm(r,n,principal); const total=m*n; const intereses=total-principal; if(!(intereses>0)) console.warn('[TEST] intereses > 0'); })();
          } catch(e) { console.warn('[TEST] Error en self-tests', e); }
        `}} />
      )}
    </>
  );
}
