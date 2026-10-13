export const MAX_COMPARISON_FUNDS = 5;

export function getFundComparisonKey(fund: { morningstarId?: string; isin?: string }) {
  // Use the product identifier for stable selection; warn about invalid duplicates separately.
  return getFinectProductId(fund.isin) || fund.morningstarId?.trim() || "";
}

type IdentifiableProduct = { name: string; isin?: string; morningstarId?: string };
type DuplicateIdentifier = {
  field: "isin" | "morningstarId";
  value: string;
  products: { name: string; section: "funds" | "plans" }[];
};

export function findDuplicateIdentifiers(funds: IdentifiableProduct[], plans: IdentifiableProduct[]): DuplicateIdentifier[] {
  const duplicates: DuplicateIdentifier[] = [];
  const products = [
    ...funds.map((product) => ({ ...product, section: "funds" as const })),
    ...plans.map((product) => ({ ...product, section: "plans" as const })),
  ];
  for (const field of ["isin", "morningstarId"] as const) {
    const groups = new Map<string, DuplicateIdentifier["products"]>();
    for (const product of products) {
      const value = getFinectProductId(product[field]).toUpperCase();
      if (!value) continue;
      const group = groups.get(value) ?? [];
      group.push({ name: product.name, section: product.section });
      groups.set(value, group);
    }
    for (const [value, group] of groups) {
      if (group.length > 1) duplicates.push({ field, value, products: group });
    }
  }
  return duplicates;
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
