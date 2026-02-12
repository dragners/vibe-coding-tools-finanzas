import React, { useState, useMemo, useEffect, useRef, useId } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, Legend, ReferenceLine, CartesianGrid,
} from 'recharts';

// ─── Types & Constants ──────────────────────────────────────────

type Lang = 'es' | 'en';
type HomeType = 'used' | 'new';
type ThemeMode = 'light' | 'dark';

const LANG_STORAGE_KEY = 'finanzas.lang';
const THEME_STORAGE_KEY = 'finanzas.theme';
const getStoredLang = (): Lang => {
  if (typeof window === 'undefined') return 'es';
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  return stored === 'en' ? 'en' : 'es';
};

const getStoredThemeChoice = (): ThemeMode | null => {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
};

const resolveTheme = (themeChoice: ThemeMode | null): ThemeMode => {
  if (themeChoice) return themeChoice;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

type CcaaData = {
  id: string;
  name: { es: string; en: string };
  itpPct: number;       // ITP for used homes (% of home price)
  ajdPct: number;       // AJD for new homes (% of home price, on deed)
  newHomeTaxPct: number; // IVA (10%) / IGIC (7%) / IPSI (0.5%)
  newHomeTaxLabel: string;
  avgIbiPct: number;    // Average effective IBI as % of market value (tipo × cadastral/market ratio)
};

// avgIbiPct: approximate effective IBI on market value per CCAA.
// Actual IBI = tipo impositivo × valor catastral. Cadastral values are typically
// 40-60% of market value and vary by municipality and last cadastral revision.
// These averages are estimates to give a reasonable CCAA-specific default.
const CCAA_LIST: CcaaData[] = [
  { id: 'andalucia',     name: { es: 'Andalucía', en: 'Andalusia' },              itpPct: 7,    ajdPct: 1.2,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.45 },
  { id: 'aragon',        name: { es: 'Aragón', en: 'Aragon' },                    itpPct: 8,    ajdPct: 1.5,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.40 },
  { id: 'asturias',      name: { es: 'Principado de Asturias', en: 'Asturias' },  itpPct: 8,    ajdPct: 1.2,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.45 },
  { id: 'baleares',      name: { es: 'Illes Balears', en: 'Balearic Islands' },   itpPct: 8,    ajdPct: 1.2,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.50 },
  { id: 'canarias',      name: { es: 'Canarias', en: 'Canary Islands' },          itpPct: 6.5,  ajdPct: 0.75, newHomeTaxPct: 7,   newHomeTaxLabel: 'IGIC', avgIbiPct: 0.35 },
  { id: 'cantabria',     name: { es: 'Cantabria', en: 'Cantabria' },              itpPct: 10,   ajdPct: 1.5,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.45 },
  { id: 'castillaleon',  name: { es: 'Castilla y León', en: 'Castile and León' }, itpPct: 8,    ajdPct: 1.5,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.45 },
  { id: 'castillamancha',name: { es: 'Castilla-La Mancha', en: 'Castilla-La Mancha' }, itpPct: 9, ajdPct: 1.5, newHomeTaxPct: 10, newHomeTaxLabel: 'IVA', avgIbiPct: 0.50 },
  { id: 'cataluna',      name: { es: 'Cataluña', en: 'Catalonia' },               itpPct: 10,   ajdPct: 1.5,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.60 },
  { id: 'valencia',      name: { es: 'Comunitat Valenciana', en: 'Valencian Community' }, itpPct: 10, ajdPct: 1.5, newHomeTaxPct: 10, newHomeTaxLabel: 'IVA', avgIbiPct: 0.55 },
  { id: 'extremadura',   name: { es: 'Extremadura', en: 'Extremadura' },          itpPct: 8,    ajdPct: 1.5,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.50 },
  { id: 'galicia',       name: { es: 'Galicia', en: 'Galicia' },                  itpPct: 8,    ajdPct: 1.5,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.40 },
  { id: 'madrid',        name: { es: 'Comunidad de Madrid', en: 'Community of Madrid' }, itpPct: 6, ajdPct: 0.75, newHomeTaxPct: 10, newHomeTaxLabel: 'IVA', avgIbiPct: 0.40 },
  { id: 'murcia',        name: { es: 'Región de Murcia', en: 'Region of Murcia' },itpPct: 8,    ajdPct: 1.5,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.50 },
  { id: 'navarra',       name: { es: 'Comunidad Foral de Navarra', en: 'Navarre' },itpPct: 6,   ajdPct: 0.5,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.35 },
  { id: 'paisvasco',     name: { es: 'País Vasco', en: 'Basque Country' },        itpPct: 4,    ajdPct: 0.5,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.30 },
  { id: 'rioja',         name: { es: 'La Rioja', en: 'La Rioja' },                itpPct: 7,    ajdPct: 1.5,  newHomeTaxPct: 10,  newHomeTaxLabel: 'IVA', avgIbiPct: 0.45 },
  { id: 'ceuta',         name: { es: 'Ceuta', en: 'Ceuta' },                      itpPct: 6,    ajdPct: 0.5,  newHomeTaxPct: 1,   newHomeTaxLabel: 'IPSI', avgIbiPct: 0.35 },
  { id: 'melilla',       name: { es: 'Melilla', en: 'Melilla' },                  itpPct: 6,    ajdPct: 0.5,  newHomeTaxPct: 1,   newHomeTaxLabel: 'IPSI', avgIbiPct: 0.35 },
];

// Spanish savings tax base (Base del Ahorro) brackets - 2024
const SAVINGS_TAX_BRACKETS = [
  { limit: 6000,     rate: 0.19 },
  { limit: 44000,    rate: 0.21 },  // 6,000 - 50,000
  { limit: 150000,   rate: 0.23 },  // 50,000 - 200,000
  { limit: 100000,   rate: 0.27 },  // 200,000 - 300,000
  { limit: Infinity, rate: 0.28 },  // > 300,000
];

// ─── Financial Functions ────────────────────────────────────────

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** French amortization monthly payment */
function pmt(monthlyRate: number, nMonths: number, principal: number): number {
  if (nMonths <= 0 || principal <= 0) return 0;
  if (monthlyRate === 0) return principal / nMonths;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -nMonths));
}

/** Remaining mortgage balance at month k */
function balanceAtMonth(principal: number, monthlyRate: number, nMonths: number, k: number): number {
  if (k >= nMonths) return 0;
  if (k <= 0) return principal;
  if (monthlyRate === 0) return principal * (1 - k / nMonths);
  return principal * (Math.pow(1 + monthlyRate, nMonths) - Math.pow(1 + monthlyRate, k))
       / (Math.pow(1 + monthlyRate, nMonths) - 1);
}

/** Spanish savings tax (base del ahorro) - progressive 19%-28% */
function calcSavingsTax(gain: number): number {
  if (gain <= 0) return 0;
  let tax = 0;
  let remaining = gain;
  for (const bracket of SAVINGS_TAX_BRACKETS) {
    const taxable = Math.min(remaining, bracket.limit);
    tax += taxable * bracket.rate;
    remaining -= taxable;
    if (remaining <= 0) break;
  }
  return tax;
}

