import { htmlToPlainText } from "./html-utils.js";

const PERFORMANCE_TARGETS = [
  { key: "1D", variants: ["1 día", "1 dia"] },
  { key: "1W", variants: ["1 semana"] },
  { key: "1M", variants: ["1 mes"] },
  { key: "3M", variants: ["3 meses"] },
  { key: "6M", variants: ["6 meses"] },
  {
    key: "YTD",
    variants: ["YTD", "Año actual", "Ano actual", "Año en curso", "Ano en curso"],
  },
  { key: "1Y", variants: ["1 año", "1 ano"] },
  {
    key: "3Y Anual",
    variants: [
      "3 años (anualizado)",
      "3 anos (anualizado)",
      "3 años anualizado",
      "3 anos anualizado",
    ],
  },
  {
    key: "5Y Anual",
    variants: [
      "5 años (anualizado)",
      "5 anos (anualizado)",
      "5 años anualizado",
      "5 anos anualizado",
    ],
  },
  {
    key: "10Y Anual",
    variants: [
      "10 años (anualizado)",
      "10 anos (anualizado)",
      "10 años anualizado",
      "10 anos anualizado",
    ],
  },
];

const PERFORMANCE_DATE_REGEX =
  /Rentabilidades acumuladas (?:%|\(%\))\s*(\d{2}\/\d{2}\/\d{4})/i;
const PERFORMANCE_BLOCK_REGEX =
  /Rentabilidades acumuladas (?:%|\(%\))[\s\S]*?(?:Rentabilidad trimestral %?|Rentabilidades anuales %|Cartera|Operaciones|Comparar|©|$)/i;

const DEFAULT_DEBUG_ENABLED = process.env.DEBUG_PERFORMANCE === "1";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePerformanceText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function parseSpanishFloat(raw) {
  if (typeof raw !== "string") return null;
  const sanitized = raw.replace(/[−—–]/g, "-").replace(/[%\u00a0]/g, " ").trim();
  if (!sanitized || sanitized === "-") return null;
  const compact = sanitized.replace(/\s+/g, "");
  const normalized = compact.replace(/\./g, "").replace(/,/g, ".");
  const number = Number.parseFloat(normalized);
  return Number.isNaN(number) ? null : number;
}

export function parsePerformance(
  html,
  { enableDebugLogging = DEFAULT_DEBUG_ENABLED, logger = console.log } = {},
) {
  const logDebug = (message, details) => {
    if (!enableDebugLogging) return;
    logger(`[performance] ${message}`, details);
  };

  const debug = {
    blockFound: false,
    rawBlock: null,
    normalizedBlock: null,
    matches: [],
    missing: [],
    sampleText: null,
    reason: null,
    date: null,
    blockIndex: null,
    htmlSample: null,
  };
  const values = {};

  if (!html) {
    debug.reason = "empty_html";
    logDebug("Empty HTML received", debug);
    return { values, debug };
  }

  debug.htmlSample = html.slice(0, 500);

  const text = htmlToPlainText(html);
  if (!text) {
    debug.reason = "empty_text";
    logDebug("Unable to convert HTML to plain text", debug);
    return { values, debug };
  }

  const normalizedText = normalizePerformanceText(text);
  debug.sampleText = normalizedText.slice(0, 600);

  const dateMatch = normalizedText.match(PERFORMANCE_DATE_REGEX);
  if (dateMatch) {
    debug.date = dateMatch[1];
  }

  const blockMatch = normalizedText.match(PERFORMANCE_BLOCK_REGEX);
  const block = blockMatch ? blockMatch[0] : normalizedText;
  if (!blockMatch) {
    debug.reason = "block_not_found";
  } else {
    debug.blockFound = true;
    debug.blockIndex = blockMatch.index ?? null;
  }
  debug.rawBlock = block.slice(0, 2000);
  debug.normalizedBlock = block.replace(/[ \t]+/g, " ").trim().slice(0, 2000);

  for (const { key, variants } of PERFORMANCE_TARGETS) {
    let matchedValue = null;
    let usedVariant = null;

    for (const variant of variants) {
      const variantRegex = new RegExp(
        `${escapeRegExp(variant)}\s+([+−—–-]?[0-9]+(?:[.,][0-9]+)?)` +
          `(?:\s+[-+−—–0-9.,%]+)?(?:\s+[-+−—–0-9.,%]+)?`,
        "i",
      );
      const match = block.match(variantRegex);
      if (match) {
        matchedValue = match[1];
        usedVariant = variant;
        break;
      }
    }

    if (!matchedValue) {
      debug.missing.push({ key, variants });
      continue;
    }

    const number = parseSpanishFloat(matchedValue);
    debug.matches.push({ key, variant: usedVariant, raw: matchedValue, number });
    if (number === null) continue;
    values[key] = number;
  }

  if (!Object.keys(values).length) {
    debug.reason = debug.reason ?? "values_not_found";
    logDebug("No performance values extracted", debug);
    return { values, debug };
  }

  debug.reason = null;
  logDebug("Parsed performance metrics", {
    values,
    matches: debug.matches,
    missing: debug.missing,
    date: debug.date,
    blockIndex: debug.blockIndex,
  });

  return { values, debug };
}

export const performanceConstants = {
  PERFORMANCE_TARGETS,
  PERFORMANCE_DATE_REGEX,
  PERFORMANCE_BLOCK_REGEX,
};
