import React, { useId, useMemo, useState } from "react";
import "./index.css";
import portfoliosData from "./data/Carteras.json";
import fundsData from "./data/Fondos.json";

type Lang = "es" | "en";

type RiskPreference = "high" | "moderate" | "low" | "safest";

type QuestionId =
  | "horizon"
  | "initial"
  | "monthly"
  | "experience"
  | "return"
  | "drawdown";

type Answers = {
  horizon: string;
  initial: string;
  monthly: string;
  experience: string;
  return: RiskPreference | "";
  drawdown: "buy" | "hold" | "sell" | "";
};

type Portfolio = {
  name: string;
  risk: number;
  horizon: "Short-term" | "Medium-term" | "Long-term";
  allocation: {
    moneyMarket: number;
    globalShortBonds: number;
    globalCorporateShortBonds: number;
    globalEquities: number;
    mediumTermBondsEUR: number;
    emergingMarkets: number;
    globalSmallCaps: number;
  };
  annualReturn: number;
  volatility: number;
};

type Fund = {
  assetType: keyof Portfolio["allocation"];
  name: string;
  isin: string;
  ter: string;
  url: string;
};

type AddonKey = "gold" | "realEstate" | "bitcoin";

type AddonState = Record<
  AddonKey,
  {
    enabled: boolean;
    percent: number;
  }
>;

type AddonProduct = {
  name: string;
  isin?: string;
  ter?: string;
  url: string;
  type: "fund" | "etc" | "exchange";
  description?: Record<Lang, string>;
};

const DISCLAIMER = {
  es: `**Disclaimer**: _La información compartida aquí se ofrece únicamente con fines informativos y no constituye una recomendación de inversión, ni una invitación, solicitud u obligación de realizar ninguna operación o transacción. El contenido es solo informativo y no debe servir como base para decisiones de inversión.\n\nEsta App está diseñada para carteras informativas destinadas a residentes fiscales en España y disponibles a través de entidades registradas en la CNMV.\n\nEste servicio no sustituye el asesoramiento financiero profesional. Se recomienda consultar con un asesor financiero autorizado antes de realizar cualquier inversión._`,
  en: `**Disclaimer**: _The information shared here is provided for informational purposes only and does not constitute an investment recommendation, nor an invitation, solicitation, or obligation to carry out any operation or transaction. The content is for informational purposes only and should not serve as the basis for any investment decisions.\n\nThis AI is designed for informational portfolios aimed at Spanish tax residents and available through entities registered with the CNMV.\n\nThis service does not replace professional financial advice. It is recommended to consult with a licensed financial advisor before making any investments._`,
  ca: `**Disclaimer**: _La informació compartida aquí s'ofereix únicament amb finalitats informatives i no constitueix una recomanació d'inversió, ni una invitació, sol·licitud o obligació de realitzar cap operació o transacció. El contingut és només informatiu i no ha de servir com a base per a decisions d'inversió.\n\nAquesta IA està dissenyada per a carteres informatives adreçades a residents fiscals a Espanya i disponibles a través d'entitats registrades a la CNMV.\n\nAquest servei no substitueix l'assessorament financer professional. Es recomana consultar amb un assessor financer autoritzat abans de fer qualsevol inversió._`,
};

const ADDON_RECOMMENDED: Record<AddonKey, number> = {
  gold: 5,
  realEstate: 5,
  bitcoin: 2,
};

const ADDON_LIMITS: Record<AddonKey, number> = {
  gold: 10,
  realEstate: 10,
  bitcoin: 5,
};

const createDefaultAddons = (): AddonState => ({
  gold: { enabled: false, percent: ADDON_RECOMMENDED.gold },
  realEstate: { enabled: false, percent: ADDON_RECOMMENDED.realEstate },
  bitcoin: { enabled: false, percent: ADDON_RECOMMENDED.bitcoin },
});

