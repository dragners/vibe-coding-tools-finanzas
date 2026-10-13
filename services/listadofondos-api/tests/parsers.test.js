import test from "node:test";
import assert from "node:assert/strict";
import { parsePerformanceNumber, parseAccumulatedRentOnly, parseRatio } from "../src/parsers.js";
import { parseConfigYaml } from "../src/config.js";
import { readFile } from "node:fs/promises";

import {performanceHtml, ratiosHtml} from "./fixtures.js";

test("numbers preserve decimal points, commas, grouped values, signs and zero", () => {
  for (const [raw, expected] of [["1.25%", 1.25], ["1,25", 1.25], ["1.234,56%", 1234.56], ["1,234.56", 1234.56], ["−2,5", -2.5], ["0", 0]]) {
    assert.equal(parsePerformanceNumber(raw).number, expected);
  }
  for (const raw of ["-", "N/A", "12garbage", "1,2,3", "Infinity"]) assert.equal(parsePerformanceNumber(raw).number, null);
});

test("partial accumulated tables keep valid periods and use the named fund column", () => {
  assert.deepEqual(parseAccumulatedRentOnly(performanceHtml()).values, { "1M": 1.25, "3M": -2.5, "6M": 3.5, YTD: 4.5 });
  assert.deepEqual(parseAccumulatedRentOnly(performanceHtml([["1 mes", "0"]])).values, { "1M": 0 });
});

test("unrelated performance and category tables cannot be substituted for the fund", () => {
  assert.deepEqual(parseAccumulatedRentOnly(performanceHtml().replace("Rentabilidades acumuladas", "Rentabilidades anuales")).values, {});
  assert.deepEqual(parseAccumulatedRentOnly(performanceHtml().replace('<th>Rentabilidad</th>', '<th>Índice</th>')).values, {});
});

test("risk table headings retain missing periods instead of shifting three-year values into one year", () => {
  assert.deepEqual(parseRatio(ratiosHtml, ["sharpe"]), { "3Y": "0,8", "5Y": "1,1" });
  assert.deepEqual(parseRatio(ratiosHtml, ["volat"]), { "3Y": "12,2", "5Y": "15,3" });
});

test("standard YAML accepts quoted colons, multiline comments and escaped apostrophes", () => {
  const data = parseConfigYaml('funds:\n- name: "Fondo: Global"\n  comment: |\n    Dos líneas:\n    segunda línea\n  indexed: true\nplans:\n- name: \'Plan O\'\'Brien\'\n');
  assert.equal(data.funds[0].name, "Fondo: Global");
  assert.match(data.funds[0].comment, /Dos líneas:\nsegunda línea/);
  assert.equal(data.plans[0].name, "Plan O'Brien");
});

test("invalid YAML structure and field types identify the problematic entry", () => {
  for (const yaml of ['funds: wrong', 'funds:\n- isin: ES001', 'funds:\n- name: Fondo\n  isin: 123', 'funds:\n- name: Fondo\n  indexed: yes', 'funds:\n- name: Fondo\n  name: Otro']) assert.throws(() => parseConfigYaml(yaml));
});

test("the existing user configuration loads unchanged with the standard reader", async () => {
  const text = await readFile(new URL('../../../apps/listadofondos/config/fondos.yaml', import.meta.url), 'utf8');
  const data = parseConfigYaml(text);
  assert(data.funds.length > 0);
  assert(data.plans.length > 0);
});
