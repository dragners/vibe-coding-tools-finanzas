import type { ApiPayload, FundRow } from "./App";

type Metric = FundRow["ter"];
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const validMetric = (value: unknown): value is Metric => value == null || typeof value === "string" ||
  (typeof value === "number" && Number.isFinite(value)) ||
  (record(value) && [value.value, value.label].every((part) => part == null || typeof part === "string" || (typeof part === "number" && Number.isFinite(part))));

export function validatePayload(value: unknown): ApiPayload {
  if (!record(value) || typeof value.lastUpdated !== "string" || !Number.isFinite(Date.parse(value.lastUpdated))) {
    throw new Error("Invalid data timestamp");
  }
  if (value.isUpdating !== undefined && typeof value.isUpdating !== "boolean") throw new Error("Invalid update status");
  if (value.updateFailed !== undefined && typeof value.updateFailed !== "boolean") throw new Error("Invalid failure status");
  const parseProducts = (items: unknown): FundRow[] => {
    if (!Array.isArray(items)) throw new Error("Invalid product list");
    return items.map((item) => {
      if (!record(item) || typeof item.name !== "string" || !item.name.trim()) throw new Error("Invalid product name");
      const text = (key: string) => {
        if (item[key] == null) return "";
        if (typeof item[key] !== "string") throw new Error(`Invalid ${key}`);
        return item[key] as string;
      };
      const metrics = (key: string) => {
        const values = item[key] ?? {};
        if (!record(values) || !Object.values(values).every(validMetric)) throw new Error(`Invalid ${key} metrics`);
        return values as Record<string, Metric>;
      };
      if (!validMetric(item.ter)) throw new Error("Invalid TER");
      if (item.morningstarRating != null && (typeof item.morningstarRating !== "number" || !Number.isFinite(item.morningstarRating))) throw new Error("Invalid rating");
      for (const key of ["indexed", "inPortfolio", "isStale"]) {
        if (item[key] !== undefined && typeof item[key] !== "boolean") throw new Error(`Invalid ${key}`);
      }
      if (item.dataUpdatedAt != null && (typeof item.dataUpdatedAt !== "string" || !Number.isFinite(Date.parse(item.dataUpdatedAt)))) throw new Error("Invalid product timestamp");
      return {
        name: item.name, isin: text("isin"), morningstarId: text("morningstarId"),
        category: text("category"), comment: text("comment"), url: text("url"),
        performance: metrics("performance"), sharpe: metrics("sharpe"), sortino: metrics("sortino"), volatility: metrics("volatility"),
        ter: item.ter ?? "-", morningstarRating: item.morningstarRating as number | null,
        indexed: item.indexed as boolean | undefined, inPortfolio: item.inPortfolio as boolean | undefined,
        isStale: item.isStale as boolean | undefined, dataUpdatedAt: item.dataUpdatedAt as string | null | undefined,
      };
    });
  };
  return { lastUpdated: value.lastUpdated, funds: parseProducts(value.funds), plans: parseProducts(value.plans), isUpdating: value.isUpdating as boolean | undefined, updateFailed: value.updateFailed as boolean | undefined };
}