const TEXTS = {
  es: {
    back: "Volver a Herramientas",
    title: "Portfolio Creator",
    subtitle:
      "Crea una cartera indexada personalizada basada en tus preferencias con preguntas guiadas y explicaciones claras.",
    language: "Idioma",
    langES: "ES",
    langEN: "EN",
    start: "Ver resultados",
    next: "Continuar",
    previous: "Atrás",
    editAnswers: "Editar respuestas",
    restart: "Reiniciar formulario",
    progress: (current: number, total: number) =>
      `Pregunta ${current} de ${total}`,
    age: "¿Cuántos años tienes?",
    ageTip: "La edad ayuda a estimar tu capacidad para asumir volatilidad.",
    horizon: "¿Cuál es tu horizonte de inversión?",
    horizonTip:
      "Es el periodo durante el cual planeas mantener tus inversiones. Un horizonte largo suele permitir asumir más volatilidad.",
    horizonYears: "años",
    initial: "¿Cuánto quieres invertir inicialmente?",
    initialTip:
      "El capital inicial se invierte desde el primer día. Esto ayuda a acelerar el crecimiento compuesto.",
    monthly: "¿Cuánto quieres aportar cada mes?",
    monthlyTip:
      "Aportar de forma periódica (DCA) reduce el riesgo de entrar en un mal momento del mercado.",
    experience: "¿Has invertido antes en acciones, fondos, bonos o cripto?",
    experienceTip:
      "La experiencia previa suele ayudar a tolerar mejor la volatilidad.",
    yes: "Sí",
    no: "No",
    return: "¿Qué rentabilidad buscas?",
    returnTip:
      "La rentabilidad esperada está ligada al riesgo: más retorno potencial implica más volatilidad.",
    returnOptions: {
      high: "Alta, acepto más volatilidad",
      moderate: "Moderada",
      low: "Baja, con menos volatilidad",
      safest: "La más segura, no quiero volatilidad",
    },
    drawdown: "¿Qué harías si tus inversiones cayeran un 15%?",
    drawdownTip:
      "Tu reacción ante caídas es clave para medir la tolerancia al riesgo.",
    drawdownOptions: {
      buy: "Compraría más para aprovechar la bajada",
      hold: "Mantendría la inversión y esperaría",
      sell: "Vendería para evitar más pérdidas",
    },
    disclaimerTitle: "Aviso importante",
    riskTitle: "Tu perfil de riesgo",
    riskSummary: (riskValue: number) =>
      `Tu perfil de riesgo es ${riskValue} de 5.`,
    riskPrompt:
      "¿Quieres confirmar este perfil, bajarlo o subirlo?",
    riskHint:
      "Bajar el riesgo aumenta la exposición a activos de baja volatilidad (bonos, monetario). Subirlo aumenta la exposición a activos con más volatilidad (renta variable).",
    confirm: "Confirmar",
    lower: "Bajar riesgo",
    raise: "Subir riesgo",
    summaryTitle: "Resumen de tus datos",
    summaryAge: "Edad",
    summaryHorizon: "Horizonte",
    summaryInitial: "Inversión inicial",
    summaryMonthly: "Aportación mensual",
    summaryExperience: "Experiencia previa",
    summaryReturn: "Rentabilidad buscada",
    summaryDrawdown: "Reacción ante caídas",
    totalContributed: "Capital total aportado",
    portfolioGuideTitle: "Carteras personalizadas a tu riesgo",
    portfolioGuideText:
      "Aquí tienes opciones personalizadas con distintas combinaciones de activos. Cada una incluye su riesgo, rentabilidad teórica y valor estimado. Recuerda que el rendimiento pasado no garantiza resultados futuros.",
    portfolioOptions: "Opciones de cartera",
    option: "Opción",
    assets: "Composición de activos",
    risk: "Riesgo",
    theoreticalReturn: "Rentabilidad anual teórica",
    estimatedValue: "Valor estimado al final del horizonte",
    volatility: "Volatilidad estimada",
    confirmPortfolio: "Confirmar cartera",
    adjustPortfolio: "Atrás",
    growthTitle: "Evolución estimada",
    contributedLine: "Capital aportado",
    growthAxisYears: "Años",
    growthAxisValue: "€",
    happy: "¿Estás conforme con la cartera seleccionada?",
    addonsTitle: "Activos opcionales",
    addonsPromptLow:
      "Tu perfil de riesgo no permite activos adicionales.",
    addonsPrompt:
      "¿Quieres añadir alguno de estos activos a tu inversión?",
    gold: "Oro",
    realEstate: "Inmobiliario",
    bitcoin: "Bitcoin",
    addonsAllocationLabel: "Asignación",
    addonsRecommendedLabel: "Recomendado",
    addonsSelectedLabel: "Seleccionado",
    addonsConfirm: "Confirmar extras",
    finalTitle: "Tu cartera final",
    implementationTitle: "Cómo implementarla",
    implementationSubtitle:
      "Calculamos cuánto invertir en cada tipo de activo, tanto en la aportación inicial como en las aportaciones mensuales. Te recomendamos configurar **aportaciones automáticas** para invertir de forma pasiva.",
    implementationNote:
      "Los fondos mostrados se pueden contratar en plataformas como **MyInvestor**, **Renta 4**, **TradeRepublic**, **IronIA** o **SelfBank**, donde puedes **buscar los ISIN proporcionados** para invertir directamente en los productos recomendados.",
    monthlyLabel: "Aportación mensual",
    initialLabel: "Aportación inicial",
    fundsTitle: "Fondos recomendados",
    askHelp:
      "¿Necesitas alguna aclaración o quieres ajustar algo antes de finalizar?",
    farewell:
      "Por último, recuerda que es importante **rebalancear la cartera una vez al año** para mantenerla alineada con tus objetivos y perfil de riesgo. A medida que los mercados fluctúan, los porcentajes de activos de tu cartera pueden desviarse de la distribución original que elegiste. El rebalanceo te ayuda a restaurar esos porcentajes y a gestionar el riesgo.\n\nAdemás, el rebalanceo **no tiene implicaciones fiscales**, ya que la fiscalidad de los fondos en España permite traspasos sin tributar las ganancias hasta el momento del rescate.",
    referralTitle:
      "Si no tienes cuenta en MyInvestor, puedes crearla usando el enlace de referido; así nos ayudas a crecer y te llevas 25€:",
    referralLinkLabel: "Crear cuenta con MyInvestor",
    referralCode: "El código de referido es: RQU46",
    copyIsin: "Copiar ISIN",
    copied: "ISIN copiado",
    footer: "© David Gonzalez, si quieres saber más sobre mí, visita",
  },
  en: {
    back: "Back to Tools",
    title: "Portfolio Creator",
    subtitle:
      "Create a tailored portfolio with guided questions, clear explanations, and structured results.",
    language: "Language",
    langES: "ES",
    langEN: "EN",
    start: "See results",
    next: "Continue",
    previous: "Back",
    editAnswers: "Edit answers",
    restart: "Restart form",
    progress: (current: number, total: number) =>
      `Question ${current} of ${total}`,
    age: "How old are you?",
    ageTip: "Your age helps estimate your ability to take on volatility.",
    horizon: "What is your investment time horizon?",
    horizonTip:
      "This is the period you plan to hold your investments. A longer horizon often allows more volatility.",
    horizonYears: "years",
    initial: "How much do you want to invest initially?",
    initialTip:
      "The initial capital is invested from day one and accelerates compounding.",
    monthly: "How much do you want to invest monthly?",
    monthlyTip:
      "Regular contributions (DCA) reduce the risk of investing at a bad time.",
    experience: "Have you invested in stocks, funds, bonds or crypto before?",
    experienceTip:
      "Prior experience can improve comfort with market volatility.",
    yes: "Yes",
    no: "No",
    return: "What return are you looking for?",
    returnTip:
      "Expected return is linked to risk: higher potential return means more volatility.",
    returnOptions: {
      high: "High, I accept more volatility",
      moderate: "Moderate",
      low: "Low, with less volatility",
      safest: "Safest, I don't want volatility",
    },
    drawdown: "What would you do if your investments dropped 15%?",
    drawdownTip:
      "How you react to drawdowns is key to understanding risk tolerance.",
    drawdownOptions: {
      buy: "Buy more to take advantage of the drop",
      hold: "Hold and wait it out",
      sell: "Sell to avoid further losses",
    },
    disclaimerTitle: "Important disclaimer",
    riskTitle: "Your risk profile",
    riskSummary: (riskValue: number) =>
      `Your risk profile is ${riskValue} out of 5.`,
    riskPrompt:
      "Do you want to confirm, lower, or raise this risk level?",
    riskHint:
      "Lowering risk increases exposure to low-volatility assets (bonds, money market). Raising it increases exposure to higher-volatility assets (equities).",
    confirm: "Confirm",
    lower: "Lower risk",
    raise: "Raise risk",
    summaryTitle: "Summary of your inputs",
    summaryAge: "Age",
    summaryHorizon: "Horizon",
    summaryInitial: "Initial investment",
    summaryMonthly: "Monthly contribution",
    summaryExperience: "Previous experience",
    summaryReturn: "Target return",
    summaryDrawdown: "Drawdown reaction",
    totalContributed: "Total contributed capital",
    portfolioGuideTitle: "How to interpret these portfolios",
    portfolioGuideText:
      "Here are personalized options with different asset mixes. Each includes risk, theoretical annual return and estimated value. Remember that past performance does not guarantee future results.",
    portfolioOptions: "Portfolio options",
    option: "Option",
    assets: "Asset breakdown",
    risk: "Risk",
    theoreticalReturn: "Theoretical annual return",
    estimatedValue: "Estimated value at horizon",
    volatility: "Estimated volatility",
    confirmPortfolio: "Confirm portfolio",
    adjustPortfolio: "Back",
    growthTitle: "Projected growth",
    contributedLine: "Contributed capital",
    growthAxisYears: "Years",
    growthAxisValue: "€",
    happy: "Are you happy with the selected portfolio?",
    addonsTitle: "Optional assets",
    addonsPromptLow:
      "Your risk profile does not allow additional assets.",
    addonsPrompt:
      "Would you like to add any of these assets to your investment?",
    gold: "Gold",
    realEstate: "Real estate",
    bitcoin: "Bitcoin",
    addonsAllocationLabel: "Allocation",
    addonsRecommendedLabel: "Recommended",
    addonsSelectedLabel: "Selected",
    addonsConfirm: "Confirm add-ons",
    finalTitle: "Your final portfolio",
    implementationTitle: "How to implement it",
    implementationSubtitle:
      "We calculate how much to allocate to each asset type for both the initial and monthly contributions. We recommend setting up automatic contributions for a passive approach.",
    implementationNote:
      "All the funds shown can be contracted using platforms such as MyInvestor, Renta 4, TradeRepublic, IronIA, or SelfBank, where you can search for the provided ISINs to invest directly in the recommended products.",
    monthlyLabel: "Monthly contribution",
    initialLabel: "Initial contribution",
    fundsTitle: "Recommended funds",
    askHelp:
      "Do you need any clarification or want to adjust something before finishing?",
    farewell:
      "Lastly, remember that it is important **to rebalance the portfolio once a year** to keep it aligned with your goals and risk profile over time. As markets fluctuate, the percentages of assets in your portfolio may deviate from the original distribution you chose. Rebalancing helps you restore those percentages and manage risk.\n\nAdditionally, rebalancing **does not have tax implications**, as the taxation of funds in Spain allows for transfers without taxing the gains until the moment of withdrawal.",
    referralTitle:
      "If you don't have a MyInvestor account, you can create one using the referral link; this way, you help us grow and earn yourself €25:",
    referralLinkLabel: "Create a MyInvestor account",
    referralCode: "Referral code is: RQU46",
    copyIsin: "Copy ISIN",
    copied: "ISIN copied",
    footer: "© David Gonzalez, want to know more about me? Visit",
  },
} as const;

