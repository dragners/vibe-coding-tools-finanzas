import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App, { type ApiPayload, type FundRow } from "../src/App";

function product(name: string, isin: string, morningstarId: string, ter: FundRow["ter"] = "0,2"): FundRow {
  return { name, isin, morningstarId, ter, category: "Equity Global", comment: "", url: "", performance: {}, sharpe: {}, sortino: {}, volatility: {} };
}
const funds = Array.from({ length: 6 }, (_, index) => product(`Fondo ${index + 1}`, `LU000000000${index}`, `F00${index}`));
const plans = ["N5396", "N5263", "N5116", "N5138", "N5270", "N5219"].map((id, index) => product(`Plan ${index + 1}`, id, `P00${index}`));

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/listadofondos/");
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function load(payload: Partial<ApiPayload> = {}) {
  const data: ApiPayload = { lastUpdated: "2026-10-13T08:00:00Z", funds, plans, ...payload };
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, headers: { get: () => "application/json" }, text: async () => JSON.stringify(data) })));
  render(<App />);
  await screen.findByRole("checkbox", { name: `Seleccionar para comparar: ${data.funds[0]?.name ?? data.plans[0].name}` });
  return userEvent.setup();
}
const checkbox = (name: string) => screen.getByRole("checkbox", { name: `Seleccionar para comparar: ${name}`, exact: true }) as HTMLInputElement;
const compare = (provider: string) => screen.getByText(new RegExp(`^Comparar en ${provider}`));
const fundNames = () => Array.from(document.querySelectorAll("tbody tr.align-middle td:first-child a")).map((element) => element.textContent);

