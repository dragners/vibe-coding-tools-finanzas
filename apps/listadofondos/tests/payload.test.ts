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

it("accepts older responses without Sortino and validates new Sortino values", () => {
  const { sortino, ...olderFund } = MOCK_PAYLOAD.funds[0];
  expect(validatePayload({ ...MOCK_PAYLOAD, funds: [olderFund] }).funds[0].sortino).toEqual({});
  const fund = { ...olderFund, sortino: { '1Y': 0, '3Y': '-1,4', '5Y': null } };
  expect(validatePayload({ ...MOCK_PAYLOAD, funds: [fund] }).funds[0].sortino).toEqual(fund.sortino);
  expect(() => validatePayload({ ...MOCK_PAYLOAD, funds: [{ ...fund, sortino: [] }] })).toThrow('Invalid sortino metrics');
});


it("accepts inception years and older payloads without them, while rejecting malformed years", () => {
  expect(validatePayload(MOCK_PAYLOAD).funds[0].inceptionYear).toBeUndefined();
  for (const inceptionYear of [1995, 2026, null]) {
    expect(validatePayload({ ...MOCK_PAYLOAD, funds: [{ ...MOCK_PAYLOAD.funds[0], inceptionYear }] }).funds[0].inceptionYear).toBe(inceptionYear);
  }
  for (const inceptionYear of ['2015', 0, 2020.5, {}, NaN, Infinity, 10000]) {
    expect(() => validatePayload({ ...MOCK_PAYLOAD, funds: [{ ...MOCK_PAYLOAD.funds[0], inceptionYear }] })).toThrow('Invalid inception year');
  }
});
