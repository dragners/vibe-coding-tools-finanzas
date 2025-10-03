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

const PERFORMANCE_KEYS = [
  "1D",
  "1W",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "3Y Anual",
  "5Y Anual",
  "10Y Anual",
];

const PERFORMANCE_TEXT_LABEL_MAP = new Map([
  ["1 dia", "1D"],
  ["1 semana", "1W"],
  ["1 mes", "1M"],
  ["3 meses", "3M"],
  ["6 meses", "6M"],
  ["ytd", "YTD"],
  ["ano actual", "YTD"],
  ["ano en curso", "YTD"],
  ["1 ano", "1Y"],
  ["1 ano (anualizado)", "1Y"],
  ["3 anos (anualizado)", "3Y Anual"],
  ["3 anos anualizado", "3Y Anual"],
  ["5 anos (anualizado)", "5Y Anual"],
  ["5 anos anualizado", "5Y Anual"],
  ["10 anos (anualizado)", "10Y Anual"],
  ["10 anos anualizado", "10Y Anual"],
]);

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

function resolvePerformanceKey(label) {
  if (!label) return null;
  const normalized = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.includes("1d") || normalized.includes("1dia")) return "1D";
  if (normalized.includes("1w") || normalized.includes("1s") || normalized.includes("1sem")) return "1W";
  if (normalized.includes("1m")) return "1M";
  if (normalized.includes("3m")) return "3M";
  if (normalized.includes("6m")) return "6M";
  if (
    normalized.includes("ytd") ||
    normalized.includes("anioactual") ||
    normalized.includes("aactual") ||
    normalized.includes("anoactual") ||
    normalized.includes("anoencurso")
  )
    return "YTD";
  if (normalized.includes("1a") || normalized.includes("1y") || normalized.includes("1ano")) {
    if (normalized.includes("anual")) return "1Y";
    if (normalized.includes("ano")) return "1Y";
  }
  if ((normalized.includes("3a") || normalized.includes("3y")) && normalized.includes("anual")) return "3Y Anual";
  if ((normalized.includes("5a") || normalized.includes("5y")) && normalized.includes("anual")) return "5Y Anual";
  if ((normalized.includes("10a") || normalized.includes("10y")) && normalized.includes("anual")) return "10Y Anual";
  return null;
}

