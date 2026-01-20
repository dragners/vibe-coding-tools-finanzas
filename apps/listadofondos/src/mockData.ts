import type { ApiPayload } from "./App";

const ISO_DATE = "2024-01-15T08:00:00.000Z";

export const MOCK_PAYLOAD: ApiPayload = {
  lastUpdated: ISO_DATE,
  funds: [
    {
      name: "Fondo Ejemplo Global",
      isin: "ES0000000001",
      category: "Global Large-Cap Equity",
      morningstarId: "F000000001",
      morningstarRating: 4,
      comment: "Datos de ejemplo utilizados cuando no se puede contactar con la API.",
      url: "https://www.morningstar.es/es/funds/f0gb000000?tab=1",
      indexed: false,
      inPortfolio: true,
      performance: {
        "1M": "1.8",
        "3M": "4.5",
        "6M": "7.2",
        YTD: "6.1",
        "1Y": "9.8",
        "3Y Anual": "7.4",
        "5Y Anual": "6.9",
        "10Y Anual": "8.1",
      },
      sharpe: {
        "1Y": "0.82",
        "3Y": "0.91",
        "5Y": "0.95",
      },
      volatility: {
        "1Y": "13.4",
        "3Y": "12.6",
        "5Y": "11.8",
      },
      ter: "0.85",
    },
    {
      name: "Fondo Ejemplo Sostenible",
      isin: "ES0000000002",
      category: "Sector Equity Ecology",
      morningstarId: "F000000002",
      morningstarRating: 5,
      comment: "Rentabilidades ficticias para mostrar la tabla en ausencia de datos reales.",
      url: "https://www.morningstar.es/es/funds/f0gb000001?tab=1",
      indexed: true,
      performance: {
        "1M": "2.2",
        "3M": "5.7",
        "6M": "9.3",
        YTD: "7.6",
        "1Y": "11.4",
        "3Y Anual": "8.9",
        "5Y Anual": "7.7",
        "10Y Anual": "9.0",
      },
      sharpe: {
        "1Y": "0.95",
        "3Y": "1.02",
        "5Y": "1.08",
      },
      volatility: {
        "1Y": "12.1",
        "3Y": "11.7",
        "5Y": "11.2",
      },
      ter: "0.60",
    },
  ],
  plans: [
    {
      name: "Plan Ejemplo Jubilación",
      isin: "ES0000000003",
      category: "Pension Allocation Global",
      morningstarId: "F000000003",
      morningstarRating: 3,
      comment: "Muestra de datos estáticos para planes de pensiones.",
      url: "https://www.morningstar.es/es/funds/f0gb000002?tab=1",
      performance: {
        "1M": "1.1",
        "3M": "3.2",
        "6M": "4.9",
        YTD: "3.8",
        "1Y": "6.5",
        "3Y Anual": "5.1",
        "5Y Anual": "4.4",
        "10Y Anual": "5.2",
      },
      sharpe: {
        "1Y": "0.55",
        "3Y": "0.62",
        "5Y": "0.68",
      },
      volatility: {
        "1Y": "8.7",
        "3Y": "8.4",
        "5Y": "8.0",
      },
      ter: "1.25",
    },
  ],
};