const parseNumber = (value: string | number | null | undefined) => {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const normalized = value.replace(/,/g, ".");
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseTerValue = (value: string) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const normalized = value.replace("%", "").replace(/,/g, ".").trim();
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const ASSET_TYPE_MAP: Record<string, keyof Portfolio["allocation"]> = {
  "money market": "moneyMarket",
  "money market funds": "moneyMarket",
  "global short-term bonds": "globalShortBonds",
  "global corporate short-term bonds": "globalCorporateShortBonds",
  "global equities": "globalEquities",
  "medium-term bonds eur": "mediumTermBondsEUR",
  "emerging markets": "emergingMarkets",
  "global small caps equities": "globalSmallCaps",
};

const mapAssetType = (value: string) => {
  const normalized = normalizeText(value);
  return ASSET_TYPE_MAP[normalized] ?? null;
};

const parsePortfolios = (data: unknown): Portfolio[] => {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      if ("Portfolio" in record) {
        return {
          name: String(record["Portfolio"] ?? ""),
          risk: parseNumber(record["Risk"]),
          horizon: String(record["Investment Horizon"] ?? "") as Portfolio["horizon"],
          allocation: {
            moneyMarket: parseNumber(record["Money Market (%)"]),
            globalShortBonds: parseNumber(record["Global Short-Term Bonds (%)"]),
            globalCorporateShortBonds: parseNumber(
              record["Global Corporate Short-Term Bonds (%)"],
            ),
            globalEquities: parseNumber(record["Global Equities (%)"]),
            mediumTermBondsEUR: parseNumber(record["Medium-Term Bonds EUR (%)"]),
            emergingMarkets: parseNumber(record["Emerging Markets (%)"]),
            globalSmallCaps: parseNumber(record["Global Small Caps Equities (%)"]),
          },
          annualReturn: parseNumber(record["Theoretical Annual Return (%)"]),
          volatility: parseNumber(record["Estimated Volatility (%)"]),
        };
      }
      if ("name" in record && "risk" in record && "allocation" in record) {
        return record as Portfolio;
      }
      return null;
    })
    .filter((portfolio): portfolio is Portfolio =>
      Boolean(portfolio && portfolio.name && portfolio.horizon),
    );
};

const parseFunds = (data: unknown): Fund[] => {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      if ("Asset Type" in record) {
        const assetType = mapAssetType(String(record["Asset Type"] ?? ""));
        if (!assetType) return null;
        return {
          assetType,
          name: String(record["Fund Name"] ?? ""),
          isin: String(record["ISIN"] ?? ""),
          ter: String(record["TER"] ?? ""),
          url: String(record["Link"] ?? ""),
        };
      }
      if ("assetType" in record && "name" in record) {
        return record as Fund;
      }
      return null;
    })
    .filter((fund): fund is Fund => Boolean(fund && fund.assetType && fund.name));
};

const PORTFOLIOS = parsePortfolios(portfoliosData);
const FUNDS = parseFunds(fundsData);

const parseReitFunds = (data: unknown): AddonProduct[] => {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      if (String(record["Asset Type"] ?? "") !== "REIT") return null;
      return {
        name: String(record["Fund Name"] ?? ""),
        isin: String(record["ISIN"] ?? ""),
        ter: String(record["TER"] ?? ""),
        url: String(record["Link"] ?? ""),
        type: "fund" as const,
      };
    })
    .filter((fund): fund is AddonProduct => Boolean(fund?.name));
};

const REIT_FUNDS = parseReitFunds(fundsData);
const BINANCE_REFERRAL_URL =
  "https://www.binance.com/activity/referral-entry/CPA?ref=CPA_00IKTM62Y7";

const ADDON_PRODUCTS: Record<AddonKey, AddonProduct[]> = {
  gold: [
    {
      name: "Xetra Gold",
      isin: "DE000A0S9GB0",
      ter: "0%",
      url: "https://www.xetra-gold.com/en/",
      type: "etc",
    },
  ],
  realEstate: REIT_FUNDS,
  bitcoin: [
    {
      name: "Binance",
      url: BINANCE_REFERRAL_URL,
      type: "exchange",
      description: {
        es: `Puedes comprar Bitcoin directamente en un exchange como <a href="${BINANCE_REFERRAL_URL}" target="_blank" rel="noreferrer" class="text-blue-600 hover:text-blue-700 underline">Binance</a> o mediante un ETF.`,
        en: `You can buy Bitcoin directly through an exchange like <a href="${BINANCE_REFERRAL_URL}" target="_blank" rel="noreferrer" class="text-blue-600 hover:text-blue-700 underline">Binance</a> or via an ETF.`,
      },
    },
    {
      name: "Bitwise Physical Bitcoin (BTCE)",
      isin: "DE000A27Z304",
      ter: "2%",
      url: "https://etc-group.com/products/etc-group-physical-bitcoin/",
      type: "etc",
    },
  ],
};

const QUESTIONS: {
  id: QuestionId;
  type: "text" | "number" | "select" | "choice";
}[] = [
  { id: "horizon", type: "number" },
  { id: "experience", type: "choice" },
  { id: "return", type: "select" },
  { id: "drawdown", type: "select" },
  { id: "initial", type: "number" },
  { id: "monthly", type: "number" },
];