function normalizeTextLabel(label) {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPerformanceTextRegex() {
  const variants = [
    ["1 día", "1D"],
    ["1 dia", "1D"],
    ["1 semana", "1W"],
    ["1 mes", "1M"],
    ["3 meses", "3M"],
    ["6 meses", "6M"],
    ["YTD", "YTD"],
    ["Año actual", "YTD"],
    ["Ano actual", "YTD"],
    ["Año en curso", "YTD"],
    ["Ano en curso", "YTD"],
    ["1 año", "1Y"],
    ["1 ano", "1Y"],
    ["1 año (anualizado)", "1Y"],
    ["1 ano (anualizado)", "1Y"],
    ["3 años (anualizado)", "3Y Anual"],
    ["3 anos (anualizado)", "3Y Anual"],
    ["3 años anualizado", "3Y Anual"],
    ["3 anos anualizado", "3Y Anual"],
    ["5 años (anualizado)", "5Y Anual"],
    ["5 anos (anualizado)", "5Y Anual"],
    ["5 años anualizado", "5Y Anual"],
    ["5 anos anualizado", "5Y Anual"],
    ["10 años (anualizado)", "10Y Anual"],
    ["10 anos (anualizado)", "10Y Anual"],
    ["10 años anualizado", "10Y Anual"],
    ["10 anos anualizado", "10Y Anual"],
  ];

  const patternParts = variants.map(([variant]) =>
    variant
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+")
      .replace(/í/g, "(?:í|i)")
      .replace(/ñ/g, "(?:ñ|n)"),
  );

  return {
    regex: new RegExp(`(${patternParts.join("|")})\\s*(-?\\d[\\d.,]*)%?`, "gi"),
    variants,
  };
}

const { regex: PERFORMANCE_TEXT_REGEX, variants: PERFORMANCE_TEXT_VARIANTS } =
  buildPerformanceTextRegex();

for (const [variant, key] of PERFORMANCE_TEXT_VARIANTS) {
  const normalized = normalizeTextLabel(variant);
  if (!PERFORMANCE_TEXT_LABEL_MAP.has(normalized)) {
    PERFORMANCE_TEXT_LABEL_MAP.set(normalized, key);
  }
}

function parsePerformanceFromTables(html) {
  const tables = extractTables(html);
  const result = {};

  for (const table of tables) {
    const rows = extractRows(table);
    if (!rows.length) continue;

    const headerCells = extractCells(rows[0]).map((cell) =>
      sanitizeValue(stripHtml(cell)),
    );

    if (!headerCells.some((label) => resolvePerformanceKey(label))) continue;

    for (let i = 1; i < rows.length; i++) {
      const cells = extractCells(rows[i]);
      if (!cells.length) continue;

      const rowLabel = sanitizeValue(stripHtml(cells[0] ?? ""));
      const normalized = rowLabel.toLowerCase();
      if (
        !normalized ||
        !(
          normalized.includes("rentabilidad") ||
          normalized.includes("rendimiento") ||
          normalized.includes("total return")
        )
      ) {
        continue;
      }

      for (let j = 1; j < cells.length && j < headerCells.length; j++) {
        const key = resolvePerformanceKey(headerCells[j]);
        if (!key) continue;
        const value = sanitizeValue(stripHtml(cells[j] ?? ""));
        if (value !== "-") {
          result[key] = value;
        }
      }
    }
  }

  return result;
}

function parsePerformanceFromText(html) {
  PERFORMANCE_TEXT_REGEX.lastIndex = 0;
  const text = htmlToPlainText(html);
  if (!text) return {};
  const match = text.match(
    /Rentabilidades acumuladas %([\s\S]*?)(?:Rentabilidad trimestral|Categoría:|Indice:|Índice:)/i,
  );
  if (!match) return {};
  const block = match[0];
  const result = {};

  let found;
  while ((found = PERFORMANCE_TEXT_REGEX.exec(block)) !== null) {
    const [, rawLabel, rawValue] = found;
    const key = PERFORMANCE_TEXT_LABEL_MAP.get(normalizeTextLabel(rawLabel));
    if (!key) continue;
    const sanitized = sanitizeValue(rawValue.replace(/\s+/g, "").replace(/,$/, ""));
    if (!sanitized || sanitized === "-" || !/[0-9]/.test(sanitized)) continue;
    result[key] = sanitized.replace(/%$/, "");
  }

  PERFORMANCE_TEXT_REGEX.lastIndex = 0;
  return result;
}

function parsePerformanceLegacy(html) {
  const tables = extractTables(html);
  const byPosition = tables[19];
  const result = {};

  if (byPosition) {
    const rows = extractRows(byPosition);
    for (let i = 1; i < rows.length && i <= PERFORMANCE_KEYS.length; i++) {
      const cells = extractCells(rows[i]);
      if (cells.length < 2) continue;
      const value = sanitizeValue(stripHtml(cells[1] ?? ""));
      if (value !== "-") {
        result[PERFORMANCE_KEYS[i - 1]] = value;
      }
    }
  }

  if (Object.keys(result).length >= 5) {
    return result;
  }

  const fallback = tables.find((tbl) => {
    const text = stripHtml(tbl);
    return PERFORMANCE_KEYS.every((key) => text.includes(key.split(" ")[0]));
  });
  if (!fallback) return result;

  const rows = extractRows(fallback);
  for (const row of rows) {
    const cells = extractCells(row);
    if (cells.length < 2) continue;
    const key = resolvePerformanceKey(stripHtml(cells[0]));
    if (!key) continue;
    const value = sanitizeValue(stripHtml(cells[1]));
    if (value) result[key] = value;
  }
  return result;
}

function parsePerformance(html) {
  const textParsed = parsePerformanceFromText(html);
  const tableParsed = parsePerformanceFromTables(html);
  const combined = { ...tableParsed, ...textParsed };
  if (Object.keys(combined).length) return combined;
  const legacyParsed = parsePerformanceLegacy(html);
  if (Object.keys(textParsed).length) {
    return { ...legacyParsed, ...textParsed };
  }
  return legacyParsed;
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

  return {
    name: entry.name,
    isin: entry.isin ?? "-",
    category: entry.category ?? "-",
    morningstarId: entry.morningstarId,
    comment: entry.comment ?? "-",
    url: urlPerf,
    performance: parsePerformance(perfHtml),
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
