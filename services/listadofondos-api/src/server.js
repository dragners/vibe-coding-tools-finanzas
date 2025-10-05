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

  /Rentabilidades acumuladas %[\s\S]*?(?:Rentabilidad trimestral %?|Rentabilidades anuales %|Cartera|Operaciones|Comparar|©|$)/i;


const RATIO_PERIODS = ["1Y", "3Y", "5Y"];

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function sanitizeValue(value) {
  if (!value) return "-";
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned === "NaN" || /n\/a/i.test(cleaned)) return "-";
  return cleaned;
}

function normalizeDiacritics(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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



function normalizePerformanceText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function parsePerformanceNumber(raw) {
  if (typeof raw !== "string") {
    return { number: null, normalized: null };
  }

  const sanitized = raw
    .replace(/[%\u00a0]/g, "")
    .replace(/[−–—]/g, "-")
    .trim();
  const compact = sanitized.replace(/\s+/g, "");

  if (!compact || compact === "-") {
    return { number: null, normalized: null };
  }

  const normalized = compact.replace(/\./g, "").replace(/,/g, ".");
  const number = Number.parseFloat(normalized);
  if (Number.isNaN(number)) {
    return { number: null, normalized };
  }
  return { number, normalized };
}

/** Extract ONLY "Rentabilidades acumuladas (%)" -> column "Rentabilidad" (2nd column) */
function parseAccumulatedRentOnly(html) {
  const values = {};
  const debug = {
    mode: "table_only",
    tableHit: null,
    rowsParsed: 0,
    matches: [],
    missing: [],
  };

  if (!html) {
    debug.reason = "empty_html";
    return { values, debug };
  }

  const tables = extractTables(html);
  outer: for (const table of tables) {
    const rows = extractRows(table);
    if (!rows.length) continue;

    const parsedRows = rows.map((rowHtml) => {
      const cells = extractCells(rowHtml).map((c) => sanitizeValue(stripHtml(c)));
      return cells;
    });

    let startIndex = 0;
    if (parsedRows[0] && parsedRows[0].join(" ").toLowerCase().includes("rentabilidad")) {
      startIndex = 1;
    }

    const candidate = {};
    let hits = 0;

    for (let i = startIndex; i < parsedRows.length; i++) {
      const cells = parsedRows[i];
      if (!cells || cells.length < 2) continue;
      const label = (cells[0] || "").toLowerCase();

      const target = PERFORMANCE_TARGETS.find(({ variants }) =>
        variants.some((v) => label.includes(v.toLowerCase()))
      );
      if (!target) continue;

      const raw = cells[1];
      const { number, normalized } = parsePerformanceNumber(raw);
      if (number !== null) {
        candidate[target.key] = number;
        debug.matches.push({ key: target.key, label: cells[0], raw, normalized, number });
        hits++;
      }
    }

    if (hits >= 5) {
      debug.tableHit = table.slice(0, 200);
      debug.rowsParsed = parsedRows.length;

      for (const { key, variants } of PERFORMANCE_TARGETS) {
        if (!(key in candidate)) debug.missing.push({ key, variants });
      }

      Object.assign(values, candidate);
      break outer;
    }
  }

  if (!Object.keys(values).length) {
    for (const { key, variants } of PERFORMANCE_TARGETS) {
      debug.missing.push({ key, variants });
    }
  }

  return { values, debug };
}






function resolveRatioPeriod(label) {
  if (!label) return null;
  const norm = label
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9]/g, "");
  if (/(^|[^0-9])1(a|y|ano|anos)/.test(norm)) return "1Y";
  if (/(^|[^0-9])3(a|y|ano|anos)/.test(norm)) return "3Y";
  if (/(^|[^0-9])5(a|y|ano|anos)/.test(norm)) return "5Y";
  return null;
}



function parseRatioFromTables(html, keywords) {
  const tables = extractTables(html);

  const makePeriodMap = (headerCells) => {
    // Build a map period -> column index, skipping the first column (row label)
    const map = {};
    headerCells.forEach((label, idx) => {
      const period = resolveRatioPeriod(label);
      if (period && !(period in map)) {
        map[period] = idx; // keep actual index (may not be 1..N)
      }
    });
    return map;
  };

  // Iterate tables to find one that has period columns and matching rows
  for (const table of tables) {
    const rows = extractRows(table);
    if (!rows.length) continue;

    // Header: take first row cells as header candidates
    const headerCells = extractCells(rows[0]).map((cell) => sanitizeValue(stripHtml(cell)));
    const periodIdxMap = makePeriodMap(headerCells);

    // Require at least one of the target periods present
    const periodsPresent = Object.keys(periodIdxMap);
    if (!periodsPresent.length) continue;

    // Try to collect both sharpe/volat (or the requested keywords row)
    let foundValues = null;

    // Iterate data rows (skip header)
    for (let r = 1; r < rows.length; r++) {
      const cells = extractCells(rows[r]).map((c) => sanitizeValue(stripHtml(c)));
      if (!cells.length) continue;

      const rowLabel = (cells[0] || "").toLowerCase();
      if (!rowLabel) continue;

      // Check row label has one of the keywords
      if (!keywords.some((k) => rowLabel.includes(k))) continue;

      // Build values object using the detected column indices
      const values = {};
      (["1Y","3Y","5Y"]).forEach((p) => {
        if (periodIdxMap[p] != null) {
          const idx = periodIdxMap[p];
          const val = cells[idx] ?? "";
          values[p] = sanitizeValue(val);
        }
      });

      // If at least one non "-" value, accept and return
      if (Object.values(values).some((v) => v && v !== "-")) {
        foundValues = values;
        break;
      }
    }

    if (foundValues) return foundValues;
  }

  return {};
}