const ASSET_LABELS: Record<Lang, Record<keyof Portfolio["allocation"], string>> =
  {
    es: {
      moneyMarket: "Mercado monetario",
      globalShortBonds: "Bonos globales corto plazo",
      globalCorporateShortBonds: "Bonos corporativos corto plazo",
      globalEquities: "Renta variable global",
      mediumTermBondsEUR: "Bonos EUR medio plazo",
      emergingMarkets: "Mercados emergentes",
      globalSmallCaps: "Small caps globales",
    },
    en: {
      moneyMarket: "Money Market",
      globalShortBonds: "Global Short-Term Bonds",
      globalCorporateShortBonds: "Global Corporate Short-Term Bonds",
      globalEquities: "Global Equities",
      mediumTermBondsEUR: "Medium-Term Bonds EUR",
      emergingMarkets: "Emerging Markets",
      globalSmallCaps: "Global Small Caps Equities",
    },
  };

const EXPLANATION_BY_RISK: Record<number, { es: string; en: string }> = {
  0: {
    es: "Riesgo mínimo, prioriza estabilidad y liquidez.",
    en: "Minimal risk, prioritizes stability and liquidity.",
  },
  1: {
    es: "Riesgo bajo, adecuado para preservar capital.",
    en: "Low risk, suitable for preserving capital.",
  },
  2: {
    es: "Riesgo moderado-bajo, combina prudencia y algo de crecimiento.",
    en: "Moderate-low risk, combines prudence and some growth.",
  },
  3: {
    es: "Riesgo medio, equilibra crecimiento y seguridad.",
    en: "Medium risk, balances growth and security.",
  },
  4: {
    es: "Riesgo medio-alto, busca crecimiento aceptando volatilidad.",
    en: "Medium-high risk, aims for growth with volatility.",
  },
  5: {
    es: "Riesgo alto, prioriza crecimiento a largo plazo.",
    en: "High risk, prioritizes long-term growth.",
  },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatCurrency = (value: number, lang: Lang) =>
  value.toLocaleString(lang === "es" ? "es-ES" : "en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const formatAxisCurrency = (value: number, lang: Lang) =>
  value.toLocaleString(lang === "es" ? "es-ES" : "en-US", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });

const formatPercent = (value: number) => `${value.toFixed(2)}%`;

const getDisclaimerLang = (lang: Lang) => {
  if (lang === "en") return "en";
  const browserLang = navigator?.language || "es";
  if (browserLang.startsWith("ca")) return "ca";
  return "es";
};

const computeRiskScore = (answers: Answers) => {
  let score = 0;
  const horizon = parseNumber(answers.horizon);
  const initial = parseNumber(answers.initial);
  const monthly = parseNumber(answers.monthly);

  if (answers.return === "high") score += 2.6;
  if (answers.return === "moderate") score += 1.1;
  if (answers.return === "low") score += 0.6;
  if (answers.return === "safest") score += 0.2;

  if (answers.drawdown === "buy") score += 2.2;
  if (answers.drawdown === "hold") score += 0.7;
  if (answers.drawdown === "sell") score -= 1.0;

  if (horizon >= 15) score += 0.6;
  else if (horizon >= 10) score += 0.4;
  else if (horizon >= 5) score += 0.2;
  else score += 0.05;

  if (answers.experience === "yes") score += 0.6;

  const annualized = initial + monthly * 12;
  if (annualized > 250000) score += 0.4;
  else if (annualized > 100000) score += 0.2;

  return clamp(Math.round(score), 0, 5);
};

const computePortfolioValue = (
  initial: number,
  monthly: number,
  years: number,
  annualReturn: number,
) => {
  const months = Math.max(0, Math.round(years * 12));
  const monthlyRate = annualReturn / 100 / 12;
  let value = initial;
  for (let i = 0; i < months; i += 1) {
    value = value * (1 + monthlyRate) + monthly;
  }
  return value;
};

const buildGrowthSeries = (
  initial: number,
  monthly: number,
  years: number,
  annualReturn: number,
) => {
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = annualReturn / 100 / 12;
  let value = initial;
  const series: number[] = [];
  for (let i = 0; i <= months; i += 1) {
    if (i > 0) value = value * (1 + monthlyRate) + monthly;
    series.push(value);
  }
  return series;
};

const buildContributionSeries = (
  initial: number,
  monthly: number,
  years: number,
) => {
  const months = Math.max(1, Math.round(years * 12));
  const series: number[] = [];
  let total = initial;
  for (let i = 0; i <= months; i += 1) {
    if (i > 0) total += monthly;
    series.push(total);
  }
  return series;
};

const getRiskLabel = (risk: number, lang: Lang) =>
  EXPLANATION_BY_RISK[risk]?.[lang] ?? "";

const getPortfolioOptions = (risk: number) => {
  const sorted = [...PORTFOLIOS].sort((a, b) => a.risk - b.risk);
  const below = [...sorted].reverse().find((portfolio) => portfolio.risk < risk);
  const above = sorted.find((portfolio) => portfolio.risk > risk);
  const same = sorted.reduce((closest, portfolio) => {
    if (!closest) return portfolio;
    const currentDiff = Math.abs(portfolio.risk - risk);
    const closestDiff = Math.abs(closest.risk - risk);
    if (currentDiff < closestDiff) return portfolio;
    return closest;
  }, null as Portfolio | null);

  const selections = [below, same, above].filter(
    (portfolio): portfolio is Portfolio => Boolean(portfolio),
  );
  const uniqueSelections = Array.from(
    new Map(selections.map((portfolio) => [portfolio.name, portfolio])).values(),
  );
  if (uniqueSelections.length >= 3) return uniqueSelections.slice(0, 3);

  const fallback = sorted.filter(
    (portfolio) => !uniqueSelections.some((item) => item.name === portfolio.name),
  );
  const closestFallback = fallback
    .map((portfolio) => ({
      portfolio,
      diff: Math.abs(portfolio.risk - risk),
    }))
    .sort((a, b) => a.diff - b.diff)
    .map((item) => item.portfolio);
  return [...uniqueSelections, ...closestFallback].slice(0, 3);
};

const getAssetSummary = (allocation: Portfolio["allocation"]) =>
  Object.entries(allocation)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      key: key as keyof Portfolio["allocation"],
      value,
    }));

const getSelectedFunds = (assetType: keyof Portfolio["allocation"]) =>
  FUNDS.filter((fund) => fund.assetType === assetType).sort(
    (a, b) => parseTerValue(a.ter) - parseTerValue(b.ter),
  );

const mapFundToProduct = (fund: Fund): AddonProduct => ({
  name: fund.name,
  isin: fund.isin,
  ter: fund.ter,
  url: fund.url,
  type: "fund",
});

const StarRating = ({ rating, className = "" }: { rating: number; className?: string }) => {
  const id = useId();
  const stars = Array.from({ length: 5 }, (_, index) => {
    const fillAmount = Math.max(0, Math.min(1, rating - index));
    const gradientId = `${id}-star-${index}`;
    return (
      <svg
        key={gradientId}
        viewBox="0 0 24 24"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset={`${fillAmount * 100}%`} stopColor="#F59E0B" />
            <stop offset={`${fillAmount * 100}%`} stopColor="#E2E8F0" />
          </linearGradient>
        </defs>
        <path
          d="M12 3.5l2.91 5.9 6.51.95-4.71 4.59 1.11 6.47L12 18.4l-5.82 3.01 1.11-6.47L2.58 10.35l6.51-.95L12 3.5z"
          fill={`url(#${gradientId})`}
          stroke="#F59E0B"
          strokeWidth="1"
        />
      </svg>
    );
  });

  return <span className={`inline-flex items-center gap-0.5 ${className}`}>{stars}</span>;
};

