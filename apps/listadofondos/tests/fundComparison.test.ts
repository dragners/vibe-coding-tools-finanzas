import { describe, expect, it } from "vitest";
import { findDuplicateIdentifiers, getFinectCompareUrl, getMorningstarCompareUrl } from "../src/fundComparison";

describe("comparison links", () => {
  it("preserves the provided Morningstar link format for five products", () => {
    const ids = ["F00000WI0D", "F000011HLY", "F00000YXEW", "F000010KY6", "F00001T5CX"];
    const url = new URL(getMorningstarCompareUrl(ids, "es")!);
    expect(url.searchParams.get("SecurityTokenList")?.split("|").map(decodeURIComponent))
      .toEqual(ids.map((id) => `${id}]2]1]FOEUR$$ALL_522`));
    expect(url.searchParams.get("SecurityTokenList")).toContain("%5D");
    expect(url.searchParams.get("CurrencyId")).toBe("EUR");
    expect(url.searchParams.get("LanguageId")).toBe("es-ES");
    expect(new URL(getMorningstarCompareUrl(ids, "en")!).searchParams.get("LanguageId")).toBe("en-EN");
  });

  it("uses the appropriate Finect route and all selected identifiers", () => {
    expect(getFinectCompareUrl(["LU1694789535", "IE00BZCQB185", "ES0112618006", "N5263", "LU1372006947"]))
      .toBe("https://www.finect.com/fondos-inversion/comparador?products=LU1694789535,IE00BZCQB185,ES0112618006,N5263,LU1372006947");
    expect(getFinectCompareUrl(["N5396", "N5263", "N5116"], "plans"))
      .toBe("https://www.finect.com/planes-pensiones/comparador?products=N5396,N5263,N5116");
  });

  it("requires two to five products and rejects missing Finect identifiers", () => {
    for (const ids of [[], ["A"], ["A", "B", "C", "D", "E", "F"]]) {
      expect(getFinectCompareUrl(ids)).toBeNull();
      expect(getMorningstarCompareUrl(ids, "es")).toBeNull();
    }
    expect(getFinectCompareUrl(["A", "-"])).toBeNull();
    expect(getFinectCompareUrl(["A", " "])).toBeNull();
    expect(getFinectCompareUrl(["A", "A"])).toBeNull();
  });
});

describe("duplicate identifier validation", () => {
  it("identifies both fields, every affected product and its section, including cross-section duplicates", () => {
    const duplicates = findDuplicateIdentifiers([
      { name: "Fondo A", isin: "ES001", morningstarId: "F001" },
      { name: "Fondo B", isin: " es001 ", morningstarId: "F002" },
    ], [{ name: "Plan C", isin: "N5396", morningstarId: " f001 " }]);
    expect(duplicates).toEqual([
      { field: "isin", value: "ES001", products: [{ name: "Fondo A", section: "funds" }, { name: "Fondo B", section: "funds" }] },
      { field: "morningstarId", value: "F001", products: [{ name: "Fondo A", section: "funds" }, { name: "Plan C", section: "plans" }] },
    ]);
  });

  it("ignores absent identifiers and accepts unique data", () => {
    expect(findDuplicateIdentifiers([
      { name: "A", isin: "-", morningstarId: "" },
      { name: "B", isin: " ", morningstarId: "-" },
      { name: "C", isin: "ES001", morningstarId: "F001" },
    ], [{ name: "D", isin: "N5396", morningstarId: "F002" }])).toEqual([]);
  });
});
