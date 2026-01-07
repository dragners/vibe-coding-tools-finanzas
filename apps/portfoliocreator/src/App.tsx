import React, { useMemo, useState } from "react";
import "./index.css";
import portfoliosData from "./data/Carteras.json";
import fundsData from "./data/Fondos.json";

type Lang = "es" | "en";

type RiskPreference = "high" | "moderate" | "low" | "safest";

type QuestionId =
  | "goal"
  | "age"
  | "horizon"
  | "initial"
  | "monthly"
  | "experience"
  | "return";

type Answers = {
  goal: string;
  age: string;
  horizon: string;
  initial: string;
  monthly: string;
  experience: string;
  return: RiskPreference | "";
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

const DISCLAIMER = {
  es: `**Disclaimer**: _La información compartida aquí se ofrece únicamente con fines informativos y no constituye una recomendación de inversión, ni una invitación, solicitud u obligación de realizar ninguna operación o transacción. El contenido es solo informativo y no debe servir como base para decisiones de inversión.\n\nEsta App está diseñada para carteras informativas destinadas a residentes fiscales en España y disponibles a través de entidades registradas en la CNMV.\n\nEste servicio no sustituye el asesoramiento financiero profesional. Se recomienda consultar con un asesor financiero autorizado antes de realizar cualquier inversión._`,
  en: `**Disclaimer**: _The information shared here is provided for informational purposes only and does not constitute an investment recommendation, nor an invitation, solicitation, or obligation to carry out any operation or transaction. The content is for informational purposes only and should not serve as the basis for any investment decisions.\n\nThis AI is designed for informational portfolios aimed at Spanish tax residents and available through entities registered with the CNMV.\n\nThis service does not replace professional financial advice. It is recommended to consult with a licensed financial advisor before making any investments._`,
  ca: `**Disclaimer**: _La informació compartida aquí s'ofereix únicament amb finalitats informatives i no constitueix una recomanació d'inversió, ni una invitació, sol·licitud o obligació de realitzar cap operació o transacció. El contingut és només informatiu i no ha de servir com a base per a decisions d'inversió.\n\nAquesta IA està dissenyada per a carteres informatives adreçades a residents fiscals a Espanya i disponibles a través d'entitats registrades a la CNMV.\n\nAquest servei no substitueix l'assessorament financer professional. Es recomana consultar amb un assessor financer autoritzat abans de fer qualsevol inversió._`,
};

const GOLD_INFO =
  "<strong>Gold</strong>: It is recommended to allocate around <strong>5%</strong> of the portfolio to gold. One way to invest in gold is through the ETF <strong>Xetra Gold</strong>, with ticker <strong>4GLD</strong>, ISIN <strong>DE000A0S9GB0</strong>, and a <strong>TER of 0%</strong>.";

const BITCOIN_INFO =
  "<strong>Bitcoin</strong>: It is generally recommended to allocate around <strong>2%</strong> to Bitcoin. You can invest by buying BTC directly through <a href=\"https://www.binance.com/activity/referral-entry/CPA?ref=CPA_00IKTM62Y7\" target=\"_blank\" rel=\"noreferrer\" class=\"text-cyan-600 underline\"><strong>Binance</strong></a>, or through the <strong>ETC Group Physical Bitcoin</strong> with ticker <strong>BTCE</strong>, ISIN <strong>DE000A27Z304</strong>, and a <strong>TER of 2% (High TER)</strong>.";

const TEXTS = {
  es: {
    back: "Volver a Herramientas",
    title: "Portfoliocreator",
    subtitle:
      "Crea una cartera personalizada con preguntas guiadas, explicaciones claras y resultados ordenados.",
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
    goal: "¿Cuál es tu objetivo financiero?",
    goalPlaceholder: "Selecciona tu objetivo",
    goalTip:
      "El tipo de inversión y riesgo se adapta dependiendo de tu objetivo financiero y tu plazo de inversión.",
    goalOptions: [
      "Jubilación",
      "Comprar vivienda",
      "Independencia financiera",
      "Ahorro",
      "Estudios",
      "Otro objetivo",
    ],
    age: "¿Cuántos años tienes?",
    ageTip:
      "Si tu objetivo es la jubilación, calcularemos automáticamente cuántos años faltan hasta los 67.",
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
    disclaimerTitle: "Aviso importante",
    riskTitle: "Tu perfil de riesgo",
    riskSummary: (riskValue: number, starValue: string) =>
      `Tu perfil de riesgo es ${riskValue} de 5: ${starValue}.`,
    riskPrompt:
      "¿Quieres confirmar este perfil, bajarlo o subirlo?",
    riskHint:
      "Bajar el riesgo aumenta la exposición a activos de baja volatilidad (bonos, monetario). Subirlo aumenta la exposición a activos con más volatilidad (renta variable).",
    confirm: "Confirmar",
    lower: "Bajar riesgo",
    raise: "Subir riesgo",
    summaryTitle: "Resumen de tus datos",
    summaryGoal: "Objetivo",
    summaryAge: "Edad",
    summaryHorizon: "Horizonte",
    summaryInitial: "Inversión inicial",
    summaryMonthly: "Aportación mensual",
    summaryExperience: "Experiencia previa",
    summaryReturn: "Rentabilidad buscada",
    summaryYearsTo67: "Años hasta los 67",
    totalContributed: "Capital total aportado",
    portfolioGuideTitle: "Cómo interpretar estas carteras",
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
    adjustPortfolio: "Modificar opciones",
    growthTitle: "Evolución estimada",
    contributedLine: "Capital aportado",
    happy: "¿Estás conforme con la cartera seleccionada?",
    addonsTitle: "Activos opcionales",
    addonsPromptLow:
      "Tu perfil de riesgo no permite activos adicionales.",
    addonsPrompt:
      "¿Quieres añadir alguno de estos activos a tu inversión?",
    gold: "Oro",
    realEstate: "Inmobiliario",
    bitcoin: "Bitcoin",
    addonsConfirm: "Confirmar extras",
    finalTitle: "Tu cartera final",
    implementationTitle: "Cómo implementarla",
    implementationSubtitle:
      "Calculamos cuánto invertir en cada tipo de activo, tanto en la aportación inicial como en las aportaciones mensuales. Te recomendamos configurar aportaciones automáticas para invertir de forma pasiva.",
    implementationNote:
      "Todos los fondos mostrados se pueden contratar en plataformas como MyInvestor, Renta 4, IronIA o SelfBank, donde puedes buscar los ISIN que te he proporcionado para invertir directamente en los productos recomendados.",
    monthlyLabel: "Aportación mensual",
    initialLabel: "Aportación inicial",
    fundsTitle: "Fondos recomendados",
    askHelp:
      "¿Necesitas alguna aclaración o quieres ajustar algo antes de finalizar?",
    farewell:
      "Por último, recuerda que es importante **rebalancear la cartera una vez al año** para mantenerla alineada con tus objetivos y perfil de riesgo. A medida que los mercados fluctúan, los porcentajes de activos de tu cartera pueden desviarse de la distribución original que elegiste. El rebalanceo te ayuda a restaurar esos porcentajes y a gestionar el riesgo.\n\nAdemás, el rebalanceo **no tiene implicaciones fiscales**, ya que la fiscalidad de los fondos en España permite traspasos sin tributar las ganancias hasta el momento del rescate.\n---\n\nSi te ha gustado, por favor danos 5 estrellas ★★★★★!\n\n**Si no tienes cuenta en MyInvestor, puedes crearla usando mi enlace de referido; así nos ayudas a crecer y te llevas 25€:**\n* https://myinvestor.page.link/5KGME27MEt19sMtJA \n* El código de referido es: RQU46",
    footer: "© David Gonzalez, si quieres saber más sobre mí, visita",
  },
  en: {
    back: "Back to Tools",
    title: "Portfoliocreator",
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
    goal: "What is your financial goal?",
    goalPlaceholder: "Select your goal",
    goalTip:
      "Select your main goal so we can tailor the recommendations.",
    goalOptions: [
      "Retirement",
      "Buying a home",
      "Financial independence",
      "Savings",
      "Education",
      "Other goal",
    ],
    age: "How old are you?",
    ageTip:
      "If your goal is retirement, we will calculate how many years remain until age 67.",
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
    disclaimerTitle: "Important disclaimer",
    riskTitle: "Your risk profile",
    riskSummary: (riskValue: number, starValue: string) =>
      `Your risk profile is ${riskValue} out of 5: ${starValue}.`,
    riskPrompt:
      "Do you want to confirm, lower, or raise this risk level?",
    riskHint:
      "Lowering risk increases exposure to low-volatility assets (bonds, money market). Raising it increases exposure to higher-volatility assets (equities).",
    confirm: "Confirm",
    lower: "Lower risk",
    raise: "Raise risk",
    summaryTitle: "Summary of your inputs",
    summaryGoal: "Goal",
    summaryAge: "Age",
    summaryHorizon: "Horizon",
    summaryInitial: "Initial investment",
    summaryMonthly: "Monthly contribution",
    summaryExperience: "Previous experience",
    summaryReturn: "Target return",
    summaryYearsTo67: "Years until 67",
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
    adjustPortfolio: "Modify options",
    growthTitle: "Projected growth",
    contributedLine: "Contributed capital",
    happy: "Are you happy with the selected portfolio?",
    addonsTitle: "Optional assets",
    addonsPromptLow:
      "Your risk profile does not allow additional assets.",
    addonsPrompt:
      "Would you like to add any of these assets to your investment?",
    gold: "Gold",
    realEstate: "Real estate",
    bitcoin: "Bitcoin",
    addonsConfirm: "Confirm add-ons",
    finalTitle: "Your final portfolio",
    implementationTitle: "How to implement it",
    implementationSubtitle:
      "We calculate how much to allocate to each asset type for both the initial and monthly contributions. We recommend setting up automatic contributions for a passive approach.",
    implementationNote:
      "All the funds shown can be contracted using platforms such as MyInvestor, Renta 4, IronIA, or SelfBank, where you can search for the ISINs I have provided to invest directly in the recommended products.",
    monthlyLabel: "Monthly contribution",
    initialLabel: "Initial contribution",
    fundsTitle: "Recommended funds",
    askHelp:
      "Do you need any clarification or want to adjust something before finishing?",
    farewell:
      "Lastly, remember that it is important **to rebalance the portfolio once a year** to keep it aligned with your goals and risk profile over time. As markets fluctuate, the percentages of assets in your portfolio may deviate from the original distribution you chose. Rebalancing helps you restore those percentages and manage risk.\n\nAdditionally, rebalancing **does not have tax implications**, as the taxation of funds in Spain allows for transfers without taxing the gains until the moment of withdrawal.\n---\n\nIf you liked it, please give us 5 stars ★★★★★!\n\n**If you don't have a MyInvestor account, you can create one using my referral link; this way, you help us grow and earn yourself €25:**\n* https://myinvestor.page.link/5KGME27MEt19sMtJA \n* Referral code is: RQU46",
    footer: "© David Gonzalez, want to know more about me? Visit",
  },
} as const;

const PORTFOLIOS = portfoliosData as Portfolio[];
const FUNDS = fundsData as Fund[];

const QUESTIONS: {
  id: QuestionId;
  type: "text" | "number" | "select" | "choice";
}[] = [
  { id: "goal", type: "text" },
  { id: "age", type: "number" },
  { id: "horizon", type: "number" },
  { id: "initial", type: "number" },
  { id: "monthly", type: "number" },
  { id: "experience", type: "choice" },
  { id: "return", type: "select" },
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

const parseNumber = (value: string) => {
  const normalized = value.replace(/,/g, ".");
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

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
  const age = parseNumber(answers.age);
  const horizon = parseNumber(answers.horizon);
  const initial = parseNumber(answers.initial);
  const monthly = parseNumber(answers.monthly);

  if (answers.return === "high") score += 3.5;
  if (answers.return === "moderate") score += 2.5;
  if (answers.return === "low") score += 1.5;
  if (answers.return === "safest") score += 0.5;

  if (horizon >= 15) score += 1.2;
  else if (horizon >= 8) score += 0.8;
  else if (horizon >= 4) score += 0.4;
  else score += 0.1;

  if (answers.experience === "yes") score += 0.5;

  if (age > 0 && age < 30) score += 0.6;
  else if (age < 45) score += 0.3;
  else if (age >= 60) score -= 0.4;

  if (initial + monthly * 12 > 100000) score += 0.3;

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

const getPortfolioOptions = (risk: number, horizonYears: number) => {
  const horizonLabel =
    horizonYears <= 3 ? "Short-term" : horizonYears <= 7 ? "Medium-term" : "Long-term";
  const candidates = PORTFOLIOS.filter(
    (portfolio) => portfolio.horizon === horizonLabel,
  );
  const sorted = [...candidates].sort(
    (a, b) => Math.abs(a.risk - risk) - Math.abs(b.risk - risk),
  );
  const options = sorted.slice(0, 3);
  if (options.length >= 3) return options;
  const fallback = [...PORTFOLIOS].sort(
    (a, b) => Math.abs(a.risk - risk) - Math.abs(b.risk - risk),
  );
  return fallback.slice(0, 3);
};

const getAssetSummary = (allocation: Portfolio["allocation"]) =>
  Object.entries(allocation)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      key: key as keyof Portfolio["allocation"],
      value,
    }));