/** Purchase tax: ITP (used) or IVA/IGIC/IPSI + AJD (new) */
function calcPurchaseTax(homePrice: number, homeType: HomeType, ccaa: CcaaData): number {
  if (homeType === 'used') {
    return homePrice * ccaa.itpPct / 100;
  }
  // New home: IVA/IGIC/IPSI + AJD
  return homePrice * (ccaa.newHomeTaxPct + ccaa.ajdPct) / 100;
}

function formatEUR(n: number, locale: string): string {
  return n.toLocaleString(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function formatPct(n: number, locale: string, decimals = 2): string {
  return n.toLocaleString(locale, { style: 'percent', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ─── Simulation Engine ──────────────────────────────────────────

type SimParams = {
  homePrice: number;
  downPaymentPct: number;
  homeType: HomeType;
  ccaa: CcaaData;
  appreciationPct: number;
  sellingCostPct: number;
  tinPct: number;
  termYears: number;
  ibiPct: number;
  maintenancePct: number;
  communityMonthly: number;
  insuranceAnnual: number;
  notaryCostPct: number;
  monthlyRent: number;
  rentIncreasePct: number;
  msciReturnPct: number;
  reinvestmentExemption: boolean;
};

type YearData = {
  year: number;
  // Buy scenario
  homeValue: number;
  remainingMortgage: number;
  totalMortgagePaid: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  totalOwnershipCosts: number; // IBI + maintenance + community + insurance
  // Exit: sell
  salePrice: number;
  sellingCosts: number;
  capitalGainBuy: number;
  capitalGainsTaxBuy: number;
  grossProceedsBuy: number;
  // Rent scenario
  currentMonthlyRent: number;
  totalRentPaid: number;
  portfolioValue: number;
  totalContributions: number;
  portfolioGain: number;
  capitalGainsTaxRent: number;
  netPortfolioAfterTax: number;
  // Comparison
  buyAdvantage: number;
  // Monthly costs at this year
  monthlyBuyCost: number;
};

function simulate(params: SimParams): YearData[] {
  const {
    homePrice, downPaymentPct, homeType, ccaa, appreciationPct, sellingCostPct,
    tinPct, termYears, ibiPct, maintenancePct, communityMonthly, insuranceAnnual,
    notaryCostPct, monthlyRent, rentIncreasePct, msciReturnPct, reinvestmentExemption,
  } = params;

  const downPayment = homePrice * downPaymentPct / 100;
  const loanAmount = homePrice - downPayment;
  const monthlyRate = tinPct / 100 / 12;
  const totalMonths = termYears * 12;
  const monthlyMortgage = pmt(monthlyRate, totalMonths, loanAmount);
  const monthlyMsci = Math.pow(1 + msciReturnPct / 100, 1 / 12) - 1;

  const purchaseTax = calcPurchaseTax(homePrice, homeType, ccaa);
  const notaryCost = homePrice * notaryCostPct / 100;
  const totalUpfront = downPayment + purchaseTax + notaryCost;

  // Rent scenario: invest everything that would go to upfront costs
  let portfolio = totalUpfront;
  let totalContributions = totalUpfront;
  let totalRentPaid = 0;
  let totalMortgagePaid = 0;
  let totalInterestPaid = 0;
  let totalOwnershipCosts = 0;
  let currentBalance = loanAmount;

  const results: YearData[] = [];

  for (let year = 1; year <= termYears; year++) {
    const homeValueThisYear = homePrice * Math.pow(1 + appreciationPct / 100, year);
    const homeValuePrevYear = homePrice * Math.pow(1 + appreciationPct / 100, year - 1);

    // Monthly costs for this year (IBI and maintenance scale with home value)
    const monthlyIbi = homeValuePrevYear * (ibiPct / 100) / 12;
    const monthlyMaint = homeValuePrevYear * (maintenancePct / 100) / 12;
    const monthlyIns = insuranceAnnual / 12;
    const currentRent = monthlyRent * Math.pow(1 + rentIncreasePct / 100, year - 1);

    for (let m = 0; m < 12; m++) {
      // Mortgage
      const interestPortion = currentBalance * monthlyRate;
      const principalPortion = Math.min(monthlyMortgage - interestPortion, currentBalance);
      currentBalance = Math.max(0, currentBalance - principalPortion);

      totalMortgagePaid += monthlyMortgage;
      totalInterestPaid += interestPortion;
      totalOwnershipCosts += monthlyIbi + monthlyMaint + communityMonthly + monthlyIns;

      // Total monthly buy cost
      const totalMonthlyBuy = monthlyMortgage + monthlyIbi + monthlyMaint + communityMonthly + monthlyIns;

      // Rent scenario
      totalRentPaid += currentRent;
      const monthlySavings = totalMonthlyBuy - currentRent;

      // Grow portfolio, then add/withdraw savings
      portfolio = portfolio * (1 + monthlyMsci) + monthlySavings;
      totalContributions += monthlySavings;
    }

    // End of year: calculate exit scenarios
    // Spanish capital gain: valor transmisión - valor adquisición
    // Valor adquisición = homePrice + purchaseTax + notaryCost (fiscal deductible costs)
    const salePrice = homeValueThisYear;
    const sellingCosts = salePrice * sellingCostPct / 100;
    const transmissionValue = salePrice - sellingCosts;
    const acquisitionValue = homePrice + purchaseTax + notaryCost;
    const capitalGainBuy = Math.max(0, transmissionValue - acquisitionValue);
    const capitalGainsTaxBuy = reinvestmentExemption ? 0 : calcSavingsTax(capitalGainBuy);
    const grossProceedsBuy = salePrice - sellingCosts - currentBalance - capitalGainsTaxBuy;

    // Rent exit
    const portfolioGain = Math.max(0, portfolio - Math.max(0, totalContributions));
    const capitalGainsTaxRent = calcSavingsTax(portfolioGain);
    const netPortfolioAfterTax = portfolio - capitalGainsTaxRent;

    const monthlyBuyCost = monthlyMortgage + monthlyIbi + monthlyMaint + communityMonthly + monthlyIns;

    results.push({
      year,
      homeValue: homeValueThisYear,
      remainingMortgage: currentBalance,
      totalMortgagePaid,
      totalInterestPaid,
      totalPrincipalPaid: totalMortgagePaid - totalInterestPaid,
      totalOwnershipCosts,
      salePrice,
      sellingCosts,
      capitalGainBuy,
      capitalGainsTaxBuy,
      grossProceedsBuy,
      currentMonthlyRent: currentRent,
      totalRentPaid,
      portfolioValue: portfolio,
      totalContributions,
      portfolioGain,
      capitalGainsTaxRent,
      netPortfolioAfterTax,
      buyAdvantage: grossProceedsBuy - netPortfolioAfterTax,
      monthlyBuyCost,
    });
  }

  return results;
}

// ─── i18n ───────────────────────────────────────────────────────

const TEXTS = {
  es: {
    back: 'Volver a Herramientas',
    title: '¿Comprar o Alquilar?',
    subtitle: 'Calcula en qué año comprar una vivienda supera financieramente a alquilar e invertir la diferencia. Adaptado a la fiscalidad española con impuestos por Comunidad Autónoma.',
    langES: 'ES',
    langEN: 'EN',
    shareLink: 'Link permanente',
    shareCopied: 'Link copiado',
    shareReady: 'Listo para compartir',
    // Property
    propertyTitle: 'Propiedad',
    homePrice: 'Precio de la vivienda',
    downPayment: 'Entrada',
    homeType: 'Tipo de vivienda',
    homeTypeNew: 'Nueva',
    homeTypeUsed: 'Segunda mano',
    ccaa: 'Comunidad Autónoma',
    appreciation: 'Revalorización anual',
    sellingCosts: 'Gastos de venta',
    sellingCostsInfo: 'Comisión de agencia inmobiliaria + gastos de cancelación registral. En España suele ser 3-5%.',
    // Mortgage
    mortgageTitle: 'Hipoteca',
    tin: 'Tipo de interés (TIN)',
    term: 'Plazo',
    ibi: 'IBI (anual)',
    ibiInfo: 'Impuesto sobre Bienes Inmuebles. Se calcula como % del valor de la vivienda (aprox. equivalente a aplicar el tipo del IBI sobre el valor catastral).',
    maintenance: 'Mantenimiento (anual)',
    maintenanceInfo: 'Reparaciones, derramas, reformas. Se calcula como % del valor actual de la vivienda.',
    community: 'Comunidad (mensual)',
    insurance: 'Seguro hogar (anual)',
    // Rent
    rentTitle: 'Alquiler e Inversión',
    monthlyRent: 'Alquiler mensual',
    rentIncrease: 'Subida anual del alquiler',
    msciReturn: 'Rentabilidad MSCI World',
    msciInfo: 'Rendimiento medio anual bruto del MSCI World. Histórico a largo plazo ~8-9% nominal. Se usa 7% como estimación conservadora.',
    // Tax
    taxTitle: 'Impuestos de Compra',
    purchaseTax: 'Impuesto de compra',
    purchaseTaxUsedLabel: 'ITP',
    notaryCost: 'Notaría, registro, gestoría',
    notaryCostInfo: 'Gastos de notaría, registro de la propiedad y gestoría. Suelen ser un 1.5-2.5% del precio.',
    totalUpfront: 'Coste total inicial',
    totalUpfrontInfo: 'Entrada + impuestos + notaría. Todo el dinero necesario para comprar.',
    reinvestment: 'Exención por reinversión',
    reinvestmentInfo: 'Si vendes tu vivienda habitual y compras otra en un plazo de 2 años, la plusvalía está exenta de impuestos. Es uno de los mayores beneficios fiscales de la compra.',
    reinvestmentYes: 'Sí (exenta plusvalía)',
    reinvestmentNo: 'No',
    // Summary
    summaryMonthly: 'Cuota mensual',
    summaryMonthlyInfo: 'Solo la cuota de la hipoteca (capital + intereses).',
    summaryTotalInterest: 'Intereses totales',
    summaryHomeValue: 'Valor vivienda',
    summaryNetEquity: 'Patrimonio neto',
    summaryNetEquityInfo: 'Valor de la vivienda menos hipoteca pendiente, al final del plazo.',
    atYear: 'al año',
    // Chart
    chartTitle: 'Estrategia de Salida',
    chartBuyLine: 'Comprar y vender',
    chartRentLine: 'Alquilar e invertir',
    exitYear: 'Año de salida',
    breakEvenYear: 'Año de break-even',
    noBreakEven: 'No se alcanza',
    // Exit analysis
    exitTitle: 'Análisis al Año',
    buySection: 'Comprar y Vender (neto)',
    rentSection: 'Alquilar e Invertir (neto)',
    comparison: 'Comparativa',
    salePrice: 'Precio de venta',
    sellingCostsLabel: 'Gastos de venta',
    loanPayoff: 'Hipoteca pendiente',
    capGainsTaxBuy: 'Plusvalía (impuesto)',
    grossProceeds: 'Patrimonio neto (compra)',
    downPaymentOut: 'Entrada (desembolso)',
    totalInterestPaid: 'Intereses pagados',
    totalOwnership: 'IBI + mantenim. + comunidad + seguro',
    purchaseTaxesPaid: 'Impuestos de compra + notaría',
    initialInvestment: 'Inversión inicial (MSCI)',
    initialInvestmentInfo: 'Entrada + impuestos + notaría: el dinero que no gastas en comprar y que inviertes en MSCI World.',
    monthlySavings: 'Ahorro mensual invertido',
    monthlySavingsInfo: 'Diferencia entre el coste mensual de comprar y el alquiler. Se invierte mensualmente en MSCI World.',
    portfolioValue: 'Valor del portfolio',
    totalRentPaid: 'Alquiler total pagado',
    capGainsTaxRent: 'Plusvalía MSCI (impuesto)',
    netPortfolio: 'Patrimonio neto (alquiler)',
    buyAdvantage: 'Comprar Gana',
    rentAdvantage: 'Alquilar Gana',
    // Notes
    notesTitle: 'Notas',
    notes: [
      'Los impuestos sobre plusvalías se calculan según la base del ahorro española: 19% (0-6K), 21% (6-50K), 23% (50-200K), 27% (200-300K), 28% (>300K).',
      'La exención por reinversión en vivienda habitual aplica si compras otra vivienda habitual en 2 años tras la venta.',
      'En España no existe deducción por intereses hipotecarios para compras posteriores a enero de 2013.',
      'El IBI se basa en el valor catastral (generalmente inferior al valor de mercado). El % indicado es una aproximación sobre el valor de mercado.',
      'Los tipos de ITP y AJD son los generales de cada CCAA. Pueden existir tipos reducidos para menores de 35 años, familias numerosas, etc.',
      'La rentabilidad del MSCI World es nominal (antes de inflación). Para una estimación real, restar ~2% de inflación.',
      'No se incluye la plusvalía municipal por la complejidad de su cálculo (depende del municipio y el valor catastral del suelo).',
      'Esta herramienta es orientativa. Consulta con un asesor fiscal para tu caso concreto.',
    ],
    notesEn: [
      'Capital gains taxes follow Spanish savings tax base: 19% (0-6K), 21% (6-50K), 23% (50-200K), 27% (200-300K), 28% (>300K).',
      'Primary residence reinvestment exemption applies if you purchase another primary residence within 2 years of selling.',
      'In Spain, mortgage interest deductions were eliminated for purchases after January 2013.',
      'IBI (property tax) is based on cadastral value (typically lower than market value). The % shown is an approximation on market value.',
      'ITP and AJD rates are the general rates for each region. Reduced rates may exist for buyers under 35, large families, etc.',
      'MSCI World returns are nominal (before inflation). For real returns, subtract ~2% for inflation.',
      'Municipal capital gains tax (plusvalía municipal) is not included due to its complex, municipality-dependent calculation.',
      'This tool is for informational purposes only. Consult a tax advisor for your specific situation.',
    ],
    years: 'años',
    monthlyBuyCostLabel: 'Coste mensual compra',
    monthlyRentLabel: 'Alquiler mensual',
  },
  en: {
    back: 'Back to Tools',
    title: 'Buy or Rent?',
    subtitle: 'Calculate the year when buying a home beats renting and investing the difference. Adapted to Spanish tax system with region-specific taxes.',
    langES: 'ES',
    langEN: 'EN',
    shareLink: 'Permanent link',
    shareCopied: 'Link copied',
    shareReady: 'Ready to share',
    propertyTitle: 'Property',
    homePrice: 'Home price',
    downPayment: 'Down payment',
    homeType: 'Home type',
    homeTypeNew: 'New build',
    homeTypeUsed: 'Resale',
    ccaa: 'Region (CCAA)',
    appreciation: 'Annual appreciation',
    sellingCosts: 'Selling costs',
    sellingCostsInfo: 'Real estate agency commission + registry cancellation. In Spain typically 3-5%.',
    mortgageTitle: 'Mortgage',
    tin: 'Interest rate (TIN)',
    term: 'Term',
    ibi: 'Property tax / IBI (annual)',
    ibiInfo: 'IBI (Impuesto sobre Bienes Inmuebles). Calculated as % of home value (approximation of the IBI rate applied to cadastral value).',
    maintenance: 'Maintenance (annual)',
    maintenanceInfo: 'Repairs, levies, renovations. Calculated as % of current home value.',
    community: 'HOA fees (monthly)',
    insurance: 'Home insurance (annual)',
    rentTitle: 'Rent & Invest',
    monthlyRent: 'Monthly rent',
    rentIncrease: 'Annual rent increase',
    msciReturn: 'MSCI World return',
    msciInfo: 'Average gross annual return of MSCI World. Historical long-term ~8-9% nominal. Using 7% as a conservative estimate.',
    taxTitle: 'Purchase Taxes',
    purchaseTax: 'Purchase tax',
    purchaseTaxUsedLabel: 'ITP',
    notaryCost: 'Notary, registry, agency',
    notaryCostInfo: 'Notary, property registry and agency costs. Typically 1.5-2.5% of the price.',
    totalUpfront: 'Total upfront cost',
    totalUpfrontInfo: 'Down payment + taxes + notary. All cash needed to buy.',
    reinvestment: 'Reinvestment exemption',
    reinvestmentInfo: 'If you sell your primary residence and buy another within 2 years, capital gains are tax-exempt. One of the biggest tax advantages of buying in Spain.',
    reinvestmentYes: 'Yes (gains exempt)',
    reinvestmentNo: 'No',
    summaryMonthly: 'Monthly payment',
    summaryMonthlyInfo: 'Mortgage payment only (principal + interest).',
    summaryTotalInterest: 'Total interest',
    summaryHomeValue: 'Home value',
    summaryNetEquity: 'Net equity',
    summaryNetEquityInfo: 'Home value minus remaining mortgage at term end.',
    atYear: 'at year',
    chartTitle: 'Exit Strategy',
    chartBuyLine: 'Buy & sell',
    chartRentLine: 'Rent & invest',
    exitYear: 'Exit year',
    breakEvenYear: 'Break-even year',
    noBreakEven: 'Not reached',
    exitTitle: 'Analysis at Year',
    buySection: 'Buy & Sell (after-tax)',
    rentSection: 'Rent & Invest (after-tax)',
    comparison: 'Head-to-Head',
    salePrice: 'Sale price',
    sellingCostsLabel: 'Selling costs',
    loanPayoff: 'Loan payoff',
    capGainsTaxBuy: 'Capital gains tax',
    grossProceeds: 'Net wealth (buy)',
    downPaymentOut: 'Down payment (out)',
    totalInterestPaid: 'Interest paid',
    totalOwnership: 'IBI + maint. + HOA + insurance',
    purchaseTaxesPaid: 'Purchase taxes + notary',
    initialInvestment: 'Initial investment (MSCI)',
    initialInvestmentInfo: 'Down payment + taxes + notary: the money you don\'t spend on buying, invested in MSCI World.',
    monthlySavings: 'Monthly savings invested',
    monthlySavingsInfo: 'Difference between monthly buy cost and rent. Invested monthly in MSCI World.',
    portfolioValue: 'Portfolio value',
    totalRentPaid: 'Total rent paid',
    capGainsTaxRent: 'MSCI capital gains tax',
    netPortfolio: 'Net wealth (rent)',
    buyAdvantage: 'Buying Wins',
    rentAdvantage: 'Renting Wins',
    notesTitle: 'Notes',
    notes: [
      'Capital gains taxes follow Spanish savings tax base: 19% (0-6K), 21% (6-50K), 23% (50-200K), 27% (200-300K), 28% (>300K).',
      'Primary residence reinvestment exemption applies if you purchase another primary residence within 2 years of selling.',
      'In Spain, mortgage interest deductions were eliminated for purchases after January 2013.',
      'IBI (property tax) is based on cadastral value (typically lower than market value). The % shown is an approximation on market value.',
      'ITP and AJD rates are the general rates for each region. Reduced rates may exist for buyers under 35, large families, etc.',
      'MSCI World returns are nominal (before inflation). For real returns, subtract ~2% for inflation.',
      'Municipal capital gains tax (plusvalia municipal) is not included due to its complex, municipality-dependent calculation.',
      'This tool is for informational purposes only. Consult a tax advisor for your specific situation.',
    ] as string[],
    notesEn: [] as string[],
    years: 'yrs',
    monthlyBuyCostLabel: 'Monthly buy cost',
    monthlyRentLabel: 'Monthly rent',
  },
} as const;

type I18n = { [K in keyof typeof TEXTS['es']]: (typeof TEXTS['es'])[K] };

// ─── Utility Components ─────────────────────────────────────────

function InfoTip({ content, label = 'Info', side = 'bottom', className = '' }: { content: React.ReactNode; label?: string; side?: 'top' | 'bottom'; className?: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onScroll = () => setOpen(false);
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
      <button ref={btnRef} type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center justify-center w-4 h-4 text-[10px] rounded-full border align-middle focus:outline-none focus:ring-2 focus:ring-cyan-500 ${open ? 'border-cyan-400 text-cyan-700 bg-cyan-50' : 'border-gray-300 text-gray-600 bg-white'}`}>
        i
      </button>
      {open && (
        <div ref={popRef} id={id} role="tooltip"
          className={`absolute z-50 ${side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} left-1/2 -translate-x-1/2 max-w-[280px] text-xs p-2.5 rounded-lg border bg-white shadow-lg text-gray-700`}>
          {content}
        </div>
      )}
    </span>
  );
}

// ─── Custom Chart Tooltip ───────────────────────────────────────

function ChartTooltipContent({ active, payload, label, locale, t }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-semibold mb-1">{t.exitYear}: {label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="flex justify-between gap-4">
          <span>{entry.name}:</span>
          <span className="font-medium">{formatEUR(entry.value, locale)}</span>
        </p>
      ))}
    </div>
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

// ─── Main App ───────────────────────────────────────────────────

export default function App() {
  const [lang, setLang] = useState<Lang>(getStoredLang);
  const [themeChoice, setThemeChoice] = useState<ThemeMode | null>(getStoredThemeChoice);
  const t = TEXTS[lang] as I18n;
  const locale = lang === 'es' ? 'es-ES' : 'en-GB';
  const activeTheme = resolveTheme(themeChoice);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    }
  }, [lang]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const resolved = themeChoice ?? (media.matches ? 'dark' : 'light');
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
    applyTheme();
    if (themeChoice !== null) {
      return;
    }
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [themeChoice]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (themeChoice) {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeChoice);
    } else {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    }
  }, [themeChoice]);

  // ─── Input State ────────────────────────────────────────────
  const [homePrice, setHomePrice] = useState(250000);
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [homeType, setHomeType] = useState<HomeType>('used');
  const [ccaaId, setCcaaId] = useState('cataluna');
  const [appreciationPct, setAppreciationPct] = useState(3.0);
  const [sellingCostPct, setSellingCostPct] = useState(3.0);

  const [tinPct, setTinPct] = useState(2.50);
  const [termYears, setTermYears] = useState(30);
  const [ibiPct, setIbiPct] = useState(() => (CCAA_LIST.find(c => c.id === 'cataluna')?.avgIbiPct ?? 0.60));
  const [maintenancePct, setMaintenancePct] = useState(1.0);
  const [communityMonthly, setCommunityMonthly] = useState(50);
  const [insuranceAnnual, setInsuranceAnnual] = useState(300);
  const [notaryCostPct, setNotaryCostPct] = useState(2.0);

  const [monthlyRent, setMonthlyRent] = useState(900);
  const [rentIncreasePct, setRentIncreasePct] = useState(2.5);
  const [msciReturnPct, setMsciReturnPct] = useState(7.0);

  const [reinvestmentExemption, setReinvestmentExemption] = useState(true);
  const [exitYear, setExitYear] = useState(10);
  const [shareUrl, setShareUrl] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const skipIbiSync = useRef(false);

  const ccaa = useMemo(() => CCAA_LIST.find(c => c.id === ccaaId) || CCAA_LIST[12], [ccaaId]);

  // Update IBI default when CCAA changes (skip when restoring from share URL)
  useEffect(() => {
    if (skipIbiSync.current) { skipIbiSync.current = false; return; }
    setIbiPct(ccaa.avgIbiPct);
  }, [ccaa]);

  // ─── Share URL: encode/decode state in URL ────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('s');
    if (!raw) return;
    try {
      const d = JSON.parse(atob(raw));
      if (!d || typeof d !== 'object') return;
      skipIbiSync.current = true;
      if (typeof d.hp === 'number') setHomePrice(clamp(d.hp, 0, 10_000_000));
      if (typeof d.dp === 'number') setDownPaymentPct(clamp(d.dp, 5, 100));
      if (d.ht === 'new' || d.ht === 'used') setHomeType(d.ht);
      if (typeof d.cc === 'string' && CCAA_LIST.some(c => c.id === d.cc)) setCcaaId(d.cc);
      if (typeof d.ap === 'number') setAppreciationPct(clamp(d.ap, 0, 10));
      if (typeof d.sc === 'number') setSellingCostPct(clamp(d.sc, 0, 10));
      if (typeof d.tin === 'number') setTinPct(clamp(d.tin, 0.5, 8));
      if (typeof d.ty === 'number') setTermYears(clamp(d.ty, 5, 40));
      if (typeof d.ibi === 'number') setIbiPct(clamp(d.ibi, 0, 2));
      if (typeof d.mp === 'number') setMaintenancePct(clamp(d.mp, 0, 3));
      if (typeof d.cm === 'number') setCommunityMonthly(clamp(d.cm, 0, 2000));
      if (typeof d.ia === 'number') setInsuranceAnnual(clamp(d.ia, 0, 10000));
      if (typeof d.nc === 'number') setNotaryCostPct(clamp(d.nc, 0, 10));
      if (typeof d.mr === 'number') setMonthlyRent(clamp(d.mr, 0, 20000));
      if (typeof d.ri === 'number') setRentIncreasePct(clamp(d.ri, 0, 10));
      if (typeof d.ms === 'number') setMsciReturnPct(clamp(d.ms, 0, 15));
      if (typeof d.re === 'boolean') setReinvestmentExemption(d.re);
      if (typeof d.ey === 'number') setExitYear(clamp(d.ey, 1, 40));
    } catch { /* ignore invalid share data */ }
  }, []);

  const onShare = async () => {
    const payload = btoa(JSON.stringify({
      hp: homePrice, dp: downPaymentPct, ht: homeType, cc: ccaaId,
      ap: appreciationPct, sc: sellingCostPct, tin: tinPct, ty: termYears,
      ibi: ibiPct, mp: maintenancePct, cm: communityMonthly, ia: insuranceAnnual,
      nc: notaryCostPct, mr: monthlyRent, ri: rentIncreasePct, ms: msciReturnPct,
      re: reinvestmentExemption, ey: exitYear,
    }));
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('s', payload);
    const nextUrl = url.toString();
    setShareUrl(nextUrl);
    setShareCopied(false);
    try {
      await navigator.clipboard.writeText(nextUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch { /* clipboard not available */ }
  };

  // ─── Derived Values ─────────────────────────────────────────
  const downPayment = homePrice * downPaymentPct / 100;
  const loanAmount = homePrice - downPayment;
  const purchaseTax = useMemo(() => calcPurchaseTax(homePrice, homeType, ccaa), [homePrice, homeType, ccaa]);
  const notaryCost = homePrice * notaryCostPct / 100;
  const totalUpfront = downPayment + purchaseTax + notaryCost;
  const monthlyMortgage = useMemo(() => pmt(tinPct / 100 / 12, termYears * 12, loanAmount), [tinPct, termYears, loanAmount]);

  const purchaseTaxLabel = useMemo(() => {
    if (homeType === 'used') return 'ITP';
    return ccaa.newHomeTaxLabel + ' + AJD';
  }, [homeType, ccaa]);

  const purchaseTaxDetail = useMemo(() => {
    if (homeType === 'used') return `${ccaa.itpPct}%`;
    return `${ccaa.newHomeTaxPct}% + ${ccaa.ajdPct}%`;
  }, [homeType, ccaa]);

  // ─── Simulation ─────────────────────────────────────────────
  const yearlyData = useMemo(() => simulate({
    homePrice, downPaymentPct, homeType, ccaa, appreciationPct, sellingCostPct,
    tinPct, termYears, ibiPct, maintenancePct, communityMonthly, insuranceAnnual,
    notaryCostPct, monthlyRent, rentIncreasePct, msciReturnPct, reinvestmentExemption,
  }), [homePrice, downPaymentPct, homeType, ccaa, appreciationPct, sellingCostPct,
    tinPct, termYears, ibiPct, maintenancePct, communityMonthly, insuranceAnnual,
    notaryCostPct, monthlyRent, rentIncreasePct, msciReturnPct, reinvestmentExemption]);

  const clampedExitYear = clamp(exitYear, 1, termYears);
  const exitData = yearlyData[clampedExitYear - 1];

  // Break-even year: first year where buy advantage >= 0
  const breakEvenYear = useMemo(() => {
    const idx = yearlyData.findIndex(d => d.buyAdvantage >= 0);
    return idx >= 0 ? idx + 1 : null;
  }, [yearlyData]);

  // Chart data
  const chartData = useMemo(() => yearlyData.map(d => ({
    year: d.year,
    buy: Math.round(d.grossProceedsBuy),
    rent: Math.round(d.netPortfolioAfterTax),
  })), [yearlyData]);

  // Summary values (at end of term)
  const finalData = yearlyData[yearlyData.length - 1];

  // ─── Render ─────────────────────────────────────────────────
  const notesArr = t.notes;

  return (
    <>
      <div className="relative min-h-screen text-gray-900">
        <style>{`
          .landing-bg{position:fixed;inset:0;z-index:-1;background:
            radial-gradient(900px 600px at 10% 0%,rgba(14,165,233,.12),transparent 60%),
            radial-gradient(900px 600px at 90% -10%,rgba(2,132,199,.10),transparent 60%),
            linear-gradient(180deg,#fff 0%,#f8fbff 60%,#fff 100%),
            linear-gradient(to bottom,rgba(15,23,42,.04) 1px,transparent 1px),
            linear-gradient(to right,rgba(15,23,42,.04) 1px,transparent 1px);
            background-size:auto,auto,100% 100%,24px 24px,24px 24px;background-position:center}
          html[data-theme="dark"] .landing-bg{background:
            radial-gradient(900px 600px at 10% 0%, rgba(14,165,233,.20), transparent 62%),
            radial-gradient(900px 600px at 90% -10%, rgba(8,47,73,.55), transparent 62%),
            linear-gradient(180deg,#020617 0%,#0f172a 60%,#020617 100%),
            linear-gradient(to bottom, rgba(148,163,184,.10) 1px, transparent 1px),
            linear-gradient(to right, rgba(148,163,184,.10) 1px, transparent 1px)}
        `}</style>
        <div className="landing-bg" aria-hidden="true" />

        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
            <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline">
              <span aria-hidden="true">&larr;</span>{t.back}
            </a>
            <div className="flex items-center gap-2">
              <div
                className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
                role="group"
                aria-label={lang === 'es' ? 'Selector de tema' : 'Theme switcher'}
              >
                <button
                  type="button"
                  onClick={() => setThemeChoice('light')}
                  aria-label={lang === 'es' ? 'Tema claro' : 'Light theme'}
                  aria-pressed={activeTheme === 'light'}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    activeTheme === 'light' ? 'bg-cyan-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <SunIcon />
                </button>
                <button
                  type="button"
                  onClick={() => setThemeChoice('dark')}
                  aria-label={lang === 'es' ? 'Tema oscuro' : 'Dark theme'}
                  aria-pressed={activeTheme === 'dark'}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    activeTheme === 'dark' ? 'bg-cyan-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <MoonIcon />
                </button>
              </div>
              <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm" role="group" aria-label="Language">
                {(['es', 'en'] as Lang[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    aria-pressed={lang === l}
                    className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      lang === l ? 'bg-cyan-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* ── Title ── */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-extrabold">{t.title}</h1>
              <button type="button" onClick={onShare}
                className="rounded-full border border-cyan-600 bg-cyan-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-cyan-700 hover:border-cyan-700 transition-colors no-print">
                {t.shareLink}
              </button>
            </div>
            <p className="text-sm md:text-base text-gray-700">{t.subtitle}</p>
            {shareUrl && (
              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600 no-print">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">{t.shareReady}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <input type="text" value={shareUrl} readOnly
                    className="min-w-[260px] flex-1 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs text-gray-700 shadow-sm" />
                  {shareCopied && (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                      {t.shareCopied}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Input Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Property */}
            <div className="bg-white rounded-2xl shadow p-4 space-y-3">
              <h2 className="font-semibold text-lg">{t.propertyTitle}</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.homePrice}</label>
                <div className="relative">
                  <input type="number" className="w-full border rounded-xl p-2 pr-8 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    value={homePrice} onChange={e => setHomePrice(clamp(Number(e.target.value) || 0, 0, 10_000_000))} min={0} step={5000} />
                  <span className="absolute inset-y-0 right-3 flex items-center text-gray-500 pointer-events-none">&euro;</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.downPayment}</label>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1 accent-cyan-600" min={5} max={100} step={1} value={downPaymentPct}
                    onChange={e => setDownPaymentPct(Number(e.target.value))} />
                  <span className="text-sm font-medium w-12 text-right">{downPaymentPct}%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{formatEUR(downPayment, locale)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.homeType}</label>
                <div className="flex gap-2">
                  {(['used', 'new'] as HomeType[]).map(ht => (
                    <label key={ht} className="cursor-pointer flex-1">
                      <input type="radio" name="homeType" className="sr-only peer" checked={homeType === ht} onChange={() => setHomeType(ht)} />
                      <span className="block text-center text-sm py-1.5 rounded-lg border border-gray-300 peer-checked:bg-cyan-600 peer-checked:text-white peer-checked:border-cyan-600 select-none">
                        {ht === 'new' ? t.homeTypeNew : t.homeTypeUsed}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.ccaa}</label>
                <select className="w-full border rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  value={ccaaId} onChange={e => setCcaaId(e.target.value)}>
                  {CCAA_LIST.map(c => (
                    <option key={c.id} value={c.id}>{c.name[lang]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.appreciation}</label>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1 accent-cyan-600" min={0} max={10} step={0.5} value={appreciationPct}
                    onChange={e => setAppreciationPct(Number(e.target.value))} />
                  <span className="text-sm font-medium w-12 text-right">{appreciationPct.toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
                  {t.sellingCosts}
                  <InfoTip content={t.sellingCostsInfo} />
                </label>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1 accent-cyan-600" min={0} max={10} step={0.5} value={sellingCostPct}
                    onChange={e => setSellingCostPct(Number(e.target.value))} />
                  <span className="text-sm font-medium w-12 text-right">{sellingCostPct.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Mortgage */}
            <div className="bg-white rounded-2xl shadow p-4 space-y-3">
              <h2 className="font-semibold text-lg">{t.mortgageTitle}</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.tin}</label>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1 accent-cyan-600" min={0.5} max={8} step={0.05} value={tinPct}
                    onChange={e => setTinPct(Number(e.target.value))} />
                  <span className="text-sm font-medium w-14 text-right">{tinPct.toFixed(2)}%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.term}</label>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1 accent-cyan-600" min={5} max={40} step={1} value={termYears}
                    onChange={e => { setTermYears(Number(e.target.value)); setExitYear(Math.min(exitYear, Number(e.target.value))); }} />
                  <span className="text-sm font-medium w-16 text-right">{termYears} {t.years}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
                  {t.ibi}
                  <InfoTip content={t.ibiInfo} />
                </label>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1 accent-cyan-600" min={0} max={2} step={0.05} value={ibiPct}
                    onChange={e => setIbiPct(Number(e.target.value))} />
                  <span className="text-sm font-medium w-14 text-right">{ibiPct.toFixed(2)}%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
                  {t.maintenance}
                  <InfoTip content={t.maintenanceInfo} />
                </label>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1 accent-cyan-600" min={0} max={3} step={0.1} value={maintenancePct}
                    onChange={e => setMaintenancePct(Number(e.target.value))} />
                  <span className="text-sm font-medium w-14 text-right">{maintenancePct.toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.community}</label>
                <div className="relative">
                  <input type="number" className="w-full border rounded-xl p-2 pr-12 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    value={communityMonthly} onChange={e => setCommunityMonthly(clamp(Number(e.target.value) || 0, 0, 2000))} min={0} step={10} />
                  <span className="absolute inset-y-0 right-3 flex items-center text-gray-500 pointer-events-none text-sm">&euro;/m</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.insurance}</label>
                <div className="relative">
                  <input type="number" className="w-full border rounded-xl p-2 pr-14 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    value={insuranceAnnual} onChange={e => setInsuranceAnnual(clamp(Number(e.target.value) || 0, 0, 10000))} min={0} step={50} />
                  <span className="absolute inset-y-0 right-3 flex items-center text-gray-500 pointer-events-none text-sm">&euro;/{lang === 'es' ? 'año' : 'yr'}</span>
                </div>
              </div>
            </div>

            {/* Rent & Invest */}
            <div className="bg-white rounded-2xl shadow p-4 space-y-3">
              <h2 className="font-semibold text-lg">{t.rentTitle}</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.monthlyRent}</label>
                <div className="relative">
                  <input type="number" className="w-full border rounded-xl p-2 pr-12 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    value={monthlyRent} onChange={e => setMonthlyRent(clamp(Number(e.target.value) || 0, 0, 20000))} min={0} step={50} />
                  <span className="absolute inset-y-0 right-3 flex items-center text-gray-500 pointer-events-none text-sm">&euro;/m</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.rentIncrease}</label>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1 accent-cyan-600" min={0} max={10} step={0.5} value={rentIncreasePct}
                    onChange={e => setRentIncreasePct(Number(e.target.value))} />
                  <span className="text-sm font-medium w-12 text-right">{rentIncreasePct.toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
                  {t.msciReturn}
                  <InfoTip content={t.msciInfo} />
                </label>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1 accent-cyan-600" min={0} max={15} step={0.5} value={msciReturnPct}
                    onChange={e => setMsciReturnPct(Number(e.target.value))} />
                  <span className="text-sm font-medium w-14 text-right">{msciReturnPct.toFixed(1)}%</span>
                </div>
              </div>

              {/* Tax section */}
              <hr className="border-gray-200 my-2" />
              <h3 className="font-semibold text-sm text-gray-600">{t.taxTitle}</h3>
              <div className="text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t.purchaseTax} ({purchaseTaxLabel}: {purchaseTaxDetail})</span>
                  <span className="font-medium">{formatEUR(purchaseTax, locale)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 inline-flex items-center gap-1">
                    {t.notaryCost}
                    <InfoTip content={t.notaryCostInfo} />
                  </span>
                  <div className="flex items-center gap-1">
                    <input type="number" className="w-16 border rounded-lg px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      value={notaryCostPct} onChange={e => setNotaryCostPct(clamp(Number(e.target.value) || 0, 0, 10))} min={0} max={10} step={0.5} />
                    <span className="text-gray-500 text-xs">%</span>
                    <span className="font-medium ml-1">{formatEUR(notaryCost, locale)}</span>
                  </div>
                </div>
                <div className="flex justify-between font-semibold border-t pt-1.5">
                  <span className="inline-flex items-center gap-1">
                    {t.totalUpfront}
                    <InfoTip content={t.totalUpfrontInfo} />
                  </span>
                  <span>{formatEUR(totalUpfront, locale)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 inline-flex items-center gap-1">
                  {t.reinvestment}
                  <InfoTip content={t.reinvestmentInfo} />
                </label>
                <div className="flex gap-2">
                  <label className="cursor-pointer flex-1">
                    <input type="radio" name="reinvest" className="sr-only peer" checked={reinvestmentExemption} onChange={() => setReinvestmentExemption(true)} />
                    <span className="block text-center text-xs py-1.5 rounded-lg border border-gray-300 peer-checked:bg-cyan-600 peer-checked:text-white peer-checked:border-cyan-600 select-none">
                      {t.reinvestmentYes}
                    </span>
                  </label>
                  <label className="cursor-pointer flex-1">
                    <input type="radio" name="reinvest" className="sr-only peer" checked={!reinvestmentExemption} onChange={() => setReinvestmentExemption(false)} />
                    <span className="block text-center text-xs py-1.5 rounded-lg border border-gray-300 peer-checked:bg-cyan-600 peer-checked:text-white peer-checked:border-cyan-600 select-none">
                      {t.reinvestmentNo}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ── Summary Cards ── */}
          {finalData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl shadow p-4 text-center">
                <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1 justify-center">
                  {t.summaryMonthly}
                  <InfoTip content={t.summaryMonthlyInfo} side="bottom" />
                </p>
                <p className="text-xl font-bold text-cyan-700">{formatEUR(monthlyMortgage, locale)}</p>
              </div>
              <div className="bg-white rounded-2xl shadow p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">{t.summaryTotalInterest}</p>
                <p className="text-xl font-bold text-gray-800">{formatEUR(finalData.totalInterestPaid, locale)}</p>
              </div>
              <div className="bg-white rounded-2xl shadow p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">{t.summaryHomeValue} ({termYears}{lang === 'es' ? 'a' : 'y'})</p>
                <p className="text-xl font-bold text-emerald-600">{formatEUR(finalData.homeValue, locale)}</p>
              </div>
              <div className="bg-white rounded-2xl shadow p-4 text-center">
                <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1 justify-center">
                  {t.summaryNetEquity} ({termYears}{lang === 'es' ? 'a' : 'y'})
                  <InfoTip content={t.summaryNetEquityInfo} side="bottom" />
                </p>
                <p className="text-xl font-bold text-cyan-700">{formatEUR(finalData.homeValue - finalData.remainingMortgage, locale)}</p>
              </div>
            </div>
          )}

          {/* ── Chart ── */}
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-lg">{t.chartTitle}</h2>
              <div className="text-sm text-gray-600">
                {t.breakEvenYear}: {breakEvenYear ? (
                  <span className="font-bold text-cyan-700">{lang === 'es' ? 'Año' : 'Year'} {breakEvenYear}</span>
                ) : (
                  <span className="text-amber-600 font-medium">{t.noBreakEven}</span>
                )}
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}
                  onClick={(e: any) => { if (e?.activeLabel) setExitYear(Number(e.activeLabel)); }}
                  style={{ cursor: 'pointer' }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} label={{ value: lang === 'es' ? 'Año' : 'Year', position: 'insideBottomRight', offset: -5, fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                    label={{ value: '€', position: 'insideTopLeft', offset: -5, fontSize: 12 }} />
                  <Tooltip content={(props: any) => <ChartTooltipContent {...props} locale={locale} t={t} />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="buy" name={t.chartBuyLine} fill="#0891b220" stroke="#0891b2" strokeWidth={2.5} dot={false} />
                  <Area type="monotone" dataKey="rent" name={t.chartRentLine} fill="#10b98120" stroke="#10b981" strokeWidth={2.5} dot={false} />
                  <ReferenceLine x={clampedExitYear} stroke="#475569" strokeDasharray="6 4" strokeWidth={2}
                    label={{ value: `${lang === 'es' ? 'Año' : 'Y'}${clampedExitYear}`, position: 'top', fontSize: 11, fill: '#475569' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">{t.exitYear}:</label>
              <input type="range" className="flex-1 accent-cyan-600" min={1} max={termYears} step={1} value={clampedExitYear}
                onChange={e => setExitYear(Number(e.target.value))} />
              <span className="text-lg font-bold text-cyan-700 w-10 text-center">{clampedExitYear}</span>
            </div>
          </div>

          {/* ── Exit Analysis ── */}
          {exitData && (
            <div className="space-y-4">
              <h2 className="font-semibold text-lg">{t.exitTitle} {clampedExitYear}</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Buy side */}
                <div className="bg-white rounded-2xl shadow p-4">
                  <h3 className="font-semibold text-cyan-700 mb-3">{t.buySection}</h3>
                  <div className="text-sm space-y-2">
                    <Row label={t.salePrice} value={formatEUR(exitData.salePrice, locale)} />
                    <Row label={t.sellingCostsLabel} value={`-${formatEUR(exitData.sellingCosts, locale)}`} dim />
                    <Row label={t.loanPayoff} value={`-${formatEUR(exitData.remainingMortgage, locale)}`} dim />
                    <Row label={t.capGainsTaxBuy}
                      value={reinvestmentExemption ? (lang === 'es' ? 'Exenta' : 'Exempt') : `-${formatEUR(exitData.capitalGainsTaxBuy, locale)}`}
                      dim={!reinvestmentExemption}
                      highlight={reinvestmentExemption ? 'green' : undefined} />
                    <hr className="border-gray-200" />
                    <Row label={t.grossProceeds} value={formatEUR(exitData.grossProceedsBuy, locale)} bold
                      highlight={exitData.grossProceedsBuy >= 0 ? 'green' : 'red'} />
                    <hr className="border-gray-200" />
                    <p className="text-xs text-gray-500 font-medium mt-1">{lang === 'es' ? 'Costes acumulados' : 'Cumulative costs'}</p>
                    <Row label={t.downPaymentOut} value={formatEUR(downPayment, locale)} dim small />
                    <Row label={t.purchaseTaxesPaid} value={formatEUR(purchaseTax + notaryCost, locale)} dim small />
                    <Row label={t.totalInterestPaid} value={formatEUR(exitData.totalInterestPaid, locale)} dim small />
                    <Row label={t.totalOwnership} value={formatEUR(exitData.totalOwnershipCosts, locale)} dim small />
                  </div>
                </div>

                {/* Rent side */}
                <div className="bg-white rounded-2xl shadow p-4">
                  <h3 className="font-semibold text-emerald-600 mb-3">{t.rentSection}</h3>
                  <div className="text-sm space-y-2">
                    <Row label={<span className="inline-flex items-center gap-1">{t.initialInvestment}<InfoTip content={t.initialInvestmentInfo} /></span>}
                      value={formatEUR(totalUpfront, locale)} />
                    <Row label={<span className="inline-flex items-center gap-1">{t.monthlySavings}<InfoTip content={t.monthlySavingsInfo} /></span>}
                      value={`${formatEUR(exitData.monthlyBuyCost - exitData.currentMonthlyRent, locale)}/m`}
                      highlight={(exitData.monthlyBuyCost - exitData.currentMonthlyRent) >= 0 ? 'green' : 'red'} />
                    <Row label={t.portfolioValue} value={formatEUR(exitData.portfolioValue, locale)} />
                    <Row label={t.totalRentPaid} value={formatEUR(exitData.totalRentPaid, locale)} dim />
                    <Row label={t.capGainsTaxRent} value={`-${formatEUR(exitData.capitalGainsTaxRent, locale)}`} dim />
                    <hr className="border-gray-200" />
                    <Row label={t.netPortfolio} value={formatEUR(exitData.netPortfolioAfterTax, locale)} bold
                      highlight={exitData.netPortfolioAfterTax >= 0 ? 'green' : 'red'} />
                    <hr className="border-gray-200" />
                    <p className="text-xs text-gray-500 font-medium mt-1">{t.monthlyBuyCostLabel} vs {t.monthlyRentLabel}</p>
                    <Row label={t.monthlyBuyCostLabel} value={formatEUR(exitData.monthlyBuyCost, locale)} dim small />
                    <Row label={t.monthlyRentLabel} value={formatEUR(exitData.currentMonthlyRent, locale)} dim small />
                  </div>
                </div>
              </div>

              {/* Head-to-head */}
              <div className={`rounded-2xl shadow px-6 pt-3 pb-5 text-center ${exitData.buyAdvantage >= 0 ? 'bg-cyan-50 border-2 border-cyan-300' : 'bg-emerald-50 border-2 border-emerald-300'}`}>
                <h3 className="comparison-dark-label font-semibold text-gray-700 mb-1">{t.comparison} &mdash; {t.atYear} {clampedExitYear}</h3>
                <p className={`text-2xl font-extrabold mb-3 ${exitData.buyAdvantage >= 0 ? 'text-cyan-700' : 'text-emerald-600'}`}>
                  {exitData.buyAdvantage >= 0 ? t.buyAdvantage : t.rentAdvantage}
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="comparison-dark-label text-xs text-gray-500">{t.grossProceeds}</p>
                    <p className="font-bold text-cyan-700">{formatEUR(exitData.grossProceedsBuy, locale)}</p>
                  </div>
                  <div>
                    <p className="comparison-dark-label text-xs text-gray-500 mb-1">{lang === 'es' ? 'Diferencia' : 'Difference'}</p>
                    <p className={`text-2xl font-extrabold ${exitData.buyAdvantage >= 0 ? 'text-cyan-700' : 'text-emerald-600'}`}>
                      {exitData.buyAdvantage >= 0 ? '+' : '-'}{formatEUR(Math.abs(exitData.buyAdvantage), locale)}
                    </p>
                  </div>
                  <div>
                    <p className="comparison-dark-label text-xs text-gray-500">{t.netPortfolio}</p>
                    <p className="font-bold text-emerald-600">{formatEUR(exitData.netPortfolioAfterTax, locale)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          <div className="text-xs text-gray-600 leading-relaxed">
            <p className="mb-1 font-medium">{t.notesTitle}</p>
            <ul className="list-disc ml-5 space-y-1">
              {(notesArr as readonly string[]).map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          </div>

          {/* ── Footer ── */}
          <div className="text-base md:text-lg text-gray-500 mt-6">
            &copy; David Gonzalez, si quieres saber más sobre mí, visita{' '}
            <a href="https://dragner.net" className="text-cyan-600 hover:underline" target="_blank" rel="noreferrer">dragner.net</a>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Small helper components ────────────────────────────────────

function Row({ label, value, bold, dim, small, highlight }: {
  label: React.ReactNode; value: string;
  bold?: boolean; dim?: boolean; small?: boolean;
  highlight?: 'green' | 'red';
}) {
  return (
    <div className={`flex justify-between items-center ${small ? 'text-xs' : ''} ${dim ? 'text-gray-500' : ''}`}>
      <span>{label}</span>
      <span className={[
        bold ? 'font-bold text-base' : 'font-medium',
        highlight === 'green' ? 'text-emerald-600' : highlight === 'red' ? 'text-red-500' : '',
      ].join(' ')}>
        {value}
      </span>
    </div>
  );
}
