export const MAX_COMPARISON_FUNDS = 5;

export function getFundComparisonKey(fund: { morningstarId?: string; isin?: string }) {
  // Distinct products can share a Morningstar ID; use their own identifier first.
  return getFinectProductId(fund.isin) || fund.morningstarId?.trim() || "";
}

export function getFinectProductId(isin?: string) {
  const id = isin?.trim() ?? "";
  return id === "-" ? "" : id;
}

export function getFinectCompareUrl(isins: string[], section: "funds" | "plans" = "funds") {
  if (isins.length < 2 || isins.length > MAX_COMPARISON_FUNDS) return null;
  const productIds = isins.map(getFinectProductId);
  if (productIds.some((id) => !id) || new Set(productIds).size !== productIds.length) return null;
  const path = section === "plans" ? "planes-pensiones" : "fondos-inversion";
  return `https://www.finect.com/${path}/comparador?products=${productIds.map(encodeURIComponent).join(",")}`;
}

export function getMorningstarCompareUrl(ids: string[], lang: "es" | "en") {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length < 2 || uniqueIds.length > MAX_COMPARISON_FUNDS) return null;

  // Preserve the token encoding used by Morningstar's comparison links:
  // preceding tokens are encoded once before the entire query is encoded.
  const tokens = uniqueIds.map((id, index) => {
    const token = `${id}]2]1]FOEUR$$ALL_522`;
    return index === uniqueIds.length - 1 ? token : encodeURIComponent(token);
  });
  const params = new URLSearchParams({
    SecurityTokenList: tokens.join("|"),
    CurrencyId: "EUR",
    LanguageId: lang === "es" ? "es-ES" : "en-EN",
    chkFundInclu: "",
  });
  return `https://lt.morningstar.com/xgnfa0k0aw/fundcompare/default.aspx?${params}`;
}
