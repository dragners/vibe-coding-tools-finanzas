import React, { useMemo, useState } from "react";

// =============================================
// Utilidades
// =============================================
const fmtEUR = (n: number) => n.toLocaleString("es-ES", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const formatDuration = (months: number) => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y} años ${m} meses`;
};

// =============================================
// Catálogo de CCAA (orden alfabético, régimen común; sin Navarra ni País Vasco)
// =============================================
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

// Tipos auxiliares
type ScaleSegment = { upTo: number; rate: number };

// =============================================
// Escalas IRPF 2025 (ahorro y estatal general)
// =============================================
// Ahorro 2025: 19% / 21% / 23% / 27% / 30%
const SAVINGS_SCALE: ScaleSegment[] = [
  { upTo: 6000, rate: 0.19 },
  { upTo: 50000, rate: 0.21 },
  { upTo: 200000, rate: 0.23 },
  { upTo: 300000, rate: 0.27 },
  { upTo: Infinity, rate: 0.30 },
];

// Escala estatal base general 2025 (art. 63 LIRPF)
const GENERAL_STATE_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.095 },
  { upTo: 20200, rate: 0.12 },
  { upTo: 35200, rate: 0.15 },
  { upTo: 60000, rate: 0.185 },
  { upTo: 300000, rate: 0.225 },
  { upTo: Infinity, rate: 0.245 },
];

// =============================================
// Escalas autonómicas 2025 (régimen común)
// Fuentes: REAF 2025 y boletines/portales autonómicos (ver notas en la UI)
// =============================================
// Andalucía
const ANDALUCIA_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 13000, rate: 0.095 },
  { upTo: 21100, rate: 0.12 },
  { upTo: 35200, rate: 0.15 },
  { upTo: 60000, rate: 0.185 },
  { upTo: Infinity, rate: 0.225 },
];

// Aragón
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

// Asturias
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

// Baleares
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

// Canarias
const CANARIAS_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.09 },
  { upTo: 17707.2, rate: 0.115 },
  { upTo: 33007.2, rate: 0.14 },
  { upTo: 53407.2, rate: 0.185 },
  { upTo: 90000, rate: 0.235 },
  { upTo: 120000, rate: 0.25 },
  { upTo: Infinity, rate: 0.26 },
];

// Cantabria
const CANTABRIA_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 13000, rate: 0.085 },
  { upTo: 21000, rate: 0.11 },
  { upTo: 35200, rate: 0.145 },
  { upTo: 60000, rate: 0.18 },
  { upTo: 90000, rate: 0.225 },
  { upTo: Infinity, rate: 0.245 },
];

// Castilla-La Mancha
const CASTILLA_LA_MANCHA_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.095 },
  { upTo: 20200, rate: 0.12 },
  { upTo: 35200, rate: 0.15 },
  { upTo: 60000, rate: 0.185 },
  { upTo: Infinity, rate: 0.225 },
];

// Castilla y León
const CASTILLA_Y_LEON_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 12450, rate: 0.09 },
  { upTo: 20200, rate: 0.12 },
  { upTo: 35200, rate: 0.14 },
  { upTo: 60000, rate: 0.185 },
  { upTo: Infinity, rate: 0.215 },
];

// Cataluña (8 tramos)
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

// Comunidad de Madrid
const MADRID_AUTON_SCALE_2025: ScaleSegment[] = [
  { upTo: 13362.22, rate: 0.085 },
  { upTo: 19004.63, rate: 0.107 },
  { upTo: 35425.68, rate: 0.128 },
  { upTo: 57320.4, rate: 0.174 },
  { upTo: Infinity, rate: 0.205 },
];

// Comunidad Valenciana
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

// Extremadura
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

// Galicia
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

// La Rioja
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

// Región de Murcia
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

// =============================================
// Cálculo de impuestos progresivos
// =============================================
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
  const findRate = (scale: ScaleSegment[]) => scale.find((s) => base <= s.upTo)?.rate ?? scale[scale.length - 1].rate;
  const auton = AUTON_SCALES_2025[region];
  return findRate(GENERAL_STATE_SCALE_2025) + (auton.length ? findRate(auton) : 0);
}

function savingsTax(amount: number) {
  return taxFromScale(amount, SAVINGS_SCALE);
}

// =============================================
// Finanzas básicas
// =============================================
function fvAnnuity(pmt: number, r: number, n: number) {
  if (n <= 0) return 0;
  if (r === 0) return pmt * n;
  return (pmt * (Math.pow(1 + r, n) - 1)) / r;
}

// =============================================
// Simulaciones de rescate
// =============================================
// Plan (todo tributa como trabajo)
function simulatePlanWithdrawals(params: {
  startCapital: number;
  pensionAnnual: number;
  annualWithdrawal: number;
  r: number; // rendimiento anual post-jubilación
  region: RegionKey;
}) {
  const { startCapital, pensionAnnual, annualWithdrawal, r, region } = params;
  let value = startCapital;
  let year = 0;
  let totalGross = 0;
  let totalTax = 0;
  let totalNet = 0;
  let lastWithdrawal = 0;
  while (value > 1e-6 && year < 1000) {
    year += 1;
    value *= 1 + r;
    const w = Math.min(annualWithdrawal, value);
    const tax = Math.max(0, generalTax(pensionAnnual + w, region) - generalTax(pensionAnnual, region));
    const net = w - tax;
    value -= w;
    totalGross += w;
    totalTax += tax;
    totalNet += net;
    lastWithdrawal = w;
    if (w <= 0) break;
  }
  const fullYears = year - 1 + (lastWithdrawal > 0 ? lastWithdrawal / Math.max(annualWithdrawal, 1) : 0);
  const months = Math.round(fullYears * 12);
  return { yearsFloat: fullYears, months, totalGross, totalTax, totalNet };
}

// Fondo (solo tributa la ganancia realizada)
function simulateFundWithdrawals(params: {
  startValue: number;
  costBasis: number; // suma de aportaciones
  annualWithdrawal: number;
  r: number;
}) {
  let { startValue, costBasis, annualWithdrawal, r } = params;
  let value = startValue;
  let year = 0;
  let totalGross = 0;
  let totalTax = 0;
  let totalNet = 0;
  let lastWithdrawal = 0;
  while (value > 1e-6 && year < 1000) {
    year += 1;
    value *= 1 + r;
    const w = Math.min(annualWithdrawal, value);
    const gainFraction = value > 0 ? Math.max(0, (value - costBasis) / value) : 0;
    const realizedGain = w * gainFraction;
    const tax = savingsTax(realizedGain);
    const net = w - tax;
    // Base de coste proporcional
    const basisRedeemed = w * (value > 0 ? costBasis / value : 1);
    costBasis = Math.max(0, costBasis - basisRedeemed);
    value -= w;
    totalGross += w;
    totalTax += tax;
    totalNet += net;
    lastWithdrawal = w;
    if (w <= 0) break;
  }
  const fullYears = year - 1 + (lastWithdrawal > 0 ? lastWithdrawal / Math.max(annualWithdrawal, 1) : 0);
  const months = Math.round(fullYears * 12);
  return { yearsFloat: fullYears, months, totalGross, totalTax, totalNet };
}

// Combinado Plan + Reinversión (retiro proporcional al peso de cada parte)
function simulateCombinedWithdrawals(params: {
  startPlanCapital: number;
  startReinvValue: number;
  reinvCostBasis: number;
  pensionAnnual: number;
  annualWithdrawal: number;
  r: number;
  region: RegionKey;
}) {
  let { startPlanCapital, startReinvValue, reinvCostBasis, pensionAnnual, annualWithdrawal, r, region } = params;
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
  let lastW = 0;
  while ((planValue > 1e-6 || reinvValue > 1e-6) && year < 1000) {
    year += 1;
    planValue *= 1 + r;
    reinvValue *= 1 + r;
    const avail = planValue + reinvValue;
    if (avail <= 1e-12) break;
    const targetW = Math.min(annualWithdrawal, avail);
    const wPlan = avail > 0 ? targetW * (planValue / avail) : 0;
    const wReinv = targetW - wPlan;

    const taxPlan = Math.max(0, generalTax(pensionAnnual + wPlan, region) - generalTax(pensionAnnual, region));
    const netPlan = wPlan - taxPlan;
    planValue = Math.max(0, planValue - wPlan);

    let taxReinv = 0;
    let netReinv = 0;
    if (wReinv > 0 && reinvValue > 0) {
      const gainFraction = Math.max(0, (reinvValue - basis) / reinvValue);
      const realizedGain = wReinv * gainFraction;
      taxReinv = savingsTax(realizedGain);
      netReinv = wReinv - taxReinv;
      const basisRedeemed = wReinv * (basis / reinvValue);
      basis = Math.max(0, basis - basisRedeemed);
      reinvValue = Math.max(0, reinvValue - wReinv);
    }

    totalGross += targetW;
    totalTax += taxPlan + taxReinv;
    totalNet += netPlan + netReinv;
    planNetTot += netPlan;
    planTaxTot += taxPlan;
    reinvNetTot += netReinv;
    reinvTaxTot += taxReinv;
    lastW = targetW;
    if (targetW <= 0) break;
  }
  const fullYears = year - 1 + (lastW > 0 ? lastW / Math.max(annualWithdrawal, 1) : 0);
  const months = Math.round(fullYears * 12);
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

// =============================================
// Tests (no tocar salvo que sean claramente erróneos)
// =============================================
function runTests() {
  const approx = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

  // savingsTax básicos
  console.assert(approx(savingsTax(1000), 190), "savingsTax 1000 => 190");
  console.assert(approx(savingsTax(7000), 6000 * 0.19 + 1000 * 0.21), "savingsTax tramos");
  console.assert(approx(savingsTax(51000), 6000 * 0.19 + 44000 * 0.21 + 1000 * 0.23), "savingsTax salto 50k");
  // UMBRAL exacto 6.000€
  console.assert(approx(savingsTax(6000), 6000 * 0.19), "savingsTax umbral 6k");

  // fvAnnuity
  console.assert(approx(fvAnnuity(1500, 0, 10), 15000), "fvAnnuity r=0");
  console.assert(approx(Math.round(fvAnnuity(1000, 0.05, 1)), 1000), "fvAnnuity 1 año r>0 (aprox)");

  // generalTax base 0
  console.assert(generalTax(0, "Cataluña") === 0, "generalTax 0 => 0");

  // Marginales relativos entre CCAA
  const mgCAT = generalMarginalRate(50000, "Cataluña");
  const mgMAD = generalMarginalRate(50000, "Comunidad de Madrid");
  console.assert(mgMAD < mgCAT, "marginal Madrid < Cataluña (esperado)");

  const mgVAL = generalMarginalRate(250000, "Comunidad Valenciana");
  const mgMAD_hi = generalMarginalRate(250000, "Comunidad de Madrid");
  console.assert(mgVAL > mgMAD_hi, "Valenciana debería tener mayor marginal alto que Madrid");

  const mgEXT_low = generalMarginalRate(10000, "Extremadura");
  const mgCYL_low = generalMarginalRate(10000, "Castilla y León");
  console.assert(mgEXT_low < mgCYL_low, "Extremadura tiene mínimo autonómico más bajo que CyL");
}
runTests();

// =============================================
// Componente principal
// =============================================
export default function App() {
  // Entradas
  const [salary, setSalary] = useState(45000);
  const [years, setYears] = useState(25);
  const [annualContribution, setAnnualContribution] = useState(1500);
  const [tir, setTir] = useState(5); // %
  const [pension, setPension] = useState(22000);
  const [reinvestSavings, setReinvestSavings] = useState(true);
  const [region, setRegion] = useState<RegionKey>("Cataluña");

  const r = useMemo(() => Math.max(0, Math.min(0.25, tir / 100)), [tir]);
  const contrib = Math.min(10000, Math.max(0, annualContribution));
  const N = Math.max(0, Math.floor(years));

  // Tipos
  const marginalGeneral = useMemo(() => generalMarginalRate(salary, region), [salary, region]);

  // Acumulación antes de la jubilación
  const planFV = useMemo(() => fvAnnuity(contrib, r, N), [contrib, r, N]);
  const fundFV = useMemo(() => fvAnnuity(contrib, r, N), [contrib, r, N]);
  const fundCost = useMemo(() => contrib * N, [contrib, N]);
  const planCost = fundCost;

  // Ahorro IRPF anual estimado (tipo marginal)
  const annualIRPFSaving = useMemo(() => contrib * marginalGeneral, [contrib, marginalGeneral]);
  const totalIRPFSaved = useMemo(() => annualIRPFSaving * N, [annualIRPFSaving, N]);

  // Fondo por reinversión del ahorro IRPF
  const reinvestFV = useMemo(() => fvAnnuity(annualIRPFSaving, r, N), [annualIRPFSaving, r, N]);
  const reinvestCost = useMemo(() => annualIRPFSaving * N, [annualIRPFSaving, N]);

  // Resúmenes combinados para tarjetas
  const combinedPlanBruto = useMemo(() => (reinvestSavings ? planFV + reinvestFV : planFV), [reinvestSavings, planFV, reinvestFV]);
  const combinedPlanInvertido = useMemo(() => (reinvestSavings ? planCost + reinvestCost : planCost), [reinvestSavings, planCost, reinvestCost]);

  // Rescate único (lump sum)
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

  // Retiros estándar
  const withdrawals = [10000, 15000, 20000, 25000, 35000];

  const planSims = useMemo(
    () => withdrawals.map((w) => ({ w, ...simulatePlanWithdrawals({ startCapital: planFV, pensionAnnual: pension, annualWithdrawal: w, r, region }) })),
    [planFV, pension, r, region]
  );
  const fundSims = useMemo(
    () => withdrawals.map((w) => ({ w, ...simulateFundWithdrawals({ startValue: fundFV, costBasis: fundCost, annualWithdrawal: w, r }) })),
    [fundFV, fundCost, r]
  );
  const combinedSims = useMemo(
    () => withdrawals.map((w) => simulateCombinedWithdrawals({ startPlanCapital: planFV, startReinvValue: reinvestFV, reinvCostBasis: reinvestCost, pensionAnnual: pension, annualWithdrawal: w, r, region })),
    [planFV, reinvestFV, reinvestCost, pension, r, region]
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-3">Calculadora Plan de Pensiones vs Fondo</h1>
        <p className="text-sm md:text-base text-gray-700 mb-6">
          Compara, con fiscalidad española, aportar a un <b>plan de pensiones</b> frente a un <b>fondo de inversión</b>.
          Introduce tus datos para ver el <b>valor acumulado a la jubilación</b> y el <b>neto a recibir</b> bajo distintos modos de rescate.
          El ahorro anual por aportar al plan se estima con tu <i>tipo marginal</i> (estatal + autonómico según comunidad seleccionada).
          Al rescatar, el plan tributa por tramos de la <i>base general</i> y los fondos por la <i>tarifa del ahorro</i> sobre la ganancia realizada.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel de entradas */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow p-4 space-y-4">
              <h2 className="font-semibold">Entradas</h2>

              <label className="block text-sm">Comunidad Autónoma</label>
              <select
                className="w-full border rounded-xl p-2"
                value={region}
                onChange={(e) => setRegion(e.target.value as RegionKey)}
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <label className="block text-sm mt-2">Salario bruto anual actual</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full border rounded-xl p-2 pr-10"
                  value={salary}
                  onChange={(e) => setSalary(Number(e.target.value) || 0)}
                  min={0}
                  step={1000}
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-gray-500 pointer-events-none">€</span>
              </div>

              <label className="block text-sm">Años hasta jubilación</label>
              <input
                type="number"
                className="w-full border rounded-xl p-2"
                value={years}
                onChange={(e) => setYears(Number(e.target.value) || 0)}
                min={0}
                max={60}
              />

              <label className="block text-sm">Aportación anual (máx. 10.000€)</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full border rounded-xl p-2 pr-10"
                  value={annualContribution}
                  onChange={(e) => setAnnualContribution(Number(e.target.value) || 0)}
                  min={0}
                  max={10000}
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-gray-500 pointer-events-none">€</span>
              </div>

              <label className="block text-sm">TIR anual esperada: {tir}%</label>
              <input
                type="range"
                className="w-full"
                min={0}
                max={25}
                step={0.1}
                value={tir}
                onChange={(e) => setTir(Number(e.target.value))}
              />

              <label className="block text-sm">Pensión pública prevista (anual)</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full border rounded-xl p-2 pr-10"
                  value={pension}
                  onChange={(e) => setPension(Number(e.target.value) || 0)}
                  min={0}
                  step={500}
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-gray-500 pointer-events-none">€</span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="reinv"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={reinvestSavings}
                  onChange={(e) => setReinvestSavings(e.target.checked)}
                />
                <label htmlFor="reinv" className="text-sm">
                  Reinvertir el ahorro anual de IRPF en un fondo
                </label>
              </div>

              <div className="text-xs text-gray-500">
                Tipo marginal estimado (trabajo): <b>{(marginalGeneral * 100).toFixed(1)}%</b>
                <br />
                Ahorro IRPF anual por aportar al plan: <b>{fmtEUR(annualIRPFSaving)}</b>
              </div>
            </div>
          </div>

          {/* Resumen sin rescate único */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl md:text-2xl font-bold">Valor a la jubilación</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tarjeta Plan de pensiones */}
              <div className="bg-white rounded-2xl shadow p-4">
                <div className="text-base font-semibold text-gray-700">{reinvestSavings ? 'Plan de pensiones + Fondo (ahorro IRPF)' : 'Plan de pensiones'}</div>
                <div className="text-xl font-bold">{fmtEUR(combinedPlanBruto)}</div>
                <div className="mt-2 text-sm">Total invertido: <b>{fmtEUR(combinedPlanInvertido)}</b></div>
                {reinvestSavings ? (
                  <>
                    <div className="text-xs text-gray-500 mt-2">Detalle bruto: Plan {fmtEUR(planFV)} · Fondo (ahorro IRPF) {fmtEUR(reinvestFV)}</div>
                    <div className="text-xs text-gray-500">Detalle invertido: Plan {fmtEUR(planCost)} · Fondo (ahorro IRPF) {fmtEUR(reinvestCost)}</div>
                  </>
                ) : (
                  <>
                    <div className="mt-1 text-sm">Total ahorro IRPF (no reinvertido): <b>{fmtEUR(totalIRPFSaved)}</b></div>
                    <div className="text-xs text-gray-500 mt-2">Detalle bruto: Plan {fmtEUR(planFV)}</div>
                    <div className="text-xs text-gray-500">Detalle invertido: Plan {fmtEUR(planCost)}</div>
                  </>
                )}
              </div>

              {/* Tarjeta Fondo de inversión */}
              <div className="bg-white rounded-2xl shadow p-4">
                <div className="text-base font-semibold text-gray-700">Fondo de inversión</div>
                <div className="text-xl font-bold">{fmtEUR(fundFV)}</div>
                <div className="mt-2 text-sm">Total invertido: <b>{fmtEUR(fundCost)}</b></div>
                <div className="text-xs text-gray-500 mt-2">Detalle bruto: Fondo {fmtEUR(fundFV)}</div>
                <div className="text-xs text-gray-500">Detalle invertido: Fondo {fmtEUR(fundCost)}</div>
              </div>
            </div>

            {/* Tabla rescates */}
            <div className="bg-white rounded-2xl shadow p-4">
              <h3 className="font-semibold mb-3">Rescates (incluye rescate total) y duración del capital</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="py-2 pr-3">Escenario</th>
                      <th className="py-2 pr-3">Neto a recibir</th>
                      <th className="py-2 pr-3">Impuestos pagados</th>
                      <th className="py-2 pr-3">Duración</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ===== Plan de pensiones (condicional) ===== */}
                    <tr>
                      <td colSpan={4} className="bg-slate-200 text-slate-800 font-semibold uppercase tracking-wide py-2 px-3 rounded">
                        {reinvestSavings ? 'Plan de pensiones + Fondo (ahorro IRPF)' : 'Plan de pensiones'}
                      </td>
                    </tr>
                    {/* Retiros fijos (Plan + reinversión en misma fila si está activa) */}
                    {withdrawals.map((w, idx) => {
                      const ps = planSims[idx];
                      const cs = combinedSims[idx];
                      return (
                        <tr key={`plan-${w}`} className="border-t bg-gray-50">
                          <td className="py-2 pr-3 font-medium">Retirar {fmtEUR(w)}/año</td>
                          <td className="py-2 pr-3">
                            {fmtEUR(reinvestSavings ? cs.totalNet : ps.totalNet)}
                            {reinvestSavings && (
                              <span className="text-gray-500 text-xs"> ({fmtEUR(cs.planNet)} + {fmtEUR(cs.reinvNet)})</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-gray-600">
                            {fmtEUR(reinvestSavings ? cs.totalTax : ps.totalTax)}
                            {reinvestSavings && (
                              <span className="text-gray-500 text-xs"> ({fmtEUR(cs.planTax)} + {fmtEUR(cs.reinvTax)})</span>
                            )}
                          </td>
                          <td className="py-2 pr-3">{formatDuration(reinvestSavings ? cs.months : ps.months)}</td>
                        </tr>
                      );
                    })}
                    {/* Rescate total (al final) */}
                    <tr className="border-t bg-gray-50">
                      <td className="py-2 pr-3 font-medium">Rescate total</td>
                      <td className="py-2 pr-3">
                        {fmtEUR(reinvestSavings ? combinedNetLump : planNetLump)}
                        {reinvestSavings && (
                          <span className="text-gray-500 text-xs"> ({fmtEUR(planNetLump)} + {fmtEUR(reinvNetLump)})</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-gray-600">
                        {fmtEUR(reinvestSavings ? combinedTaxLump : planTaxLump)}
                        {reinvestSavings && (
                          <span className="text-gray-500 text-xs"> ({fmtEUR(planTaxLump)} + {fmtEUR(reinvTaxLump)})</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">{formatDuration(0)}</td>
                    </tr>

                    {/* ===== Fondo de inversión ===== */}
                    <tr>
                      <td colSpan={4} className="bg-slate-200 text-slate-800 font-semibold uppercase tracking-wide py-2 px-3 rounded mt-2">
                        Fondo de inversión
                      </td>
                    </tr>
                    {withdrawals.map((w, idx) => {
                      const fs = fundSims[idx];
                      return (
                        <tr key={`fund-${w}`} className="border-t bg-white">
                          <td className="py-2 pr-3 font-medium">Retirar {fmtEUR(w)}/año</td>
                          <td className="py-2 pr-3">{fmtEUR(fs.totalNet)}</td>
                          <td className="py-2 pr-3 text-gray-600">{fmtEUR(fs.totalTax)}</td>
                          <td className="py-2 pr-3">{formatDuration(fs.months)}</td>
                        </tr>
                      );
                    })}
                    {/* Rescate total (al final) */}
                    <tr className="border-t bg-white">
                      <td className="py-2 pr-3 font-medium">Rescate total</td>
                      <td className="py-2 pr-3">{fmtEUR(fundNetLump)}</td>
                      <td className="py-2 pr-3 text-gray-600">{fmtEUR(fundTaxLump)}</td>
                      <td className="py-2 pr-3">{formatDuration(0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Notas */}
              <div className="text-xs text-gray-600 leading-relaxed mt-4">
                <p className="mb-2">Notas y supuestos:</p>
                <ul className="list-disc ml-5 space-y-1">
		  <li>En retiros parciales, el capital restante sigue creciendo cada año antes de cada retirada (plan, fondo y reinversión del ahorro IRPF).</li>
                  <li>
                    IRPF general: suma de <i>escala estatal 2025</i> y <i>escala autonómica 2025</i> de la <b>CCAA seleccionada</b>.
                    Incluidas todas las CCAA de régimen común (sin Navarra ni País Vasco).
                  </li>
                  <li>
                    IRPF del ahorro: 19%/21%/23%/27%/30% (España · normativa 2025). Los rescates de fondos tributan solo por la
                    ganancia efectivamente realizada cada año.
                  </li>
                  <li>
                    Simulaciones: mismo rendimiento anual antes y después de la jubilación. No se aplican mínimos personales/deducciones.
                    El impuesto del plan en cada retirada se calcula como <i>cuota(pensión + retiro) − cuota(pensión)</i>.
                  </li>
                  <li>La aportación anual se limita a 10.000€ si es un plan de previsión y 1.500€ anuales para plan individual.</li>
                  <li>
                    Los tipos autonómicos se han parametrizado por tramos oficiales publicados (REAF 2025 y boletines autonómicos).
                  </li>

                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
