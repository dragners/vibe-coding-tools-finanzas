import { describe, expect, it } from "vitest";
import { CATEGORY_BADGES, getCategoryBadges, getCategoryFilterLabel } from "../src/categoryBadges";

describe("Morningstar category classification", () => {
  it.each([
    ["EUR Money Market", "Monetario", "EUR"],
    ["EUR Money Market - Short Term", "Monetario", "Corto plazo"],
    ["EUR Flexible Allocation", "Mixto", "Flexible"],
    ["EUR Cautious Allocation", "Mixto", "Conservador"],
    ["Systematic Trend USD", "Alternat.", "Tendencias"],
    ["Global Emerging Markets Equity", "Acciones", "Emergentes"],
    ["Global Emerging Markets Small/Mid-Cap Equity", "Acciones", "Emergentes"],
    ["Global Emerging Markets Bond - EUR Biased", "Bonos", "Emergentes"],
    ["Global Frontier Markets Equity", "Acciones", "Frontera"],
    ["Asia-Pacific inc. Japan Equity", "Acciones", "Asia-Pac."],
    ["Eurozone Large-Cap Equity", "Acciones", "Eurozona"],
    ["Europe Small-Cap Equity", "Acciones", "Europa"],
    ["Global Small-Cap Equity", "Acciones", "Small cap"],
    ["Global Large-Cap Value Equity", "Acciones", "Value"],
    ["Global Large-Cap Growth Equity", "Acciones", "Growth"],
    ["Global Equity Income", "Acciones", "Dividendos"],
    ["Global Flex-Cap Equity", "Acciones", "Flex. cap"],
    ["Global Large-Cap Blend Equity", "Acciones", "Global"],
    ["Global Equity PP", "Acciones", "Global"],
    ["Sector Equity Precious Metals", "Acciones", "Metales"],
    ["Sector Equity Natural Resources", "Acciones", "Recursos"],
    ["Sector Equity Technology", "Acciones", "Tecnología"],
    ["Sector Equity Ecology", "Acciones", "Ecología"],
    ["India Equity", "Acciones", "India"],
    ["China Equity", "Acciones", "China"],
    ["EUR High Yield Bond", "Bonos", "High yield"],
    ["EUR Corporate Bond - Short Term", "Bonos", "Corto plazo"],
    ["EUR Government Bond - Short Term", "Bonos", "Corto plazo"],
    ["EUR Diversified Bond - Short Term", "Bonos", "Corto plazo"],
    ["EUR Ultra Short-Term Bond", "Bonos", "Corto plazo"],
    ["EUR Corporate Bond", "Bonos", "Corporativo"],
    ["EUR Government Bond", "Bonos", "Gobierno"],
    ["Global Flexible Bond - EUR Hedged", "Bonos", "Flexible"],
    ["Global Flexible Bond", "Bonos", "Flexible"],
    ["EUR Flexible Bond", "Bonos", "Flexible"],
    ["Global Bond - EUR Hedged", "Bonos", "Global"],
    ["Other Bond", "Bonos", "Otros"],
    ["-", "Otros", "Sin categ."],
  ])("%s has a useful asset and focus", (category, asset, focus) => {
    expect(getCategoryBadges(category, "es").map(badge => badge.text)).toEqual([asset, focus, "Activa"]);
  });
  it("uses stable filter identities across languages and explicit indexing only", () => {
    const category = "Global Emerging Markets Equity";
    expect(getCategoryBadges(category, "en", true).map(badge => badge.variant))
      .toEqual(getCategoryBadges(category, "es", true).map(badge => badge.variant));
    expect(getCategoryBadges(category, "en", true).map(badge => badge.text)).toEqual(["Equity", "Emerging", "Index"]);
    expect(getCategoryBadges(category, "es", false)[2].variant).toBe("active");
  });
  it("keeps money market filters stable across languages and preserves the indexed flag", () => {
    const spanish = getCategoryBadges("EUR Money Market", "es", true);
    const english = getCategoryBadges("EUR Money Market", "en", true);
    expect(spanish.map(badge => badge.variant)).toEqual(english.map(badge => badge.variant));
    expect(english.map(badge => badge.text)).toEqual(["Cash", "EUR", "Index"]);
    expect(spanish[0].searchTerms).toContain("monetarios");
    expect(getCategoryBadges("EUR Ultra Short-Term Bond", "es")[0].variant).toBe("bond");
  });
});


it("uses complete names in filter lists while keeping compact row labels where appropriate", () => {
  expect(getCategoryFilterLabel("moneyMarket", "es")).toBe("Monetario");
  expect(getCategoryFilterLabel("moneyMarket", "en")).toBe("Money market");
  expect(getCategoryFilterLabel("alternative", "es")).toBe("Alternativos");
  expect(getCategoryFilterLabel("asia", "es")).toBe("Asia-Pacífico");
  expect(getCategoryFilterLabel("flexCap", "es")).toBe("Capitalización flexible");
  expect(getCategoryFilterLabel("unknown", "es")).toBe("Sin categoría");
});

it("uses varied, readable colours for focus labels", () => {
  const geographic = ["global", "europe", "eurozone", "asia", "emerging", "frontier", "india", "china"] as const;
  const strategies = ["smallCap", "value", "growth", "dividend", "flexCap"] as const;
  expect(new Set(geographic.map(variant => CATEGORY_BADGES[variant].style)).size).toBeGreaterThanOrEqual(6);
  expect(new Set(strategies.map(variant => CATEGORY_BADGES[variant].style)).size).toBe(strategies.length);
  // Equities keep their rose identity; their focus must not repeat red or pink.
  for (const variant of [...geographic, ...strategies, "tech", "ecology", "resources", "metals"] as const) {
    expect(CATEGORY_BADGES[variant].style).not.toMatch(/bg-(?:rose|red|pink)-/);
  }
  // Common bond focuses remain distinct from the green asset badge.
  for (const variant of ["shortTerm", "government", "corporate", "highYield", "flexible", "global", "emerging"] as const) {
    expect(CATEGORY_BADGES[variant].style).not.toMatch(/bg-(?:green|emerald|teal|lime)-/);
  }
});
