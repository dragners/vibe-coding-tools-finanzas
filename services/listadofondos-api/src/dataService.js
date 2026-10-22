import path from "node:path";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { parseConfigYaml } from "./config.js";
import { parseAccumulatedRentOnly, parseRatioResult, parseTerResult, parseMorningstarRating, parseInceptionYear } from "./parsers.js";

const validValue = (value) => value != null && value !== "" && value !== "-";
const identity = (entry) => entry.isin || entry.morningstarId || entry.name;

export function createDataService({ configPath, cacheFile, fetchHtml, now = () => new Date(), concurrency = 4 }) {
  let refreshPromise = null;
  let refreshFailedAt = null;

  async function readCache() {
    try {
      const data = JSON.parse(await readFile(cacheFile, "utf8"));
      if (!Array.isArray(data.funds) || !Array.isArray(data.plans) || !Number.isFinite(Date.parse(data.lastUpdated))) return null;
      return data;
    } catch { return null; }
  }

  async function loadProduct(entry, previous, updatedAt) {
    const base = "https://lt.morningstar.com/xgnfa0k0aw/snapshot/snapshot.aspx";
    const query = `Id=${encodeURIComponent(entry.morningstarId)}&CurrencyId=EUR&LanguageId=es-ES`;
    const urls = [`${base}?tab=1&${query}`, `${base}?tab=2&${query}`, `${base}?tab=5&${query}&ClientFund=0&BaseCurrencyId=EUR`];
    const results = entry.morningstarId
      ? await Promise.allSettled(urls.map(fetchHtml))
      : urls.map(() => ({ status: "rejected", reason: new Error("Missing MorningstarId") }));
    const html = (index) => results[index].status === "fulfilled" ? results[index].value : "";
    const performance = parseAccumulatedRentOnly(html(0));
    const sharpe = parseRatioResult(html(1), ["sharpe"]);
    const sortino = parseRatioResult(html(1), ["sortino"]);
    const volatility = parseRatioResult(html(1), ["volat"]);
    const ter = parseTerResult(html(2));
    const status = { performance: performance.debug.status, sharpe: sharpe.status, sortino: sortino.status, volatility: volatility.status, ter: ter.status };
    const fresh = {
      performance: performance.values,
      sharpe: sharpe.values,
      sortino: sortino.values,
      volatility: volatility.values,
      ter: ter.value,
      morningstarRating: parseMorningstarRating(html(2)),
    };
    const product = { ...entry, url: entry.morningstarId ? urls[0] : "", metricUpdatedAt: { ...previous?.metricUpdatedAt }, updateErrors: [] };
    for (const metric of ["performance", "sharpe", "sortino", "volatility"]) {
      const values = Object.fromEntries(Object.entries(fresh[metric]).filter(([, value]) => validValue(value)));
      product[metric] = { ...previous?.[metric], ...values };
      product.metricUpdatedAt[metric] = {
        ...Object.fromEntries(Object.keys(previous?.[metric] ?? {}).map((period) => [period, previous?.lastUpdated])),
        ...previous?.metricUpdatedAt?.[metric],
      };
      for (const period of Object.keys(values)) product.metricUpdatedAt[metric][period] = updatedAt;
      if (status[metric] === "error" || Object.keys(previous?.[metric] ?? {}).some((period) => validValue(previous[metric][period]) && !validValue(values[period]))) {
        product.updateErrors.push(metric);
      }
    }
    for (const metric of ["ter", "morningstarRating"]) {
      if (validValue(fresh[metric])) {
        product[metric] = fresh[metric];
        product.metricUpdatedAt[metric] = updatedAt;
      } else {
        product[metric] = previous?.[metric] ?? (metric === "ter" ? "-" : null);
        if (validValue(previous?.[metric]) && !product.metricUpdatedAt[metric]) product.metricUpdatedAt[metric] = previous.lastUpdated;
        if (status[metric] === "error" || validValue(previous?.[metric])) product.updateErrors.push(metric);
      }
    }
    product.inceptionYear = [html(0), html(1), html(2)].map(parseInceptionYear).find((year) => year !== null) ?? previous?.inceptionYear ?? null;
    product.isStale = product.updateErrors.length > 0;
    const dates = Object.values(product.metricUpdatedAt).flatMap((value) => typeof value === "string" ? [value] : Object.values(value ?? {}));
    product.dataUpdatedAt = dates.filter((date) => Number.isFinite(Date.parse(date))).sort().at(-1) ?? previous?.dataUpdatedAt ?? previous?.lastUpdated ?? null;
    return product;
  }

  async function buildPayload() {
    // Validate the configuration before fetching or replacing the last good cache.
    const config = parseConfigYaml(await readFile(configPath, "utf8"));
    const previous = await readCache();
    const updatedAt = now().toISOString();
    const payload = { lastUpdated: updatedAt, funds: [], plans: [] };
    const tasks = [];
    for (const section of ["funds", "plans"]) {
      config[section].forEach((entry, index) => tasks.push(async () => {
        const old = previous?.[section]?.find((product) => identity(product) === identity(entry));
        // Older cache files did not have per-metric timestamps.
        const history = old && (old.morningstarId || "") === entry.morningstarId
          ? { ...old, lastUpdated: previous.lastUpdated } : undefined;
        payload[section][index] = await loadProduct(entry, history, updatedAt);
      }));
    }
    let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
      while (cursor < tasks.length) await tasks[cursor++]();
    }));
    await mkdir(path.dirname(cacheFile), { recursive: true });
    const temporary = `${cacheFile}.tmp`;
    await writeFile(temporary, JSON.stringify(payload, null, 2), "utf8");
    await rename(temporary, cacheFile);
    return payload;
  }

  function startRefresh() {
    if (!refreshPromise) {
      refreshFailedAt = null;
      refreshPromise = buildPayload().catch((error) => {
        refreshFailedAt = now().getTime();
        throw error;
      }).finally(() => { refreshPromise = null; });
    }
    return refreshPromise;
  }

  async function getData() {
    const cache = await readCache();
    if (!cache) return startRefresh();
    if (refreshFailedAt !== null && now().getTime() - refreshFailedAt < 60_000) {
      return { ...cache, isUpdating: false, updateFailed: true };
    }
    const age = now().getTime() - Date.parse(cache.lastUpdated);
    // Populate fields added after older caches were written, without discarding data.
    const missingSortino = [...cache.funds, ...cache.plans].some((product) => product?.sortino == null);
    const missingInceptionYear = [...cache.funds, ...cache.plans].some((product) => product?.inceptionYear === undefined);
    if (!missingSortino && !missingInceptionYear && age >= 0 && age < 4 * 60 * 60 * 1000) return { ...cache, isUpdating: Boolean(refreshPromise) };
    startRefresh().catch((error) => console.error("Background refresh failed:", error.message));
    return { ...cache, isUpdating: true };
  }
  return { getData, startRefresh };
}