const renderMarkdown = (text: string) => {
  const withLineBreaks = text.replace(/\n/g, "<br />");
  const withBold = withLineBreaks.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const withItalic = withBold.replace(/_(.+?)_/g, "<em>$1</em>");
  return { __html: withItalic };
};

const GrowthChart = ({
  series,
  contribution,
  labels,
  lang,
}: {
  series: { name: string; values: number[]; color: string }[];
  contribution: number[];
  labels: { title: string; contributionLabel: string; axisYears: string; axisValue: string };
  lang: Lang;
}) => {
  const allValues = [...series.flatMap((item) => item.values), ...contribution];
  const maxValue = Math.max(...allValues, 1);
  const months = Math.max(contribution.length - 1, 1);
  const totalYears = Math.max(1, Math.round(months / 12));
  const width = 560;
  const height = 240;
  const padding = {
    top: 16,
    right: 16,
    bottom: 36,
    left: 58,
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xTickCount = Math.min(8, Math.max(5, totalYears + 1));
  const yTickCount = 6;
  const xTicks = Array.from({ length: xTickCount }, (_, index) => {
    const ratio = index / (xTickCount - 1);
    const monthIndex = Math.round(months * ratio);
    return {
      yearLabel: Math.round(monthIndex / 12),
      x: padding.left + ratio * chartWidth,
    };
  });
  const yTicks = Array.from({ length: yTickCount }, (_, index) => {
    const value = maxValue * (1 - index / (yTickCount - 1));
    return {
      value,
      y: padding.top + (index / (yTickCount - 1)) * chartHeight,
    };
  });
  const points = (values: number[]) =>
    values
      .map((value, index) => {
        const x =
          padding.left + (index / (values.length - 1)) * chartWidth;
        const y =
          height -
          padding.bottom -
          (value / maxValue) * chartHeight;
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-700 mb-3">{labels.title}</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={labels.title}
      >
        <rect
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight}
          fill="#F8FAFC"
          stroke="#E2E8F0"
        />
        {yTicks.map((tick) => (
          <g key={`y-${tick.value}`}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={tick.y}
              y2={tick.y}
              stroke="#E2E8F0"
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 8}
              y={tick.y + 3}
              textAnchor="end"
              className="text-[8px] fill-slate-400"
            >
              {formatAxisCurrency(tick.value, lang)}
            </text>
          </g>
        ))}
        {xTicks.map((tick, index) => (
          <g key={`x-${index}`}>
            <line
              x1={tick.x}
              x2={tick.x}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke="#E2E8F0"
              strokeDasharray="4 4"
            />
            <text
              x={tick.x}
              y={height - padding.bottom + 16}
              textAnchor="middle"
              className="text-[8px] fill-slate-400"
            >
              {tick.yearLabel}
            </text>
          </g>
        ))}
        <text
          x={padding.left - 24}
          y={padding.top - 4}
          textAnchor="start"
          className="text-[8px] fill-slate-400"
        >
          {labels.axisValue}
        </text>
        <text
          x={width - padding.right}
          y={height - 8}
          textAnchor="end"
          className="text-[8px] fill-slate-400"
        >
          {labels.axisYears}
        </text>
        <polyline
          points={points(contribution)}
          fill="none"
          stroke="#94A3B8"
          strokeWidth={2}
          strokeDasharray="4 4"
        />
        {series.map((item) => (
          <polyline
            key={item.name}
            points={points(item.values)}
            fill="none"
            stroke={item.color}
            strokeWidth={3}
          />
        ))}
      </svg>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-6 rounded-full bg-slate-400" />
          {labels.contributionLabel}
        </span>
        {series.map((item) => (
          <span key={item.name} className="inline-flex items-center gap-2">
            <span className="h-2 w-6 rounded-full" style={{ background: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [lang, setLang] = useState<Lang>("es");
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"form" | "risk" | "options" | "addons" | "final">(
    "form",
  );
  const [fieldErrors, setFieldErrors] = useState<Record<QuestionId, string>>({
    horizon: "",
    initial: "",
    monthly: "",
    experience: "",
    return: "",
    drawdown: "",
  });
  const [answers, setAnswers] = useState<Answers>({
    horizon: "",
    initial: "",
    monthly: "",
    experience: "",
    return: "",
    drawdown: "",
  });
  const [risk, setRisk] = useState(0);
  const [copiedIsin, setCopiedIsin] = useState<string | null>(null);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(
    null,
  );
  const [addons, setAddons] = useState<AddonState>(() => createDefaultAddons());

  const texts = TEXTS[lang];
  const optionLabel = (index: number) => `${texts.option} ${index + 1}`;
  const totalQuestions = QUESTIONS.length;

  const horizonYears = parseNumber(answers.horizon);
  const initial = parseNumber(answers.initial);
  const monthly = parseNumber(answers.monthly);
  const totalContributed = initial + monthly * horizonYears * 12;
  const options = useMemo(
    () => getPortfolioOptions(risk),
    [risk],
  );

  const riskExplanation = getRiskLabel(Math.round(risk), lang);

  const handleAnswer = (key: keyof Answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: "" }));
    }
  };

  const handleCopyIsin = (isin: string) => {
    if (!navigator?.clipboard) return;
    void navigator.clipboard.writeText(isin).then(() => {
      setCopiedIsin(isin);
      window.setTimeout(() => setCopiedIsin(null), 1500);
    });
  };

  const handleNext = () => {
    const value = answers[currentQuestion.id];
    const isNumber =
      currentQuestion.id === "horizon" ||
      currentQuestion.id === "initial" ||
      currentQuestion.id === "monthly";
    const isValid = isNumber ? parseNumber(value) > 0 : value !== "";
    if (!isValid) {
      setFieldErrors((prev) => ({
        ...prev,
        [currentQuestion.id]:
          lang === "es"
            ? "Completa este campo para continuar."
            : "Please complete this field to continue.",
      }));
      return;
    }
    if (step < totalQuestions - 1) {
      setStep((prev) => prev + 1);
      return;
    }
    const computed = computeRiskScore(answers);
    setRisk(computed);
    setPhase("risk");
  };

  const handlePrevious = () => {
    if (phase === "form" && step > 0) setStep((prev) => prev - 1);
  };

  const updateRisk = (delta: number) => {
    setRisk((prev) => clamp(Number((prev + delta).toFixed(1)), 0, 5));
  };

  const handleBackFromRisk = () => {
    setPhase("form");
    setStep(totalQuestions - 1);
  };

  const confirmRisk = () => {
    setPhase("options");
  };

  const confirmPortfolio = () => {
    if (!selectedPortfolio) return;
    if (!showAddons) {
      setAddons(createDefaultAddons());
      setPhase("final");
      return;
    }
    setPhase("addons");
  };

  const confirmAddons = () => {
    setPhase("final");
  };

  const restartForm = () => {
    setPhase("form");
    setStep(0);
    setRisk(0);
    setSelectedPortfolio(null);
    setAddons(createDefaultAddons());
    setFieldErrors({
      horizon: "",
      initial: "",
      monthly: "",
      experience: "",
      return: "",
      drawdown: "",
    });
  };

  const currentQuestion = QUESTIONS[step];

  const disclaimerLang = getDisclaimerLang(lang);
  const disclaimer = DISCLAIMER[disclaimerLang];

  const growthSeries = useMemo(() => {
    if (!selectedPortfolio) return [];
      return options.map((portfolio, index) => ({
        name: optionLabel(index),
        values: buildGrowthSeries(
          initial,
          monthly,
        horizonYears,
        portfolio.annualReturn,
      ),
      color: ["#38BDF8", "#6366F1", "#F97316"][index],
    }));
  }, [options, selectedPortfolio, initial, monthly, horizonYears, texts.option]);

  const contributionSeries = buildContributionSeries(
    initial,
    monthly,
    horizonYears,
  );

  const showAddons = risk >= 3;
  const showBitcoin = risk >= 4;

  const summaryItems = [
    {
      label: texts.summaryHorizon,
      value: answers.horizon ? `${answers.horizon} ${texts.horizonYears}` : "",
    },
    {
      label: texts.summaryInitial,
      value: answers.initial ? formatCurrency(initial, lang) : "",
    },
    {
      label: texts.summaryMonthly,
      value: answers.monthly ? formatCurrency(monthly, lang) : "",
    },
  ].filter((item) => item.value);

  const addonAllocations = [
    ...(addons.gold.enabled
      ? [{ key: "gold", label: texts.gold, percent: addons.gold.percent }]
      : []),
    ...(addons.realEstate.enabled
      ? [{ key: "realEstate", label: texts.realEstate, percent: addons.realEstate.percent }]
      : []),
    ...(addons.bitcoin.enabled
      ? [{ key: "bitcoin", label: texts.bitcoin, percent: addons.bitcoin.percent }]
      : []),
  ];
  const totalAddonPercent = addonAllocations.reduce(
    (total, addon) => total + addon.percent,
    0,
  );
  const coreAllocationScale = Math.max(0, (100 - totalAddonPercent) / 100);
  const adjustedAssetSummary = selectedPortfolio
    ? getAssetSummary(selectedPortfolio.allocation)
        .map((asset) => ({
          ...asset,
          value: Number((asset.value * coreAllocationScale).toFixed(2)),
        }))
        .filter((asset) => asset.value > 0)
    : [];
  const getFundsTitle = (key: AddonKey | keyof Portfolio["allocation"]) => {
    return lang === "es" ? "Opciones de inversión" : "Investment options";
  };

  const finalAssets = [
    ...adjustedAssetSummary.map((asset) => ({
      key: asset.key,
      label: ASSET_LABELS[lang][asset.key],
      percent: asset.value,
      products: getSelectedFunds(asset.key).map(mapFundToProduct),
    })),
    ...addonAllocations.map((addon) => ({
      key: addon.key,
      label: addon.label,
      percent: addon.percent,
      products: ADDON_PRODUCTS[addon.key],
    })),
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-16 pt-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <a
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:underline"
            >
              <span aria-hidden>←</span>
              {texts.back}
            </a>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">{texts.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{texts.subtitle}</p>
          </div>
          <div
            className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-sm"
            role="radiogroup"
            aria-label={texts.language}
          >
            <label className="cursor-pointer">
              <input
                type="radio"
                name="lang"
                className="sr-only peer"
                checked={lang === "es"}
                onChange={() => setLang("es")}
              />
              <span className="px-3 py-1.5 text-sm rounded-lg block select-none text-slate-600 peer-checked:bg-cyan-600 peer-checked:text-white">
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
              <span className="px-3 py-1.5 text-sm rounded-lg block select-none text-slate-600 peer-checked:bg-cyan-600 peer-checked:text-white">
                {texts.langEN}
              </span>
            </label>
          </div>
        </header>

        {phase === "form" && (
          <>
            <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {texts.progress(step + 1, totalQuestions)}
              </p>
              </div>

              <div className="mt-6 grid gap-6">
              {currentQuestion.id === "horizon" && (
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {texts.horizon}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{texts.horizonTip}</p>
                  <div className="mt-6 flex items-center gap-3">
                    <input
                      type="number"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                      value={answers.horizon}
                      onChange={(e) => handleAnswer("horizon", e.target.value)}
                    />
                    <span className="text-sm text-slate-500">{texts.horizonYears}</span>
                  </div>
                  {fieldErrors.horizon && (
                    <p className="mt-2 text-sm text-rose-600">{fieldErrors.horizon}</p>
                  )}
                </div>
              )}
              {currentQuestion.id === "initial" && (
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {texts.initial}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{texts.initialTip}</p>
                  <input
                    type="number"
                    className="mt-6 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    step={100}
                    value={answers.initial}
                    onChange={(e) => handleAnswer("initial", e.target.value)}
                  />
                  {fieldErrors.initial && (
                    <p className="mt-2 text-sm text-rose-600">{fieldErrors.initial}</p>
                  )}
                </div>
              )}
              {currentQuestion.id === "monthly" && (
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {texts.monthly}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{texts.monthlyTip}</p>
                  <input
                    type="number"
                    className="mt-6 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    step={10}
                    value={answers.monthly}
                    onChange={(e) => handleAnswer("monthly", e.target.value)}
                  />
                  {fieldErrors.monthly && (
                    <p className="mt-2 text-sm text-rose-600">{fieldErrors.monthly}</p>
                  )}
                </div>
              )}
              {currentQuestion.id === "experience" && (
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {texts.experience}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{texts.experienceTip}</p>
                  <div className="mt-6 flex gap-3">
                    {["yes", "no"].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                          answers.experience === value
                            ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-400"
                        }`}
                        onClick={() => handleAnswer("experience", value)}
                      >
                        {value === "yes" ? texts.yes : texts.no}
                      </button>
                    ))}
                  </div>
                  {fieldErrors.experience && (
                    <p className="mt-2 text-sm text-rose-600">{fieldErrors.experience}</p>
                  )}
                </div>
              )}
              {currentQuestion.id === "return" && (
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {texts.return}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{texts.returnTip}</p>
                  <div className="mt-6 grid gap-3">
                    {(Object.keys(texts.returnOptions) as RiskPreference[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                          answers.return === key
                            ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                            : "border-slate-200 text-slate-600 hover:border-slate-400"
                        }`}
                        onClick={() => handleAnswer("return", key)}
                      >
                        {texts.returnOptions[key]}
                      </button>
                    ))}
                  </div>
                  {fieldErrors.return && (
                    <p className="mt-2 text-sm text-rose-600">{fieldErrors.return}</p>
                  )}
                </div>
              )}
              {currentQuestion.id === "drawdown" && (
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {texts.drawdown}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{texts.drawdownTip}</p>
                  <div className="mt-6 grid gap-3">
                    {Object.entries(texts.drawdownOptions).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          className={`w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                            answers.drawdown === key
                              ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                              : "border-slate-200 text-slate-600 hover:border-slate-400"
                          }`}
                          onClick={() => handleAnswer("drawdown", key as Answers["drawdown"])}
                        >
                          {label}
                        </button>
                      ))}
                  </div>
                  {fieldErrors.drawdown && (
                    <p className="mt-2 text-sm text-rose-600">{fieldErrors.drawdown}</p>
                  )}
                </div>
              )}
            </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="text-sm text-slate-500">
                {summaryItems.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {summaryItems.map((item) => (
                      <span key={item.label}>
                        {item.label}: <strong>{item.value}</strong>
                      </span>
                    ))}
                  </div>
                )}
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  {step > 0 && (
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:border-slate-400"
                      onClick={handlePrevious}
                    >
                      {texts.previous}
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-500"
                    onClick={handleNext}
                  >
                    {step === totalQuestions - 1 ? texts.start : texts.next}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
              <h2 className="text-sm font-semibold text-amber-700">
                {texts.disclaimerTitle}
              </h2>
              <div className="mt-2 leading-relaxed" dangerouslySetInnerHTML={renderMarkdown(disclaimer)} />
            </section>
          </>
        )}

        {phase === "risk" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">{texts.riskTitle}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-lg font-semibold text-cyan-700">
                  <span>{texts.riskSummary(risk)}</span>
                  <StarRating rating={risk} />
                </div>
                <p className="mt-2 text-sm text-slate-500">{riskExplanation}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-b from-white to-slate-100 text-slate-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_12px_rgba(15,23,42,0.16)] transition hover:border-slate-300 hover:from-white hover:to-slate-50"
                  onClick={() => updateRisk(-0.5)}
                  aria-label={texts.lower}
                >
                  <svg aria-hidden="true" className="h-5 w-6" viewBox="0 0 24 24">
                    <rect x="4" y="11" width="16" height="2" rx="1" fill="none" stroke="currentColor" strokeWidth="2.2" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-200 bg-gradient-to-b from-white to-cyan-100 text-cyan-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_6px_12px_rgba(8,145,178,0.25)] transition hover:border-cyan-300 hover:from-white hover:to-cyan-50"
                  onClick={() => updateRisk(0.5)}
                  aria-label={texts.raise}
                >
                  <svg aria-hidden="true" className="h-5 w-6" viewBox="0 0 24 24">
                    <rect x="4" y="11" width="16" height="2" rx="1" fill="none" stroke="currentColor" strokeWidth="2.2" />
                    <rect x="11" y="4" width="2" height="16" rx="1" fill="none" stroke="currentColor" strokeWidth="2.2" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">{texts.riskPrompt}</p>
            <p className="mt-4 text-sm text-slate-600">{texts.riskHint}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                onClick={handleBackFromRisk}
              >
                {texts.previous}
              </button>
              <button
                type="button"
                className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white"
                onClick={confirmRisk}
              >
                {texts.confirm}
              </button>
            </div>
          </section>
        )}

        {phase === "options" && (
          <section className="grid gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
              <h2 className="text-xl font-semibold text-slate-900">{texts.summaryTitle}</h2>
              <div className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-400">{texts.summaryHorizon}</p>
                  <p className="font-semibold text-slate-900">
                    {answers.horizon} {texts.horizonYears}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">{texts.summaryInitial}</p>
                  <p className="font-semibold text-slate-900">
                    {formatCurrency(initial, lang)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">{texts.summaryMonthly}</p>
                  <p className="font-semibold text-slate-900">
                    {formatCurrency(monthly, lang)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">{texts.summaryExperience}</p>
                  <p className="font-semibold text-slate-900">
                    {answers.experience === "yes" ? texts.yes : texts.no}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">{texts.summaryReturn}</p>
                  <p className="font-semibold text-slate-900">
                    {answers.return ? texts.returnOptions[answers.return] : ""}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">
                    {texts.summaryDrawdown}
                  </p>
                  <p className="font-semibold text-slate-900">
                    {answers.drawdown ? texts.drawdownOptions[answers.drawdown] : ""}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="text-slate-500">{texts.totalContributed}</p>
                <p className="text-base font-semibold text-slate-900">
                  {formatCurrency(totalContributed, lang)}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
              <h2 className="text-xl font-semibold text-slate-900">{texts.portfolioGuideTitle}</h2>
              <p className="mt-3 text-sm text-slate-600">{texts.portfolioGuideText}</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {options.map((portfolio, index) => {
                  const totalValue = computePortfolioValue(
                    initial,
                    monthly,
                    horizonYears,
                    portfolio.annualReturn,
                  );
                  const assets = getAssetSummary(portfolio.allocation);
                  return (
                    <button
                      key={portfolio.name}
                      type="button"
                      className={`flex h-full flex-col rounded-3xl border p-5 text-left transition ${
                        selectedPortfolio?.name === portfolio.name
                          ? "border-cyan-500 bg-cyan-50"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                      onClick={() => setSelectedPortfolio(portfolio)}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-semibold text-slate-900">
                          {optionLabel(index)}
                        </h4>
                        <div className="text-xs font-semibold text-cyan-700">
                          {texts.risk}: {portfolio.risk}
                        </div>
                      </div>
                      <div className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        <div className="flex flex-wrap gap-2">
                          {assets.map((asset) => (
                            <span key={asset.key} className="text-slate-700">
                              {ASSET_LABELS[lang][asset.key]} · {asset.value}%
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-3 text-xs text-cyan-900">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{texts.estimatedValue}</span>
                          <span className="text-sm font-semibold text-cyan-900">
                            {formatCurrency(totalValue, lang)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span>{texts.theoreticalReturn}</span>
                          <span className="font-semibold text-slate-900">
                            {formatPercent(portfolio.annualReturn)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{texts.volatility}</span>
                          <span className="font-semibold text-slate-900">
                            {formatPercent(portfolio.volatility)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        {getRiskLabel(Math.round(portfolio.risk), lang)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedPortfolio && (
              <GrowthChart
                series={growthSeries}
                contribution={contributionSeries}
                labels={{
                  title: texts.growthTitle,
                  contributionLabel: texts.contributedLine,
                  axisYears: texts.growthAxisYears,
                  axisValue: texts.growthAxisValue,
                }}
                lang={lang}
              />
            )}

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
              <p className="text-sm text-slate-600">{texts.happy}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                  onClick={() => setPhase("risk")}
                >
                  {texts.adjustPortfolio}
                </button>
                <button
                  type="button"
                  className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white"
                  onClick={confirmPortfolio}
                  disabled={!selectedPortfolio}
                >
                  {texts.confirmPortfolio}
                </button>
              </div>
            </div>
          </section>
        )}

        {phase === "addons" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
            <h2 className="text-2xl font-semibold text-slate-900">{texts.addonsTitle}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {showAddons ? texts.addonsPrompt : texts.addonsPromptLow}
            </p>
            {showAddons && (
              <div className="mt-6 grid gap-4 lg:grid-cols-3">
                {([
                  {
                    key: "gold",
                    label: texts.gold,
                  },
                  {
                    key: "realEstate",
                    label: texts.realEstate,
                  },
                  ...(showBitcoin
                    ? [
                        {
                          key: "bitcoin",
                          label: texts.bitcoin,
                        },
                      ]
                    : []),
                ] as Array<{
                  key: AddonKey;
                  label: string;
                }>).map((addon) => {
                  const state = addons[addon.key];
                  const recommended = ADDON_RECOMMENDED[addon.key];
                  const max = ADDON_LIMITS[addon.key];
                  const badgeText = state.enabled
                    ? `${texts.addonsSelectedLabel} ${state.percent}%`
                    : `${texts.addonsRecommendedLabel} ${recommended}%`;

                  return (
                    <div
                      key={addon.key}
                      className={`rounded-2xl border p-4 shadow-sm transition ${
                        state.enabled
                          ? "border-cyan-200 bg-cyan-50/50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <label className="flex items-start justify-between gap-3">
                        <span className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 accent-cyan-600"
                            checked={state.enabled}
                            onChange={() =>
                              setAddons((prev) => ({
                                ...prev,
                                [addon.key]: {
                                  enabled: !prev[addon.key].enabled,
                                  percent: !prev[addon.key].enabled
                                    ? recommended
                                    : prev[addon.key].percent,
                                },
                              }))
                            }
                          />
                          <span>
                            <span className="block text-sm font-semibold text-slate-800">
                              {addon.label}
                            </span>
                            <span className="text-xs text-slate-500">
                              {texts.addonsAllocationLabel}: {state.percent}%
                            </span>
                          </span>
                        </span>
                        <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm">
                          {badgeText}
                        </span>
                      </label>

                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>{texts.addonsAllocationLabel}</span>
                          <span>
                            {texts.addonsRecommendedLabel}: {recommended}% · Max {max}%
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={max}
                            step={1}
                            value={state.percent}
                            style={{
                              background: `linear-gradient(to right, #0891b2 ${
                                (state.percent / max) * 100
                              }%, #e2e8f0 0%)`,
                            }}
                            onChange={(e) => {
                              const value = parseNumber(e.target.value);
                              setAddons((prev) => ({
                                ...prev,
                                [addon.key]: {
                                  ...prev[addon.key],
                                  percent: clamp(value, 0, max),
                                },
                              }));
                            }}
                            disabled={!state.enabled}
                            className="h-2 w-full cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-40 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow"
                          />
                          <span className="min-w-[2.5rem] text-right text-sm font-semibold text-slate-700">
                            {state.percent}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                onClick={() => setPhase("options")}
              >
                {texts.adjustPortfolio}
              </button>
              <button
                type="button"
                className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white"
                onClick={confirmAddons}
              >
                {texts.addonsConfirm}
              </button>
            </div>
          </section>
        )}

        {phase === "final" && selectedPortfolio && (
          <section className="grid gap-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-slate-900">{texts.finalTitle}</h2>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">
                      {texts.risk}: {selectedPortfolio.risk}
                    </span>
                    <StarRating rating={selectedPortfolio.risk} />
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-full bg-cyan-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-500"
                  onClick={restartForm}
                >
                  {texts.editAnswers}
                </button>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {finalAssets.map((asset) => {
                  const allocation = asset.percent / 100;
                  const initialAllocation = initial * allocation;
                  const monthlyAllocation = monthly * allocation;
                  return (
                    <div
                      key={asset.key}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <p className="text-base font-semibold text-slate-700">
                        {asset.label} ({formatPercent(asset.percent)})
                      </p>
                      <ul className="mt-3 space-y-1 text-sm text-slate-700 list-disc pl-4">
                        <li>
                          <span className="font-semibold text-slate-900">
                            {texts.initialLabel}:
                          </span>{" "}
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(initialAllocation, lang)}
                          </span>
                        </li>
                        <li>
                          <span className="font-semibold text-slate-900">
                            {texts.monthlyLabel}:
                          </span>{" "}
                          <span className="font-semibold text-slate-900">
                            {formatCurrency(monthlyAllocation, lang)}
                          </span>
                        </li>
                      </ul>
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {getFundsTitle(asset.key)}
                      </p>
                      <div className="mt-1 rounded-xl border border-slate-100 p-3">
                        <ul className="space-y-2 text-sm text-slate-600">
                          {asset.products.map((product) => (
                            <li key={`${asset.key}-${product.name}`}>
                              <a
                                href={product.url}
                                className="font-semibold text-blue-600 hover:text-blue-700 underline"
                                target="_blank"
                                rel="noreferrer"
                              >
                            {product.name}
                          </a>
                          {product.description?.[lang] && (
                            <p
                              className="mt-1 text-xs text-slate-500"
                              dangerouslySetInnerHTML={{ __html: product.description[lang] }}
                            />
                          )}
                          <p className="text-xs text-slate-500">
                            <span className="inline-flex items-center gap-2">
                              {product.isin && (
                                <>
                                  <span>ISIN: {product.isin}</span>
                                  <button
                                    type="button"
                                    className={`inline-flex items-center text-slate-600 hover:text-slate-800 ${
                                      copiedIsin === product.isin ? "text-cyan-700" : ""
                                    }`}
                                    onClick={() => handleCopyIsin(product.isin ?? "")}
                                    aria-label={
                                      copiedIsin === product.isin ? texts.copied : texts.copyIsin
                                    }
                                    title={copiedIsin === product.isin ? texts.copied : texts.copyIsin}
                                  >
                                    <svg
                                      viewBox="0 0 24 24"
                                      className="h-3.5 w-3.5"
                                      aria-hidden="true"
                                    >
                                      <path
                                        d="M9 8.5A2.5 2.5 0 0 1 11.5 6H18a2.5 2.5 0 0 1 2.5 2.5V18A2.5 2.5 0 0 1 18 20.5h-6.5A2.5 2.5 0 0 1 9 18V8.5Z"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                      />
                                      <path
                                        d="M6 3.5h6.5A2.5 2.5 0 0 1 15 6v1.5"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                      />
                                      <rect
                                        x="3.5"
                                        y="3.5"
                                        width="8"
                                        height="11"
                                        rx="2"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                      />
                                    </svg>
                                  </button>
                                </>
                              )}
                            </span>
                            {product.ter && (
                              <span className="ml-1">· TER: {product.ter}</span>
                            )}
                          </p>
                        </li>
                      ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
              <h3 className="text-xl font-semibold text-slate-900">
                {texts.implementationTitle}
              </h3>
              <div
                className="mt-2 text-sm text-slate-600"
                dangerouslySetInnerHTML={renderMarkdown(texts.implementationNote)}
              />
              <div
                className="mt-3 text-sm text-slate-600"
                dangerouslySetInnerHTML={renderMarkdown(texts.implementationSubtitle)}
              />
              <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm text-cyan-900">
                <p className="text-[15px] font-semibold text-cyan-900">
                  {texts.referralTitle}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  <li>
                    •{" "}
                    <a
                      href="https://newapp.myinvestor.es/do/signup?promotionalCode=RQU46"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-cyan-700 underline"
                    >
                      {texts.referralLinkLabel}
                    </a>
                  </li>
                  <li>• {texts.referralCode}</li>
                </ul>
              </div>
              <div className="mt-6 text-sm text-slate-700">
                <div dangerouslySetInnerHTML={renderMarkdown(texts.farewell)} />
              </div>
            </div>

          </section>
        )}

        <footer className="text-sm text-slate-500">
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
      </div>
    </div>
  );
}
