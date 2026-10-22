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

const RATIO_PERIODS = ["1Y", "3Y", "5Y"];

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
  const parsed = parsePerformanceNumber(value);
  return { number: parsed.number, normalized: parsed.normalized };
}

function formatAsPercentage(rawValue) {
  const sanitized = sanitizeValue(rawValue);
  if (!sanitized || sanitized === "-") return "-";

  const hasPercent = /%/.test(sanitized);
  const { number, normalized } = normalizeSpanishNumber(sanitized);
  if (number === null) {
    return "-";
  }

  if (hasPercent) {
    return sanitized.replace(/\s*%$/, "%");
  }

  const normalizedDigits = normalized?.replace(/[^0-9+-.]/g, "");
  if (normalizedDigits) {
    return `${normalizedDigits}%`;
  }

  return `${number}%`;
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

  let normalized = compact;
  if (compact.includes(",") && compact.includes(".")) {
    normalized = compact.lastIndexOf(",") > compact.lastIndexOf(".")
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(/,/g, "");
  } else if (compact.includes(",")) {
    normalized = compact.replace(",", ".");
  }
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return { number: null, normalized: null };
  const number = Number(normalized);
  if (!Number.isFinite(number)) return { number: null, normalized: null };
  return { number, normalized };
}

/** Extract ONLY "Rentabilidades acumuladas (%)" -> column "Rentabilidad" (2nd column) */
function parseAccumulatedRentOnly(html) {
  const values = {};
  const debug = {
    status: "error",
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
  let searchOffset = 0;
  outer: for (const table of tables) {
    const tableIndex = html.indexOf(table, searchOffset);
    const preceding = stripHtml(html.slice(searchOffset, tableIndex)).toLowerCase();
    searchOffset = tableIndex + table.length;
    const tableText = stripHtml(table).toLowerCase();
    // Require the accumulated-performance section; other tables may list the same periods.
    if (!tableText.includes("rentabilidades acumuladas") && !preceding.includes("rentabilidades acumuladas")) continue;
    if (!tableText.includes("rentabilidades acumuladas") && /rentabilidad(?:es)? (?:anuales|trimestral)/i.test(preceding.slice(preceding.lastIndexOf("rentabilidades acumuladas")))) continue;
    const rows = extractRows(table);
    if (!rows.length) continue;
    const parsedRows = rows.map((rowHtml) => {
      const cells = extractCells(rowHtml).map((c) => sanitizeValue(stripHtml(c)));
      return cells;
    });

    let startIndex = 0;
    let valueColumn = -1;
    for (let rowIndex = 0; rowIndex < parsedRows.length; rowIndex++) {
      const cells = parsedRows[rowIndex];
      const column = cells.findIndex((cell) => /^(?:rentabilidad|fondo)(?:\s*\(%\)|\s*%)?$/i.test(cell.trim()));
      if (column > 0) { valueColumn = column; startIndex = rowIndex + 1; break; }
    }
    // Refuse ambiguous columns instead of substituting the category or benchmark.
    if (valueColumn < 1) continue;
    const candidate = {};
    let hits = 0;
    let unpublished = 0;
    let malformed = false;

    for (let i = startIndex; i < parsedRows.length; i++) {
      const cells = parsedRows[i];
      if (!cells || cells.length < 2) continue;
      const label = (cells[0] || "").toLowerCase();

      const target = PERFORMANCE_TARGETS.find(({ variants }) =>
        variants.some((v) => label.includes(v.toLowerCase()))
      );
      if (!target) continue;

      const raw = cells[valueColumn];
      const { number, normalized } = parsePerformanceNumber(raw);
      if (number !== null) {
        candidate[target.key] = number;
        debug.matches.push({ key: target.key, label: cells[0], raw, normalized, number });
        hits++;
      } else if (isUnpublishedValue(raw)) {
        unpublished++;
      } else {
        malformed = true;
      }
    }

    if (hits > 0 || unpublished > 0) {
      debug.status = malformed ? "error" : hits > 0 ? "available" : "unavailable";
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
          values[p] = cells[idx];
        }
      });

      // Keep explicit placeholders so unpublished ratios can be distinguished from an unreadable page.
      foundValues = values;
      break;
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
  const out = { sharpe: {}, sortino: {}, volatility: {} };
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

  const lines = block
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const VALUE_TOKEN_RE = /^-?(?:\d+(?:[.,]\d+)?)(?:%?)$|^[-–—]+$|^n\/?a$/i;
  const periods = ["1Y", "3Y", "5Y"];

  const parseLine = (labelRe) => {
    const line = lines.find((candidate) => labelRe.test(candidate));
    if (!line) return null;

    const rest = line.replace(labelRe, "").trim();
    if (!rest) {
      return periods.reduce((acc, period) => {
        acc[period] = "-";
        return acc;
      }, {});
    }

    const tokens = rest.split(/\s+/);
    const values = [];
    for (const token of tokens) {
      const cleanedToken = token.replace(/[()%]/g, "");
      if (!VALUE_TOKEN_RE.test(cleanedToken)) continue;

      const normalizedToken = cleanedToken.replace(/%$/, "");
      values.push(sanitizeValue(normalizedToken));
      if (values.length === periods.length) break;
    }

    if (!values.length) {
      return periods.reduce((acc, period) => {
        acc[period] = "-";
        return acc;
      }, {});
    }

    while (values.length < periods.length) {
      values.push("-");
    }

    return periods.reduce((acc, period, idx) => {
      acc[period] = values[idx] ?? "-";
      return acc;
    }, {});
  };

  const volatility = parseLine(/^Volatilidad\b/i);
  if (volatility) out.volatility = volatility;

  const sharpe = parseLine(/^Ratio\s+de\s+Sharpe\b/i);
  if (sharpe) out.sharpe = sharpe;

  const sortino = parseLine(/^Ratio\s+de\s+Sortino\b/i);
  if (sortino) out.sortino = sortino;

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
  const byTable = parseRatioFromTables(html, keywords);
  if (Object.keys(byTable).length) return byTable;
  const byText = parseRatiosFromText(html);
  // Return exactly the requested metric from the text-extracted object
  const isSharpe = keywords.some((k) => /sharpe/i.test(k));
  if (isSharpe) return byText.sharpe || {};
  if (keywords.some((k) => /sortino/i.test(k))) return byText.sortino || {};
  if (keywords.some((k) => /volat/i.test(k))) return byText.volatility || {};
  return {};
}