/**
 * Deterministic extractor for "Análisis de Rentabilidad/Riesgo" (tab=2) from plain text.
 * Looks for the block that starts at "Análisis de Rentabilidad/Riesgo" and then
 * parses lines like:
 *  "Medida de riesgo 1 año 3 años 5 años"
 *  "Volatilidad 12,64 13,82 17,72"
 *  "Ratio de Sharpe 0,43 0,52 1,25"
 */
function parseRatiosFromText(html) {
  const text = htmlToPlainText(html);
  const out = { sharpe: {}, volatility: {} };
  if (!text) return out;

  // Normalize spaces and accents to ease matching
  const norm = text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
  
  // Find a local block around "Análisis de Rentabilidad/Riesgo" to increase precision
  const blockMatch = norm.match(/An[aá]lisis de Rentabilidad\/?Riesgo[\s\S]{0,800}/i);
  const block = blockMatch ? blockMatch[0] : norm;

  // Patterns for the two rows. Accept comma decimals and optional units.
  const volRe = /Volatilidad\s+(-?\d+[.,]\d+)\s+(-?\d+[.,]\d+)\s+(-?\d+[.,]\d+)/i;
  const sharpeRe = /Ratio\s+de\s+Sharpe\s+(-?\d+[.,]\d+)\s+(-?\d+[.,]\d+)\s+(-?\d+[.,]\d+)/i;

  const vm = block.match(volRe);
  if (vm) {
    out.volatility = { "1Y": vm[1], "3Y": vm[2], "5Y": vm[3] };
  }
  const sm = block.match(sharpeRe);
  if (sm) {
    out.sharpe = { "1Y": sm[1], "3Y": sm[2], "5Y": sm[3] };
  }
  return out;
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
  const byText = parseRatiosFromText(html);
  // Return exactly the requested metric from the text-extracted object
  const isSharpe = keywords.some((k) => /sharpe/i.test(k));
  if (isSharpe) return byText.sharpe || {};
  // Otherwise treat as volatility
  return byText.volatility || {};
}



function parseTerFromTables(html) {
  const tables = extractTables(html);
  let found = "-";

  for (const table of tables) {
    const rows = extractRows(table);
    for (const row of rows) {
      const cells = extractCells(row);
      if (!cells.length) continue;
      const labelRaw = sanitizeValue(stripHtml(cells[0] ?? ""));
      const label = labelRaw.toLowerCase();
      const normalized = normalizeDiacritics(labelRaw);
      if (
        label.includes("ter") ||
        label.includes("gastos corrientes") ||
        label.includes("ratio de gastos") ||
        label.includes("total expense") ||
        label.includes("comisión de gestión") ||
        label.includes("comision de gestion") ||
        normalized.includes("comision de gestion")
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
      const raw = stripHtml(row);
      const text = raw.toLowerCase();
      const normalized = normalizeDiacritics(raw);
      if (
        text.includes("ter") ||
        text.includes("gastos corrientes") ||
        text.includes("ratio de gastos") ||
        text.includes("comisión de gestión") ||
        text.includes("comision de gestion") ||
        normalized.includes("comision de gestion")
      ) {
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

function parseMorningstarRating(html) {
  if (!html) return null;

  const byAlt = html.match(/<img[^>]*class="[^"]*starsImg[^"]*"[^>]*alt="([0-9])\s*star/iu);
  if (byAlt) {
    const value = Number.parseInt(byAlt[1], 10);
    if (Number.isInteger(value)) return value;
  }

  const bySrc = html.match(/<img[^>]*class="[^"]*starsImg[^"]*"[^>]*src="[^"]*\/(\d)stars\.[^"]*"/i);
  if (bySrc) {
    const value = Number.parseInt(bySrc[1], 10);
    if (Number.isInteger(value)) return value;
  }

  return null;
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

  let { values: performanceValues, debug: performanceDebug } = parseAccumulatedRentOnly(perfHtml);

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
    volatility: parseRatio(statsHtml, ["volat", "volatil", "volat.", "desv", "desviacion"]),
    ter: parseTer(feesHtml),
    morningstarRating: parseMorningstarRating(perfHtml),
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
          morningstarRating: null,
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