describe("visible comparison feedback and selection", () => {
  it("shows type lock and maximum messages, preserves hidden selections and allows replacement", async () => {
    const user = await load();
    expect(screen.queryByText("Selecciona al menos 2 fondos o 2 planes para comparar.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Todas", exact: true })).toBeNull();
    expect(screen.queryByRole("button", { name: "Costes y detalles", exact: true })).toBeNull();
    expect(compare("Finect").getAttribute("href")).toBeNull();
    await user.click(checkbox("Fondo 1"));
    expect(checkbox("Plan 1").disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("fondos o planes por separado");
    for (let i = 2; i <= 5; i++) await user.click(checkbox(`Fondo ${i}`));
    expect(screen.getByRole("status").textContent).toContain("Máximo de 5");
    expect(checkbox("Fondo 6").disabled).toBe(true);
    expect(checkbox("Fondo 1").disabled).toBe(false);
    const href = compare("Finect").getAttribute("href");
    await user.type(screen.getByRole("textbox"), "Fondo 6");
    expect(checkbox("Fondo 6").disabled).toBe(true);
    expect(compare("Finect").getAttribute("href")).toBe(href);
    await user.clear(screen.getByRole("textbox"));
    await user.click(checkbox("Fondo 1"));
    await user.click(checkbox("Fondo 6"));
    expect(compare("Finect").getAttribute("href")).toContain("LU0000000005");
    expect(compare("Finect").getAttribute("href")).not.toContain("LU0000000000");
    await user.click(screen.getByRole("button", { name: "Limpiar selección" }));
    expect(checkbox("Plan 1").disabled).toBe(false);
  });

  it("locks funds when selecting plans and unlocks both types after the last deselection", async () => {
    const user = await load();
    await user.click(checkbox("Plan 1"));
    expect(checkbox("Fondo 1").disabled).toBe(true);
    await user.click(checkbox("Plan 2"));
    expect(compare("Finect").getAttribute("href")).toBe("https://www.finect.com/planes-pensiones/comparador?products=N5396,N5263");
    await user.click(checkbox("Plan 1"));
    expect(checkbox("Fondo 1").disabled).toBe(true);
    await user.click(checkbox("Plan 2"));
    expect(checkbox("Fondo 1").disabled).toBe(false);
    expect(checkbox("Plan 1").disabled).toBe(false);
  });

  it("enforces the limit of five pension plans while allowing replacement", async () => {
    const user = await load();
    for (let i = 1; i <= 5; i++) await user.click(checkbox(`Plan ${i}`));
    expect(checkbox("Plan 6").disabled).toBe(true);
    expect(checkbox("Fondo 1").disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("Máximo de 5");
    await user.click(checkbox("Plan 2"));
    await user.click(checkbox("Plan 6"));
    expect(compare("Finect").getAttribute("href")).toBe("https://www.finect.com/planes-pensiones/comparador?products=N5396,N5116,N5138,N5270,N5219");
  });

  it.each([
    ["morningstarId", "", "Morningstar", "Morningstar no está disponible"],
    ["isin", "-", "Finect", "Finect no está disponible"],
  ])("explains missing %s without disabling the other provider", async (field, value, provider, message) => {
    const user = await load({ funds: [funds[0], { ...funds[1], [field]: value }] });
    await user.click(checkbox("Fondo 1"));
    await user.click(checkbox("Fondo 2"));
    expect(compare(provider).getAttribute("href")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain(message);
    expect(compare(provider === "Finect" ? "Morningstar" : "Finect").getAttribute("href")).not.toBeNull();
  });

  it("visibly explains why a product without any identifiers cannot be selected", async () => {
    await load({ funds: [product("Sin identificadores", "-", "")] });
    expect(checkbox("Sin identificadores").disabled).toBe(true);
    expect(screen.getByText("Este producto no tiene identificadores para comparar")).not.toBeNull();
  });
});

describe("header data warnings", () => {
  it("names duplicate ISIN and MorningstarId products across sections and stays visible during search", async () => {
    const user = await load({
      funds: [funds[0], { ...funds[1], isin: funds[0].isin }],
      plans: [{ ...plans[0], morningstarId: funds[0].morningstarId }],
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Corrige el ISIN o MorningstarId");
    expect(alert.textContent).toContain(`ISIN: ${funds[0].isin}`);
    expect(alert.textContent).toContain(`MorningstarId: ${funds[0].morningstarId}`);
    for (const name of ["Fondo 1", "Fondo 2", "Plan 1"]) expect(alert.textContent).toContain(name);
    expect(alert.closest("main")).toBeNull();
    await user.type(screen.getByRole("textbox"), "no existe");
    expect(screen.getByRole("alert")).toBe(alert);
  });

  it("does not show a warning for valid identifiers", async () => {
    await load();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("sorting regression", () => {
  const rows = [
    { ...product("Alfa", "LU001", "F001", "0,4"), performance: { "1Y": "20,1" }, sharpe: { "1Y": "1,4" }, sortino: { "1Y": "2,4" }, volatility: { "1Y": "15,2" } },
    { ...product("Beta", "LU002", "F002", "0,2"), performance: { "1Y": "-5,2" }, sharpe: { "1Y": "-0,1" }, sortino: { "1Y": "-0,5" }, volatility: { "1Y": "5,8" } },
    product("Sin datos", "LU003", "F003", "-"),
  ];

  it("leaves absent values last in both directions across TER, returns, Sharpe and volatility", async () => {
    const user = await load({ funds: rows, plans: [] });
    for (const label of ["TER", "Rentabilidades (%) 1Y", "Ratio Sharpe 1Y", "Ratio Sortino 1Y", "Volatilidad 1Y"]) {
      for (const direction of ["ascendente", "descendente"]) {
        await user.click(screen.getByRole("button", { name: `Orden ${direction} por ${label}`, exact: true }));
        expect(fundNames()).toEqual(direction === "ascendente" ? ["Beta", "Alfa", "Sin datos"] : ["Alfa", "Beta", "Sin datos"]);
      }
    }
  });

  it("switches columns without duplicating rows even with invalid duplicate ISINs", async () => {
    const user = await load({ funds: [rows[0], { ...rows[1], isin: rows[0].isin }, rows[2]], plans: [] });
    const sequence: [string, string[]][] = [
      ["Orden descendente por Nombre", ["Sin datos", "Beta", "Alfa"]],
      ["Orden ascendente por TER", ["Beta", "Alfa", "Sin datos"]],
      ["Orden descendente por Rentabilidades (%) 1Y", ["Alfa", "Beta", "Sin datos"]],
    ];
    for (let iteration = 0; iteration < 3; iteration++) {
      for (const [label, expected] of sequence) {
        await user.click(screen.getByRole("button", { name: label, exact: true }));
        expect(fundNames()).toEqual(expected);
        expect(document.querySelectorAll('button[aria-label^="Orden "][aria-pressed="true"]').length).toBe(1);
      }
    }
  });

  it("treats empty and placeholder identifiers as missing in text sorting too", async () => {
    const user = await load({ funds: [rows[0], { ...rows[1], isin: " " }, { ...rows[2], isin: "-" }], plans: [] });
    for (const direction of ["ascendente", "descendente"]) {
      await user.click(screen.getByRole("button", { name: `Orden ${direction} por ISIN`, exact: true }));
      expect(fundNames()).toEqual(["Alfa", "Beta", "Sin datos"]);
    }
  });
});

describe("data loading and mobile controls", () => {
  it("retains real products after a background connection failure instead of replacing them with examples", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let refresh: (() => void) | undefined;
    const originalTimeout = window.setTimeout;
    vi.spyOn(window, "setTimeout").mockImplementation((handler, delay, ...args) => {
      if (delay === 5000 && typeof handler === "function") refresh = () => handler(...args);
      return originalTimeout.call(window, handler, delay, ...args);
    });
    const user = await load({ isUpdating: true });
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    // Run the application's pending 5-second refresh without sleeping in the test.
    await user.click(screen.getByRole("button", { name: "EN", exact: true }));
    // Language switches must not fetch again or replace the loaded list.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // A real refresh is scheduled by the initial isUpdating response.
    expect(refresh).toBeDefined();
    await act(async () => { refresh!(); });
    expect(screen.getByText("Fondo 1", { exact: true })).not.toBeNull();
    expect(screen.queryByText("Fondo Ejemplo Global")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).not.toBeNull();
  }, 10000);

  it("rejects an invalid response visibly and lets the user retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const payload = { lastUpdated: "bad-date", funds, plans };
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, headers: { get: () => "application/json" }, text: async () => JSON.stringify(payload) })));
    render(<App />);
    await screen.findByRole("alert");
    expect(screen.queryByText("Fondo 1", { exact: true })).toBeNull();
    expect(screen.queryByText("Fondo Ejemplo Global")).toBeNull();
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, headers: { get: () => "application/json" }, text: async () => JSON.stringify({ ...payload, lastUpdated: "2026-10-13T08:00:00Z" }) } as Response);
    await userEvent.setup().click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("Fondo 1", { exact: true });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(vi.mocked(fetch).mock.calls.every(([, options]) => options?.cache === "no-store")).toBe(true);
  });

  it("marks preserved older metrics and explains Sharpe", async () => {
    const user = await load({ funds: [{ ...funds[0], isStale: true, dataUpdatedAt: "2026-10-12T08:00:00Z" }] });
    expect(screen.getByText("Datos pendientes de actualizar")).not.toBeNull();
    expect(screen.getByText(/Conservamos las últimas cifras disponibles/)).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Ratio Sharpe", exact: true }));
    expect(screen.getByText(/Indica cuánta rentabilidad adicional/).textContent).toContain("referencia sin riesgo");
    await user.click(screen.getByRole("button", { name: "Cerrar aviso", exact: true }));
    expect(screen.queryByText(/Conservamos las últimas cifras disponibles/)).toBeNull();
    expect(screen.getByText("Datos pendientes de actualizar")).not.toBeNull();
  });
});


