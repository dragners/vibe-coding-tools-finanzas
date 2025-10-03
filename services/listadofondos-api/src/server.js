import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { mkdir, readFile, writeFile } from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "../../..");
const CONFIG_PATH = process.env.CONFIG_PATH
  ? path.resolve(process.env.CONFIG_PATH)
  : path.resolve(ROOT_DIR, "apps/listadofondos/config/fondos.yaml");
const CACHE_DIR = process.env.CACHE_DIR
  ? path.resolve(process.env.CACHE_DIR)
  : path.resolve(__dirname, "../cache");
const CACHE_FILE = path.join(CACHE_DIR, "data.json");

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

const DEBUG_PERFORMANCE = process.env.DEBUG_PERFORMANCE === "1";

const RATIO_PERIODS = ["1Y", "3Y", "5Y"];

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function sanitizeValue(value) {
  if (!value) return "-";
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned === "NaN" || /n\/a/i.test(cleaned)) return "-";
  return cleaned;
}

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&euro;/gi, "€")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function stripHtml(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, " "));
}

function htmlToPlainText(html) {
  if (!html) return "";
  const withBreaks = html
    .replace(/<(?:br|BR)\s*\/?>(\s*)/g, "\n$1")
    .replace(/<\/(?:p|div|li|tr|h[1-6])>/gi, "\n");
  const withoutTags = withBreaks.replace(/<[^>]+>/g, " ");
  return decodeHtml(withoutTags)
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function extractTables(html) {
  return html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
}

function extractRows(tableHtml) {
  return tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
}

function extractCells(rowHtml) {
  return rowHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? [];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSpanishNumber(value) {
  if (typeof value !== "string") return { number: null, normalized: null };
  const trimmed = value.replace(/%/g, "").replace(/\s+/g, "").trim();
  if (!trimmed) return { number: null, normalized: null };
  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");
  let normalized = trimmed;
  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasComma) {
    normalized = normalized.replace(/,/g, ".");
  }
  const number = Number.parseFloat(normalized);
  if (Number.isNaN(number)) {
    return { number: null, normalized: normalized || null };
  }
  return { number, normalized };
}

function logPerformanceDebug(message, details) {
  if (!DEBUG_PERFORMANCE) return;
  console.log(`[performance] ${message}`, details);
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

function parsePerformance(html) {
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
    logPerformanceDebug("Empty HTML received", debug);
    return { values, debug };
  }

  debug.htmlSample = html.slice(0, 500);

  const text = htmlToPlainText(html);
  if (!text) {
    debug.reason = "empty_text";
    logPerformanceDebug("Unable to convert HTML to plain text", debug);
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
    logPerformanceDebug("No performance values extracted", debug);
    return { values, debug };
  }

  debug.reason = null;
  logPerformanceDebug("Parsed performance metrics", {
    values,
    matches: debug.matches,
    missing: debug.missing,
    date: debug.date,
    blockIndex: debug.blockIndex,
  });

  return { values, debug };
}

function resolveRatioPeriod(label) {
  if (!label) return null;
  const normalized = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.includes("1a") || normalized.includes("1y")) return "1Y";
  if (normalized.includes("3a") || normalized.includes("3y")) return "3Y";
  if (normalized.includes("5a") || normalized.includes("5y")) return "5Y";
  return null;
}

function parseRatioFromTables(html, keywords) {
  const tables = extractTables(html);
  let found = {};

  for (const table of tables) {
    const rows = extractRows(table);
    if (!rows.length) continue;

    const headerCells = extractCells(rows[0]).map((cell) =>
      sanitizeValue(stripHtml(cell)),
    );
    const periods = headerCells.map((label) => resolveRatioPeriod(label));
    if (!periods.some(Boolean)) continue;

    for (let i = 1; i < rows.length; i++) {
      const cells = extractCells(rows[i]);
      if (!cells.length) continue;
      const label = sanitizeValue(stripHtml(cells[0] ?? ""));
      const normalized = label.toLowerCase();
      if (!keywords.some((keyword) => normalized.includes(keyword))) continue;

      const values = {};
      for (let j = 1; j < cells.length && j < periods.length; j++) {
        const key = periods[j];
        if (!key) continue;
        const value = sanitizeValue(stripHtml(cells[j] ?? ""));
        if (value !== "-") {
          values[key] = value;
        }
      }
      if (Object.keys(values).length) {
        found = values;
      }
    }
  }

  return found;
}

function parseRatioLegacy(html, keywords) {
  const tables = extractTables(html);
  for (const table of tables) {
    const rows = extractRows(table);
    for (const row of rows) {
      const text = stripHtml(row).toLowerCase();
      if (keywords.some((k) => text.includes(k))) {
        const cells = extractCells(row);
        const values = {};
        RATIO_PERIODS.forEach((period, idx) => {
          const cell = cells[idx + 1];
          values[period] = sanitizeValue(stripHtml(cell ?? ""));
        });
        return values;
      }
    }
  }
  return {};
}

function parseRatio(html, keywords) {
  const parsed = parseRatioFromTables(html, keywords);
  if (Object.keys(parsed).length) return parsed;
  return parseRatioLegacy(html, keywords);
}

function parseTerFromTables(html) {
  const tables = extractTables(html);
  let found = "-";

  for (const table of tables) {
    const rows = extractRows(table);
    for (const row of rows) {
      const cells = extractCells(row);
      if (!cells.length) continue;
      const label = sanitizeValue(stripHtml(cells[0] ?? "")).toLowerCase();
      if (
        label.includes("ter") ||
        label.includes("gastos corrientes") ||
        label.includes("ratio de gastos") ||
        label.includes("total expense")
      ) {
        const value = sanitizeValue(stripHtml(cells[cells.length - 1] ?? ""));
        if (value !== "-") {
          found = value;
        }
      }
    }
  }

  return found;
}

