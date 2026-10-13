import { describe, expect, it } from "vitest";
import { validatePayload } from "../src/payload";
import { MOCK_PAYLOAD } from "../src/mockData";

describe("API payload validation", () => {
  it("accepts valid data, partial metrics and optional identifiers", () => {
    expect(validatePayload(MOCK_PAYLOAD).funds.length).toBe(MOCK_PAYLOAD.funds.length);
    const fund = { ...MOCK_PAYLOAD.funds[0], morningstarId: null, performance: {}, isStale: true };
    expect(validatePayload({ ...MOCK_PAYLOAD, funds: [fund] }).funds[0]).toMatchObject({ morningstarId: "", isStale: true, performance: {} });
  });
  it.each([
    { lastUpdated: "not-a-date" }, { funds: null }, { plans: {} }, { isUpdating: "yes" },
    { funds: [{ ...MOCK_PAYLOAD.funds[0], name: {} }] },
    { funds: [{ ...MOCK_PAYLOAD.funds[0], performance: [] }] },
    { funds: [{ ...MOCK_PAYLOAD.funds[0], volatility: { "1Y": { value: [] } } }] },
    { funds: [{ ...MOCK_PAYLOAD.funds[0], dataUpdatedAt: "invalid" }] },
  ])("rejects malformed data before it can crash the table: %j", (change) => {
    expect(() => validatePayload({ ...MOCK_PAYLOAD, ...change })).toThrow();
  });
});
