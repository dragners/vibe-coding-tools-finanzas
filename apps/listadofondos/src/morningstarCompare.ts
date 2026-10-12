export const MAX_COMPARISON_FUNDS = 5;

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
