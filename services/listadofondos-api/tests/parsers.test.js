import test from "node:test";
import assert from "node:assert/strict";
import { parsePerformanceNumber, parseAccumulatedRentOnly, parseRatio, parseRatioResult, parseTer, parseTerResult } from "../src/parsers.js";
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


test("ongoing expenses use the adjacent KID value, never management or neighboring fees", () => {
  const html = '<table><tr><td>Comisión de gestión</td><td>1,2%</td></tr><tr><td>KID Gastos Corrientes</td><td>0,83%</td><td>Comisión de éxito</td><td>9%</td></tr></table>';
  assert.equal(parseTer(html), "0,83%");
  assert.equal(parseTer(html.replace('0,83%', '0%')), "0%");
  assert.equal(parseTer(html.replace('0,83%', '0.75%')), "0.75%");
  assert.equal(parseTer('<table><tr><td>Comisión de gestión</td><td>1,2%</td></tr></table>'), "-");
});

test("explicit ongoing costs take priority over TER without replacing unpublished KID expenses", () => {
  const html = '<table><tr><td>TER</td><td>1,5%</td></tr><tr><td>KID Gastos Corrientes</td><td>0,62%</td><td></td><td></td></tr></table>';
  assert.equal(parseTer(html), "0,62%");
  assert.deepEqual(parseTerResult(html.replace('0,62%', '-%')), { value: "-", status: "unavailable" });
  for (const label of ['TER', 'Ratio de gastos', 'Gastos Corrientes', 'Ongoing Charges', 'Total Expense Ratio']) {
    assert.equal(parseTer(`<table><tr><td>${label}</td><td>0,75%</td></tr></table>`), "0,75%");
  }
});

test("unpublished placeholders differ from malformed or absent metric sections", () => {
  const unavailableRisk = ratiosHtml.replace(/(?:0,8|1,1|12,2|15,3)/g, '-');
  assert.deepEqual(parseRatioResult(unavailableRisk, ['sharpe']), { values: {}, status: "unavailable" });
  assert.equal(parseAccumulatedRentOnly(performanceHtml([['1 mes', '-']])).debug.status, "unavailable");
  assert.equal(parseAccumulatedRentOnly('<html>Access denied</html>').debug.status, "error");
  assert.equal(parseRatioResult('<html>Access denied</html>', ['sharpe']).status, "error");
  assert.equal(parseRatioResult(ratiosHtml.replace('0,8', 'invalid'), ['sharpe']).status, "error");
  for (const html of ['<html>Access denied</html>', '<table><tr><td>KID Gastos Corrientes</td></tr></table>', '<table><tr><td>KID Gastos Corrientes</td><td>invalid</td></tr></table>']) {
    assert.equal(parseTerResult(html).status, "error");
  }
});

test("Sortino follows its period headings and never borrows Sharpe or volatility", () => {
  assert.deepEqual(parseRatioResult(ratiosHtml, ['sortino']), { values: { '3Y': '1,4', '5Y': '1,8' }, status: 'available' });
  const withoutSortino = ratiosHtml.replace(/<tr><td>Ratio de Sortino<\/td>.*?<\/tr>/, '');
  assert.deepEqual(parseRatioResult(withoutSortino, ['sortino']), { values: {}, status: 'error' });
  const html = '<table><tr><th>Medida</th><th>5 años</th><th>1 año</th><th>3 años</th></tr><tr><td>Ratio de Sortino</td><td>-</td><td>0</td><td>-1,4</td></tr></table>';
  assert.deepEqual(parseRatioResult(html, ['sortino']), { values: { '1Y': '0', '3Y': '-1,4' }, status: 'available' });
  assert.deepEqual(parseRatioResult(html.replace('<td>0</td>', '<td>-</td>').replace('-1,4', '-'), ['sortino']), { values: {}, status: 'unavailable' });
});

test("text fallback extracts Sortino independently from the other risk measures", () => {
  const html = '<h2>Análisis de Rentabilidad/Riesgo</h2><p>Volatilidad 12,2 13,4 15,3</p><p>Ratio de Sharpe 0,5 0,8 1,1</p><p>Ratio de Sortino 0 1,4 -1,8</p>';
  assert.deepEqual(parseRatioResult(html, ['sortino']), { values: { '1Y': '0', '3Y': '1,4', '5Y': '-1,8' }, status: 'available' });
  assert.equal(parseRatioResult(html.replace(/<p>Ratio de Sortino.*?<\/p>/, ''), ['sortino']).status, 'error');
});

test("Horos Internacional PP keeps its own MorningstarId, distinct from the investment fund", async () => {
  const text = await readFile(new URL('../../../apps/listadofondos/config/fondos.yaml', import.meta.url), 'utf8');
  const config = parseConfigYaml(text);
  const plan = config.plans.find(product => product.isin === 'N5263');
  const fund = config.funds.find(product => product.isin === 'ES0146309002');
  assert.equal(plan?.morningstarId, 'F000010RWV');
  assert.equal(fund?.morningstarId, 'F000010KY6');
  assert.notEqual(plan.morningstarId, fund.morningstarId);
});