describe("category labels", () => {
  const categorized = {
    funds: [
      { ...funds[0], category: "Equity Global", indexed: true },
      { ...funds[1], category: "Bond Global", indexed: false },
      { ...funds[2], category: "Equity Europe", indexed: false },
    ],
    plans: [
      { ...plans[0], category: "Equity Global", indexed: false },
      { ...plans[1], category: "Bond Europe", indexed: true, comment: "Acciones Global Activa" },
    ],
  };

  it.each([
    ["Acciones", "Fondo 1", ["Fondo 1", "Fondo 3", "Plan 1"]],
    ["Bonos", "Fondo 2", ["Fondo 2", "Plan 2"]],
    ["Global", "Fondo 1", ["Fondo 1", "Fondo 2", "Plan 1"]],
    ["Europa", "Fondo 3", ["Fondo 3", "Plan 2"]],
    ["Index", "Fondo 1", ["Fondo 1", "Plan 2"]],
    ["Activa", "Fondo 2", ["Fondo 2", "Fondo 3", "Plan 1"]],
  ])("clicking %s includes every matching fund and plan and clearing restores the list", async (label, name, expected) => {
    const user = await load(categorized);
    await user.click(screen.getByRole("button", { name: `Filtrar por ${label}: ${name}`, exact: true }));
    expect(fundNames()).toEqual(expected);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(label);
    await user.clear(screen.getByRole("textbox"));
    expect(fundNames()).toHaveLength(5);
    await user.type(screen.getByRole("textbox"), "Fondo 3");
    expect(fundNames()).toEqual(["Fondo 3"]);
  });

  it("filters corrected categories across funds and plans and preserves the filter in English", async () => {
    const user = await load({ funds: [
      { ...funds[0], category: "Global Emerging Markets Equity" },
      { ...funds[1], category: "Global Emerging Markets Bond - EUR Biased" },
      { ...funds[2], category: "Global Frontier Markets Equity", comment: "Emergentes" },
    ], plans: [{ ...plans[0], category: "Global Emerging Markets Equity" }] });
    await user.click(screen.getByRole("button", { name: "Filtrar por Emergentes: Fondo 1", exact: true }));
    expect(fundNames()).toEqual(["Fondo 1", "Fondo 2", "Plan 1"]);
    await user.click(screen.getByRole("button", { name: "EN", exact: true }));
    expect(fundNames()).toEqual(["Fondo 1", "Fondo 2", "Plan 1"]);
    expect(screen.getByRole("button", { name: "Filter by Emerging: Fondo 1", exact: true })).not.toBeNull();
  });

  it("renders the hover description outside the scrollable table and closes it on scroll or Escape", async () => {
    const user = await load(categorized);
    const badge = screen.getByRole("button", { name: "Filtrar por Acciones: Fondo 1", exact: true });
    await user.hover(badge);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.textContent).toBe("Equity Global");
    expect(tooltip.parentElement).toBe(document.body);
    expect(tooltip.style.position).toBe("fixed");
    expect(badge.getAttribute("aria-describedby")).toBe(tooltip.id);
    act(() => document.querySelector('.fund-table-scroll')!.dispatchEvent(new Event('scroll')));
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.unhover(badge);
    act(() => badge.focus());
    expect(screen.getByRole("tooltip").textContent).toBe("Equity Global");
    await user.keyboard('{Escape}');
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("filters English labels and keeps the same category when switching languages", async () => {
    const user = await load(categorized);
    await user.click(screen.getByRole("button", { name: "EN", exact: true }));
    await user.click(screen.getByRole("button", { name: "Filter by Equity: Fondo 1", exact: true }));
    expect(fundNames()).toEqual(["Fondo 1", "Fondo 3", "Plan 1"]);
    await user.click(screen.getByRole("button", { name: "ES", exact: true }));
    expect(fundNames()).toEqual(["Fondo 1", "Fondo 3", "Plan 1"]);
  });
});

it("places Sortino between Sharpe and volatility for funds and plans and explains its interpretation", async () => {
  const user = await load({ funds: [{ ...funds[0], sortino: { '1Y': '1,23', '3Y': '0', '5Y': '-1,4' } }], plans: [{ ...plans[0], sortino: { '1Y': '2,34', '3Y': '3,45', '5Y': '4,56' } }] });
  const headings = [...document.querySelectorAll('thead tr:first-child th')].map(el => el.textContent);
  expect(headings.findIndex(text => text?.includes('Ratio Sortino'))).toBe(headings.findIndex(text => text?.includes('Ratio Sharpe')) + 1);
  expect(headings.findIndex(text => text?.includes('Volatilidad'))).toBe(headings.findIndex(text => text?.includes('Ratio Sortino')) + 1);
  for (const period of ['1Y', '3Y', '5Y']) expect(screen.getByRole('button', { name: `Orden ascendente por Ratio Sortino ${period}`, exact: true })).not.toBeNull();
  expect(screen.getByText('1,23', { exact: true })).not.toBeNull();
  expect(screen.getByText('2,34', { exact: true })).not.toBeNull();
  await user.click(screen.getByRole('button', { name: 'Ratio Sortino', exact: true }));
  expect(screen.getByRole('tooltip').textContent).toContain('solo penaliza las desviaciones a la baja');
  expect(screen.getByRole('tooltip').textContent).toContain('Un valor negativo');
  await user.click(screen.getByRole('button', { name: 'EN', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Sortino ratio', exact: true }));
  expect(screen.getByText(/Unlike Sharpe/)).not.toBeNull();
});

it("clears typed searches and label filters with X, restores rows and keeps comparison selection", async () => {
  const user = await load({ funds: [{ ...funds[0], indexed: true }, funds[1]], plans: [plans[0]] });
  const input = screen.getByRole('textbox') as HTMLInputElement;
  expect(screen.queryByRole('button', { name: 'Borrar búsqueda', exact: true })).toBeNull();
  await user.click(checkbox('Fondo 1'));
  await user.type(input, 'Fondo 2');
  expect(fundNames()).toEqual(['Fondo 2']);
  await user.click(screen.getByRole('button', { name: 'Borrar búsqueda', exact: true }));
  expect(input.value).toBe('');
  expect(document.activeElement).toBe(input);
  expect(fundNames()).toEqual(['Fondo 1', 'Fondo 2', 'Plan 1']);
  expect(checkbox('Fondo 1').checked).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Filtrar por Index: Fondo 1', exact: true }));
  expect(fundNames()).toEqual(['Fondo 1']);
  await user.click(screen.getByRole('button', { name: 'Borrar búsqueda', exact: true }));
  expect(fundNames()).toHaveLength(3);
  expect(screen.queryByRole('button', { name: 'Borrar búsqueda', exact: true })).toBeNull();
  await user.type(input, 'Plan 1');
  await user.click(screen.getByRole('button', { name: 'EN', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Clear search', exact: true }));
  expect(input.value).toBe('');
  expect(document.activeElement).toBe(input);
  expect(fundNames()).toHaveLength(3);
});


describe("Morningstar star filters", () => {
  const ratedFunds = [1, 2, 3, 4, 5].map((rating, index) => ({ ...funds[index], morningstarRating: rating }));
  const ratedPayload = {
    funds: [...ratedFunds, { ...funds[5], morningstarRating: null, comment: "★★★★★" }],
    plans: [
      { ...plans[0], morningstarRating: 5 },
      { ...plans[1], morningstarRating: 3 },
      { ...plans[2], morningstarRating: 0 },
    ],
  };

  it.each([1, 2, 3, 4, 5])("clicking %i stars filters by the exact rating and X restores every row", async (rating) => {
    const user = await load(ratedPayload);
    await user.click(checkbox("Fondo 1"));
    await user.click(screen.getByRole("button", { name: `Filtrar por ${rating} estrellas Morningstar: Fondo ${rating}`, exact: true }));
    const expected = [`Fondo ${rating}`, ...(rating === 5 ? ["Plan 1"] : rating === 3 ? ["Plan 2"] : [])];
    expect(fundNames()).toEqual(expected);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("★".repeat(rating));
    expect(screen.getByRole("button", { name: `Filtrar por ${rating} estrellas Morningstar: Fondo ${rating}`, exact: true }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Borrar búsqueda", exact: true }));
    expect(fundNames()).toHaveLength(9);
    expect(checkbox("Fondo 1").checked).toBe(true);
  });

  it("works with keyboard, language changes and replacing the star filter with a label or typed search", async () => {
    const user = await load(ratedPayload);
    const stars = screen.getByRole("button", { name: "Filtrar por 5 estrellas Morningstar: Fondo 5", exact: true });
    act(() => stars.focus());
    await user.keyboard("{Enter}");
    expect(fundNames()).toEqual(["Fondo 5", "Plan 1"]);
    await user.click(screen.getByRole("button", { name: "EN", exact: true }));
    expect(fundNames()).toEqual(["Fondo 5", "Plan 1"]);
    expect(screen.getByRole("button", { name: "Filter by 5 Morningstar stars: Fondo 5", exact: true }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Filter by Equity: Fondo 5", exact: true }));
    expect(fundNames()).toHaveLength(9);
    await user.click(screen.getByRole("button", { name: "Filter by 3 Morningstar stars: Fondo 3", exact: true }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "Fondo 2");
    expect(fundNames()).toEqual(["Fondo 2"]);
  });
});


describe("copying product identifiers", () => {
  it("copies the exact fund ISIN or pension code and announces success without changing filters or selection", async () => {
    const user = await load({ funds: [funds[0]], plans: [plans[0]] });
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await user.click(checkbox("Fondo 1"));
    await user.click(screen.getByRole("button", { name: "Copiar ISIN: LU0000000000", exact: true }));
    expect(writeText).toHaveBeenLastCalledWith("LU0000000000");
    expect(screen.getByText("Copiado", { exact: true })).not.toBeNull();
    expect(checkbox("Fondo 1").checked).toBe(true);
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
    await user.click(screen.getByRole("button", { name: "Copiar ISIN: N5396", exact: true }));
    expect(writeText).toHaveBeenLastCalledWith("N5396");
    expect(fundNames()).toEqual(["Fondo 1", "Plan 1"]);
    writeText.mockRestore();
  });

  it("supports keyboard copying and English feedback", async () => {
    const user = await load({ funds: [funds[0]], plans: [] });
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await user.click(screen.getByRole("button", { name: "EN", exact: true }));
    act(() => screen.getByRole("button", { name: "Copy ISIN: LU0000000000", exact: true }).focus());
    await user.keyboard("{Enter}");
    expect(writeText).toHaveBeenCalledWith("LU0000000000");
    expect(screen.getByText("Copied", { exact: true })).not.toBeNull();
    writeText.mockRestore();
  });

  it("does not show false success when clipboard access fails, and missing identifiers are not copyable", async () => {
    const user = await load({ funds: [funds[0], { ...funds[1], isin: "" }, { ...funds[2], isin: "-" }], plans: [] });
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Denied"));
    expect(screen.getAllByRole("button", { name: /^Copiar ISIN:/ })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Copiar ISIN: LU0000000000", exact: true }));
    expect(screen.getByText("No se pudo copiar", { exact: true })).not.toBeNull();
    expect(screen.queryByText("Copiado", { exact: true })).toBeNull();
    expect(fundNames()).toHaveLength(3);
    writeText.mockRestore();
  });
});