function parseTerLegacy(html) {
  const tables = extractTables(html);
  for (const table of tables) {
    const rows = extractRows(table);
    for (const row of rows) {
      const text = stripHtml(row).toLowerCase();
      if (text.includes("ter") || text.includes("gastos corrientes") || text.includes("ratio de gastos")) {
        const cells = extractCells(row);
        const last = cells[cells.length - 1];
        const value = sanitizeValue(stripHtml(last ?? ""));
        if (value !== "-") return value;
      }
    }
  }
  return "-";
}

function parseTer(html) {
  const parsed = parseTerFromTables(html);
  if (parsed && parsed !== "-") return parsed;
  return parseTerLegacy(html);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Request failed ${response.status}`);
  return await response.text();
}

function isSameDay(isoA, isoB) {
  if (!isoA || !isoB) return false;
  const a = new Date(isoA);
  const b = new Date(isoB);
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function stripQuotes(value) {
  if (value.startsWith('"') && value.endsWith('"')) return value.slice(1, -1);
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

function parseConfigYaml(text) {
  const data = { funds: [], plans: [] };
  let currentSection = null;
  let currentItem = null;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.match(/^ */)?.[0].length ?? 0;
    const trimmed = line.trim();
    if (indent === 0 && trimmed.endsWith(":")) {
      const key = trimmed.slice(0, -1);
      if (key === "funds" || key === "plans") {
        currentSection = key;
        continue;
      }
    }
    if (!currentSection) continue;
    if (trimmed.startsWith("- ")) {
      currentItem = {};
      const inline = trimmed.slice(2).trim();
      if (inline) {
        const [k, v] = inline.split(/:\s*/);
        if (k) currentItem[k] = stripQuotes(v ?? "");
      }
      data[currentSection].push(currentItem);
      continue;
    }
    const match = trimmed.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (match && currentItem) {
      const [, key, raw] = match;
      currentItem[key] = stripQuotes(raw ?? "");
    }
  }
  return data;
}

async function readConfig() {
  const text = await readFile(CONFIG_PATH, "utf8");
  return parseConfigYaml(text);
}

async function readCache() {
  try {
    const text = await readFile(CACHE_FILE, "utf8");
    return JSON.parse(text);
  } catch (err) {
    return null;
  }
}

async function writeCache(data) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function fetchFund(entry) {
  const base = "https://lt.morningstar.com/xgnfa0k0aw/snapshot/snapshot.aspx";
  const urlPerf = `${base}?tab=1&Id=${encodeURIComponent(entry.morningstarId)}`;
  const urlStats = `${base}?tab=2&Id=${encodeURIComponent(entry.morningstarId)}`;
  const urlFees = `${base}?tab=5&Id=${encodeURIComponent(entry.morningstarId)}&ClientFund=0&BaseCurrencyId=EUR&CurrencyId=EUR&LanguageId=es-ES`;

  const [perfHtml, statsHtml, feesHtml] = await Promise.all([
    fetchHtml(urlPerf),
    fetchHtml(urlStats),
    fetchHtml(urlFees),
  ]);

  const { values: performanceValues, debug: performanceDebug } = parsePerformance(perfHtml);

  return {
    name: entry.name,
    isin: entry.isin ?? "-",
    category: entry.category ?? "-",
    morningstarId: entry.morningstarId,
    comment: entry.comment ?? "-",
    url: urlPerf,
    performance: performanceValues,
    performanceDebug,
    sharpe: parseRatio(statsHtml, ["sharpe"]),
    volatility: parseRatio(statsHtml, ["volat", "desv"]),
    ter: parseTer(feesHtml),
  };
}

async function buildPayload() {
  const config = await readConfig();
  const load = async (items) => {
    const result = [];
    for (const entry of items) {
      try {
        result.push(await fetchFund(entry));
      } catch (err) {
        console.error(`Failed to fetch ${entry?.name} (${entry?.morningstarId}):`, err);
        result.push({
          name: entry.name,
          isin: entry.isin ?? "-",
          category: entry.category ?? "-",
          morningstarId: entry.morningstarId,
          comment: entry.comment ?? "-",
          url: `https://lt.morningstar.com/xgnfa0k0aw/snapshot/snapshot.aspx?tab=1&Id=${encodeURIComponent(entry.morningstarId)}`,
          performance: {},
          performanceDebug: { error: err?.message ?? "Failed to fetch fund" },
          sharpe: {},
          volatility: {},
          ter: "-",
        });
      }
    }
    return result;
  };

  const [funds, plans] = await Promise.all([
    load(config.funds ?? []),
    load(config.plans ?? []),
  ]);

  const payload = {
    lastUpdated: new Date().toISOString(),
    funds,
    plans,
  };

  await writeCache(payload);
  return payload;
}

async function getData() {
  const cache = await readCache();
  const today = new Date().toISOString();
  if (cache && isSameDay(cache.lastUpdated, today)) return cache;
  return await buildPayload();
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/listadofondos/api/data") {
      const data = await getData();
      sendJson(res, 200, data);
      return;
    }
    if (req.method === "POST" && req.url === "/listadofondos/api/refresh") {
      await new Promise((resolve) => {
        req.on("data", () => {});
        req.on("end", resolve);
      });
      const data = await buildPayload();
      sendJson(res, 200, data);
      return;
    }
    if (req.method === "GET" && req.url === "/listadofondos/api/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }
    sendJson(res, 404, { message: "Not found" });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { message: "Internal server error" });
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
  console.log(`listadofondos api listening on port ${port}`);
});