function normalizeForMatching(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9% ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUnpublishedValue(value) {
  return typeof value === "string" && /^(?:[-−–—]\s*%?|n\/a)?$/i.test(value.trim());
}

function parseRatioResult(html, keywords) {
  const parsed = parseRatio(html, keywords);
  const values = {};
  let malformed = !Object.keys(parsed).length;
  for (const [period, raw] of Object.entries(parsed)) {
    if (parsePerformanceNumber(raw).number !== null) values[period] = raw;
    else if (!isUnpublishedValue(raw)) malformed = true;
  }
  return { values, status: malformed ? "error" : Object.keys(values).length ? "available" : "unavailable" };
}

function parseTerResult(html) {
  const candidates = [];
  for (const table of extractTables(html)) {
    for (const row of extractRows(table)) {
      const cells = extractCells(row);
      for (let index = 0; index < cells.length; index++) {
        const label = normalizeForMatching(stripHtml(cells[index]));
        // Management, entry and exit fees are not ongoing expenses.
        if (!/^(?:(?:kid )?gastos corrientes|ongoing charges|ter|total expense ratio|ratio de gastos(?: totales)?)(?: %)?$/.test(label)) continue;
        const raw = cells[index + 1] == null ? undefined : stripHtml(cells[index + 1]).trim();
        candidates.push({ raw, priority: label.startsWith("kid gastos corrientes") ? 0 : /gastos corrientes|ongoing charges/.test(label) ? 1 : 2 });
      }
    }
  }
  candidates.sort((a, b) => a.priority - b.priority);
  const candidate = candidates[0];
  if (!candidate) return { value: "-", status: "error" };
  const value = formatAsPercentage(candidate.raw ?? "");
  return { value, status: value !== "-" ? "available" : isUnpublishedValue(candidate.raw) ? "unavailable" : "error" };
}

function parseTer(html) {
  return parseTerResult(html).value;
}

// Read the product inception field, never a portfolio, NAV or performance date.
function parseInceptionYear(html) {
  if (!html) return null;
  const clean = html.replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi, "");
  const values = [];
  for (const table of extractTables(clean)) {
    for (const row of extractRows(table)) {
      const cells = extractCells(row).map((cell) => stripHtml(cell).replace(/\s+/g, " ").trim());
      const index = cells.findIndex((cell) => /^(?:fecha(?: de)? creaci[oó]n|inception date)\s*:?$/i.test(cell));
      if (index >= 0) values.push(cells[index + 1] ?? "");
    }
  }
  for (const value of values) {
    const date = value.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!date && !iso) continue;
    const [year, month, day] = date ? [Number(date[3]), Number(date[2]), Number(date[1])]
      : [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (year >= 1800 && parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) return year;
  }
  return null;
}

function parseMorningstarRating(html) {
  if (!html) return null;

  const ratingBlockMatch = html.match(
    /Rating\s+Morningstar[\s\S]{0,400}?<img[^>]*class\s*=\s*"[^"]*starsImg[^"]*"[^>]*>/i,
  );
  const targetHtml = ratingBlockMatch ? ratingBlockMatch[0] : html;

  const altMatch = targetHtml.match(
    /class\s*=\s*"[^"]*starsImg[^"]*"[^>]*alt\s*=\s*"([^"]+)"/i,
  );
  const altNumber = altMatch?.[1]?.match(/(\d+)/)?.[1];

  let rating = altNumber ? Number.parseInt(altNumber, 10) : null;

  if (!rating || Number.isNaN(rating)) {
    const srcMatch = targetHtml.match(
      /class\s*=\s*"[^"]*starsImg[^"]*"[^>]*src\s*=\s*"[^"']*?([0-9])stars\.[^"]*"/i,
    );
    const srcNumber = srcMatch?.[1];
    if (srcNumber) {
      rating = Number.parseInt(srcNumber, 10);
    }
  }

  if (rating === null || Number.isNaN(rating)) return null;
  if (!Number.isFinite(rating)) return null;

  return Math.max(0, Math.min(5, rating));
}

export { parsePerformanceNumber, parseAccumulatedRentOnly, parseRatio, parseRatioResult, parseTer, parseTerResult, parseMorningstarRating, parseInceptionYear };