const getSelectedFunds = (assetType: keyof Portfolio["allocation"]) =>
  FUNDS.filter((fund) => fund.assetType === assetType);

const stars = (risk: number) => "★★★★★".slice(0, risk) + "☆☆☆☆☆".slice(0, 5 - risk);

const renderMarkdown = (text: string) => {
  const withLineBreaks = text.replace(/\n/g, "<br />");
  const withBold = withLineBreaks.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const withItalic = withBold.replace(/_(.+?)_/g, "<em>$1</em>");
  return { __html: withItalic };
};

const isRetirementGoal = (goal: string) => {
  const normalized = goal.toLowerCase();
  return normalized.includes("jubil") || normalized.includes("retire");
};

const GrowthChart = ({
  series,
  contribution,
  labels,
  lang,
}: {
  series: { name: string; values: number[]; color: string }[];
  contribution: number[];
  labels: { title: string; contributionLabel: string };
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
              className="text-[10px] fill-slate-400"
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
              className="text-[10px] fill-slate-400"
            >
              {tick.yearLabel}
            </text>
          </g>
        ))}
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
  const [goalError, setGoalError] = useState(false);
  const [answers, setAnswers] = useState<Answers>({
    goal: "",
    age: "",
    horizon: "",
    initial: "",
    monthly: "",
    experience: "",
    return: "",
  });
  const [risk, setRisk] = useState(0);
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(
    null,
  );
  const [addons, setAddons] = useState({
    gold: false,
    realEstate: false,
    bitcoin: false,
  });

  const texts = TEXTS[lang];
  const optionLabel = (index: number) => `${texts.option} ${index + 1}`;
  const totalQuestions = QUESTIONS.length;

  const computedYearsTo67 = useMemo(() => {
    const age = parseNumber(answers.age);
    if (!age || age >= 67) return 0;
    return 67 - age;
  }, [answers.age]);

  const horizonYears = parseNumber(answers.horizon);
  const initial = parseNumber(answers.initial);
  const monthly = parseNumber(answers.monthly);
  const totalContributed = initial + monthly * horizonYears * 12;
  const options = useMemo(
    () => getPortfolioOptions(risk, horizonYears),
    [risk, horizonYears],
  );

  const riskExplanation = getRiskLabel(risk, lang);

  const handleAnswer = (key: keyof Answers, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (key === "goal") setGoalError(false);
  };

  const handleNext = () => {
    if (currentQuestion.id === "goal" && !answers.goal) {
      setGoalError(true);
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
    setRisk((prev) => clamp(prev + delta, 0, 5));
  };

  const confirmRisk = () => {
    setPhase("options");
  };

  const confirmPortfolio = () => {
    if (selectedPortfolio) setPhase("addons");
  };

  const confirmAddons = () => {
    setPhase("final");
  };

  const restartForm = () => {
    setPhase("form");
    setStep(0);
    setRisk(0);
    setSelectedPortfolio(null);
    setAddons({ gold: false, realEstate: false, bitcoin: false });
    setGoalError(false);
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

  const assetSummary = selectedPortfolio
    ? getAssetSummary(selectedPortfolio.allocation)
    : [];
  const selectedOptionIndex = selectedPortfolio
    ? options.findIndex((portfolio) => portfolio.name === selectedPortfolio.name)
    : -1;
  const selectedOptionLabel =
    selectedOptionIndex >= 0 ? optionLabel(selectedOptionIndex) : texts.option;

  const showAddons = risk >= 3;
  const showBitcoin = risk >= 4;

  const summaryItems = [
    { label: texts.summaryGoal, value: answers.goal },
    { label: texts.summaryAge, value: answers.age },
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
    ...(addons.gold ? [{ key: "gold", label: texts.gold, percent: 5 }] : []),
    ...(addons.realEstate
      ? [{ key: "realEstate", label: texts.realEstate, percent: 5 }]
      : []),
    ...(addons.bitcoin ? [{ key: "bitcoin", label: texts.bitcoin, percent: 2 }] : []),
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
              {currentQuestion.id === "goal" && (
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {texts.goal}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{texts.goalTip}</p>
                  <select
                    className="mt-6 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    value={answers.goal}
                    onChange={(e) => handleAnswer("goal", e.target.value)}
                  >
                    <option value="" disabled>
                      {texts.goalPlaceholder}
                    </option>
                    {texts.goalOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  {goalError && (
                    <p className="mt-2 text-sm text-rose-600">
                      {lang === "es"
                        ? "Selecciona una opción para continuar."
                        : "Please select an option to continue."}
                    </p>
                  )}
                </div>
              )}
              {currentQuestion.id === "age" && (
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {texts.age}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{texts.ageTip}</p>
                  <input
                    type="number"
                    className="mt-6 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                    value={answers.age}
                    onChange={(e) => handleAnswer("age", e.target.value)}
                  />
                </div>
              )}
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
                    value={answers.initial}
                    onChange={(e) => handleAnswer("initial", e.target.value)}
                  />
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
                    value={answers.monthly}
                    onChange={(e) => handleAnswer("monthly", e.target.value)}
                  />
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
            <h2 className="text-2xl font-semibold text-slate-900">{texts.riskTitle}</h2>
            <p className="mt-4 text-lg font-semibold text-cyan-700">
              {texts.riskSummary(risk, stars(risk))}
            </p>
            <p className="mt-2 text-sm text-slate-500">{riskExplanation}</p>
            <p className="mt-3 text-sm text-slate-600">{texts.riskPrompt}</p>
            <p className="mt-4 text-sm text-slate-600">{texts.riskHint}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                onClick={() => updateRisk(-1)}
              >
                {texts.lower}
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                onClick={() => updateRisk(1)}
              >
                {texts.raise}
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
              <h2 className="text-2xl font-semibold text-slate-900">{texts.summaryTitle}</h2>
              <div className="mt-6 grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase text-slate-400">{texts.summaryGoal}</p>
                  <p className="font-semibold text-slate-900">{answers.goal}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-400">{texts.summaryAge}</p>
                  <p className="font-semibold text-slate-900">{answers.age}</p>
                </div>
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
                {isRetirementGoal(answers.goal) && (
                  <div>
                    <p className="text-xs uppercase text-slate-400">{texts.summaryYearsTo67}</p>
                    <p className="font-semibold text-slate-900">
                      {computedYearsTo67}
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm">
                <p className="text-slate-500">{texts.totalContributed}</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatCurrency(totalContributed, lang)}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
              <h2 className="text-xl font-semibold text-slate-900">{texts.portfolioGuideTitle}</h2>
              <p className="mt-3 text-sm text-slate-600">{texts.portfolioGuideText}</p>
              <h3 className="mt-6 text-lg font-semibold text-slate-900">{texts.portfolioOptions}</h3>
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
                      <p className="text-xs uppercase text-slate-400">
                        {texts.option}
                      </p>
                      <h4 className="mt-1 text-lg font-semibold text-slate-900">
                        {optionLabel(index)}
                      </h4>
                      <p className="mt-3 text-xs text-slate-500">{texts.assets}</p>
                      <ul className="mt-2 space-y-1 text-sm text-slate-700">
                        {assets.map((asset) => (
                          <li key={asset.key}>
                            {ASSET_LABELS[lang][asset.key]}: {asset.value}%
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 text-sm text-slate-600">
                        <p>
                          {texts.risk}: {portfolio.risk} ({getRiskLabel(Math.round(portfolio.risk), lang)})
                        </p>
                        <p>
                          {texts.theoreticalReturn}: {formatPercent(portfolio.annualReturn)}
                        </p>
                        <p>
                          {texts.volatility}: {formatPercent(portfolio.volatility)}
                        </p>
                      </div>
                      <p className="mt-4 text-sm font-semibold text-slate-900">
                        {texts.estimatedValue}: {formatCurrency(totalValue, lang)}
                      </p>
                      <p className="mt-3 text-xs text-slate-500">
                        {portfolio.allocation.emergingMarkets > 0
                          ? lang === "es"
                            ? "Incluye mercados emergentes, con más potencial y volatilidad."
                            : "Includes emerging markets, which adds potential and volatility."
                          : lang === "es"
                          ? "Menor exposición a mercados emergentes, con volatilidad contenida."
                          : "Lower exposure to emerging markets, keeping volatility contained."}
                      </p>
                      <p className="text-xs text-slate-500">
                        {portfolio.allocation.globalSmallCaps > 0
                          ? lang === "es"
                            ? "Añade small caps globales para mayor crecimiento potencial."
                            : "Adds global small caps for higher growth potential."
                          : lang === "es"
                          ? "Sin small caps, prioriza estabilidad."
                          : "No small caps, prioritizes stability."}
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
                  onClick={() => setSelectedPortfolio(null)}
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
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={addons.gold}
                    onChange={(e) =>
                      setAddons((prev) => ({ ...prev, gold: e.target.checked }))
                    }
                  />
                  {texts.gold}
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={addons.realEstate}
                    onChange={(e) =>
                      setAddons((prev) => ({ ...prev, realEstate: e.target.checked }))
                    }
                  />
                  {texts.realEstate}
                </label>
                {showBitcoin && (
                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={addons.bitcoin}
                      onChange={(e) =>
                        setAddons((prev) => ({ ...prev, bitcoin: e.target.checked }))
                      }
                    />
                    {texts.bitcoin}
                  </label>
                )}
              </div>
            )}
            {showAddons && (addons.gold || addons.bitcoin || addons.realEstate) && (
              <div className="mt-6 space-y-4 text-sm text-slate-600">
                {addons.gold && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div
                      className="text-sm text-amber-900"
                      dangerouslySetInnerHTML={{ __html: GOLD_INFO }}
                    />
                  </div>
                )}
                {addons.bitcoin && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div
                      className="text-sm text-slate-900"
                      dangerouslySetInnerHTML={{ __html: BITCOIN_INFO }}
                    />
                  </div>
                )}
                {addons.realEstate && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="font-semibold text-emerald-900">Real Estate</p>
                    <p>
                      {lang === "es"
                        ? "Añadiremos un 5% de REITs (inmobiliario cotizado) para diversificar la cartera."
                        : "We will add a 5% allocation to REITs (listed real estate) to diversify the portfolio."}
                    </p>
                  </div>
                )}
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
              <h2 className="text-2xl font-semibold text-slate-900">{texts.finalTitle}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span>{selectedOptionLabel}</span>
                <span aria-hidden>·</span>
                <span className="text-lg font-semibold text-slate-800">
                  {texts.risk}:
                </span>
                <span className="text-lg font-semibold text-amber-500">
                  {stars(Math.round(selectedPortfolio.risk))}
                </span>
              </div>
              {addonAllocations.length > 0 && (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">
                    {lang === "es" ? "Extras seleccionados" : "Selected add-ons"}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {addonAllocations.map((addon) => {
                      const initialAddon = initial * (addon.percent / 100);
                      const monthlyAddon = monthly * (addon.percent / 100);
                      return (
                        <li key={addon.key}>
                          {addon.label}: {addon.percent}% · {texts.initialLabel}{" "}
                          {formatCurrency(initialAddon, lang)} · {texts.monthlyLabel}{" "}
                          {formatCurrency(monthlyAddon, lang)}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-2 text-xs text-slate-500">
                    {lang === "es"
                      ? "Estas asignaciones deben restarse proporcionalmente del resto de activos de la cartera."
                      : "These allocations should be deducted proportionally from the rest of the portfolio assets."}
                  </p>
                </div>
              )}
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {assetSummary.map((asset) => {
                  const allocation = asset.value / 100;
                  const initialAllocation = initial * allocation;
                  const monthlyAllocation = monthly * allocation;
                  const funds = getSelectedFunds(asset.key);
                  return (
                    <div
                      key={asset.key}
                      className="rounded-2xl border border-slate-200 p-4"
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {ASSET_LABELS[lang][asset.key]} ({asset.value}%)
                      </p>
                      <div className="mt-3 text-xs text-slate-500">
                        <p>
                          {texts.initialLabel}: {formatCurrency(initialAllocation, lang)}
                        </p>
                        <p>
                          {texts.monthlyLabel}: {formatCurrency(monthlyAllocation, lang)}
                        </p>
                      </div>
                      <p className="mt-4 text-xs font-semibold text-slate-400">
                        {texts.fundsTitle}
                      </p>
                      <div className="mt-2 rounded-xl border border-slate-100 p-3">
                        <ul className="space-y-2 text-sm text-slate-600">
                          {funds.map((fund) => (
                            <li key={fund.isin}>
                              <a
                                href={fund.url}
                                className="font-semibold text-slate-800 hover:underline"
                                target="_blank"
                                rel="noreferrer"
                              >
                                {fund.name}
                              </a>
                              <p className="text-xs text-slate-500">
                                ISIN: {fund.isin} · TER: {fund.ter}
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
              <p className="mt-2 text-sm text-slate-600">
                {texts.implementationSubtitle}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                {texts.implementationNote}
              </p>
              <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p>{texts.askHelp}</p>
              </div>
              <div className="mt-6 text-sm text-slate-700">
                <div dangerouslySetInnerHTML={renderMarkdown(texts.farewell)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
                onClick={restartForm}
              >
                {texts.editAnswers}
              </button>
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
