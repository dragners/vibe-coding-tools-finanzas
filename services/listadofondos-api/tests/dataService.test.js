import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";
import { createDataService } from "../src/dataService.js";
import { createApiServer } from "../src/server.js";
import { performanceHtml, ratiosHtml, feesHtml } from "./fixtures.js";

async function setup(t, fetchHtml, yaml = 'funds:\n- name: Fondo\n  isin: ES001\n  morningstarId: F001\nplans: []') {
  const directory = await mkdtemp(path.join(tmpdir(), 'listado-api-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const configPath = path.join(directory, 'fondos.yaml');
  const cacheFile = path.join(directory, 'cache.json');
  await writeFile(configPath, yaml);
  let time = new Date('2026-10-13T08:00:00Z');
  const service = createDataService({ configPath, cacheFile, fetchHtml, now: () => time });
  return { ...service, configPath, cacheFile, setTime: (value) => { time = new Date(value); } };
}
const goodHtml = async (url) => url.includes('tab=1') ? performanceHtml() : url.includes('tab=2') ? ratiosHtml : feesHtml;

test("one failed source preserves older risk metrics while updating returns and fees", async (t) => {
  let riskFails = false;
  const service = await setup(t, async (url) => {
    if (riskFails && url.includes('tab=2')) throw new Error('timeout');
    return goodHtml(url);
  });
  const first = await service.startRefresh();
  riskFails = true;
  service.setTime('2026-10-13T09:00:00Z');
  const next = await service.startRefresh();
  assert.deepEqual(next.funds[0].sharpe, first.funds[0].sharpe);
  assert.deepEqual(next.funds[0].sortino, first.funds[0].sortino);
  assert.equal(next.funds[0].metricUpdatedAt.sortino['3Y'], '2026-10-13T08:00:00.000Z');
  assert.deepEqual(next.funds[0].volatility, first.funds[0].volatility);
  assert.equal(next.funds[0].metricUpdatedAt.sharpe['3Y'], '2026-10-13T08:00:00.000Z');
  assert.equal(next.funds[0].metricUpdatedAt.performance['1M'], '2026-10-13T09:00:00.000Z');
  assert.equal(next.funds[0].isStale, true);
  assert.deepEqual(next.funds[0].updateErrors, ['sharpe', 'sortino', 'volatility']);
});

test("a total fetch failure retains all previous figures and their actual date", async (t) => {
  let fail = false;
  const service = await setup(t, async (url) => { if (fail) throw new Error('offline'); return goodHtml(url); });
  const old = await service.startRefresh(); fail = true;
  service.setTime('2026-10-13T13:00:00Z');
  const next = await service.startRefresh();
  for (const key of ['performance', 'sharpe', 'sortino', 'volatility', 'ter']) assert.deepEqual(next.funds[0][key], old.funds[0][key]);
  assert.equal(next.funds[0].dataUpdatedAt, old.funds[0].dataUpdatedAt);
  assert.equal(next.funds[0].isStale, true);
});

test("partial metric parsing retains previously available periods and zero remains valid", async (t) => {
  let partial = false;
  const service = await setup(t, (url) => url.includes('tab=1') && partial ? performanceHtml([['1 mes', '0']]) : goodHtml(url));
  await service.startRefresh(); partial = true;
  const next = await service.startRefresh();
  assert.equal(next.funds[0].performance['1M'], 0);
  assert.equal(next.funds[0].performance['3M'], -2.5);
  assert.equal(next.funds[0].isStale, true);
});

test("correcting a MorningstarId never reuses figures fetched from the old incorrect identifier", async (t) => {
  let fail = false;
  const service = await setup(t, async (url) => { if (fail) throw new Error('offline'); return goodHtml(url); });
  await service.startRefresh();
  await writeFile(service.configPath, 'funds:\n- name: Fondo\n  isin: ES001\n  morningstarId: F002\nplans: []');
  fail = true;
  const next = await service.startRefresh();
  assert.deepEqual(next.funds[0].performance, {});
  assert.equal(next.funds[0].morningstarId, 'F002');
  assert.equal(next.funds[0].isStale, true);
});

test("invalid edited configuration cannot overwrite the good cache", async (t) => {
  const service = await setup(t, goodHtml); await service.startRefresh();
  const before = await readFile(service.cacheFile, 'utf8');
  await writeFile(service.configPath, 'funds: incorrect');
  await assert.rejects(service.startRefresh());
  assert.equal(await readFile(service.cacheFile, 'utf8'), before);
});

test("concurrent callers share one refresh and updated cache clears isUpdating", async (t) => {
  let release; let delay = false; let requests = 0;
  const barrier = new Promise((resolve) => { release = resolve; });
  const service = await setup(t, async (url) => { requests++; if (delay) await barrier; return goodHtml(url); });
  await service.startRefresh(); delay = true;
  service.setTime('2026-10-13T14:00:00Z');
  const old = await service.getData(); assert.equal(old.isUpdating, true);
  const a = service.startRefresh(), b = service.startRefresh(); assert.equal(a, b);
  release(); await a;
  assert.equal(requests, 6);
  assert.equal((await service.getData()).isUpdating, false);
});

test("a failed refresh stops the updating flag, retains good data and permits explicit retry", async (t) => {
  const service = await setup(t, goodHtml);
  await service.startRefresh();
  service.setTime('2026-10-13T14:00:00Z');
  await writeFile(service.configPath, 'funds: incorrect');
  await assert.rejects(service.startRefresh());
  const kept = await service.getData();
  assert.equal(kept.isUpdating, false);
  assert.equal(kept.updateFailed, true);
  assert.equal(kept.funds[0].performance['1M'], 1.25);
  await writeFile(service.configPath, 'funds:\n- name: Fondo\n  isin: ES001\n  morningstarId: F001\nplans: []');
  await service.startRefresh();
  assert.equal((await service.getData()).updateFailed, undefined);
});

test("refresh limits parallel work and preserves configured row order", async (t) => {
  let active = 0, peak = 0;
  const yaml = 'funds:\n' + Array.from({ length: 8 }, (_, i) => `- name: Fondo ${i}\n  isin: ES00${i}\n  morningstarId: F00${i}\n`).join('') + 'plans: []';
  const service = await setup(t, async (url) => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setImmediate(resolve));
    active--; return goodHtml(url);
  }, yaml);
  const data = await service.startRefresh();
  assert(peak <= 12);
  assert.deepEqual(data.funds.map(fund => fund.name), Array.from({ length: 8 }, (_, i) => `Fondo ${i}`));
});

test("API data, health and error responses cannot be cached", async (t) => {
  const server = createApiServer({ getData: async () => ({ isUpdating: true }), startRefresh: async () => { throw new Error('unavailable'); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [route, method, expected] of [['data', 'GET', 200], ['health', 'GET', 200], ['refresh', 'POST', 500]]) {
    const response = await fetch(`${base}/listadofondos/api/${route}`, { method });
    assert.equal(response.status, expected);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    await response.text();
  }
});


test("pension plans with unpublished costs do not show an update error", async (t) => {
  const service = await setup(t, (url) => url.includes('tab=5') ? feesHtml.replace('0,3%', '-%') : goodHtml(url), 'funds: []\nplans:\n- name: Plan\n  isin: N5263\n  morningstarId: F001');
  const { plans: [plan] } = await service.startRefresh();
  assert.equal(plan.ter, '-');
  assert.equal(plan.isStale, false);
  assert.deepEqual(plan.updateErrors, []);
  assert.equal(plan.metricUpdatedAt.ter, undefined);
});

test("a recent fund without enough history has unpublished risk metrics, not an update failure", async (t) => {
  const service = await setup(t, (url) => url.includes('tab=2') ? ratiosHtml.replace(/(?:0,8|1,1|1,4|1,8|12,2|15,3)/g, '-') : goodHtml(url));
  const { funds: [fund] } = await service.startRefresh();
  assert.deepEqual(fund.sharpe, {});
  assert.deepEqual(fund.sortino, {});
  assert.deepEqual(fund.volatility, {});
  assert.equal(fund.ter, '0,3%');
  assert.equal(fund.isStale, false);
});

test("a successful page containing unpublished returns does not show an update error", async (t) => {
  const service = await setup(t, (url) => url.includes('tab=1') ? performanceHtml([['1 mes', '-'], ['3 meses', '-']]) : goodHtml(url));
  const { funds: [fund] } = await service.startRefresh();
  assert.deepEqual(fund.performance, {});
  assert.equal(fund.isStale, false);
});

test("unpublished replacements retain previously published costs and flag them as stale", async (t) => {
  let unavailable = false;
  const service = await setup(t, (url) => url.includes('tab=5') && unavailable ? feesHtml.replace('0,3%', '-%') : goodHtml(url));
  await service.startRefresh(); unavailable = true;
  service.setTime('2026-10-13T09:00:00Z');
  const { funds: [fund] } = await service.startRefresh();
  assert.equal(fund.ter, '0,3%');
  assert.equal(fund.metricUpdatedAt.ter, '2026-10-13T08:00:00.000Z');
  assert.deepEqual(fund.updateErrors, ['ter']);
});

test("HTTP failures and unrecognizable successful pages remain failures without cached figures", async (t) => {
  for (const fails of [true, false]) {
    const service = await setup(t, async (url) => {
      if (url.includes('tab=2') || url.includes('tab=5')) {
        if (fails) throw new Error('timeout');
        return '<html>Access denied</html>';
      }
      return goodHtml(url);
    });
    const { funds: [fund] } = await service.startRefresh();
    assert.equal(fund.isStale, true);
    assert.deepEqual(fund.updateErrors, ['sharpe', 'sortino', 'volatility', 'ter']);
  }
});

test("Sortino shares the Sharpe request and preserves a missing period with its original date", async (t) => {
  let partial = false;
  const requests = [];
  const service = await setup(t, async url => {
    requests.push(url);
    if (partial && url.includes('tab=2')) return ratiosHtml.replace('<td>1,4</td><td>1,8</td>', '<td>0</td><td>-</td>');
    return goodHtml(url);
  });
  const initial = await service.startRefresh();
  assert.deepEqual(initial.funds[0].sortino, { '3Y': '1,4', '5Y': '1,8' });
  assert.equal(requests.length, 3);
  assert.equal(requests.filter(url => url.includes('tab=2')).length, 1);
  partial = true;
  service.setTime('2026-10-13T09:00:00Z');
  const { funds: [fund] } = await service.startRefresh();
  assert.deepEqual(fund.sortino, { '3Y': '0', '5Y': '1,8' });
  assert.deepEqual(fund.metricUpdatedAt.sortino, { '3Y': '2026-10-13T09:00:00.000Z', '5Y': '2026-10-13T08:00:00.000Z' });
  assert.deepEqual(fund.updateErrors, ['sortino']);
});

test("a recent cache without Sortino refreshes automatically and retains its existing figures", async (t) => {
  let release; let delay = false;
  const barrier = new Promise(resolve => { release = resolve; });
  const service = await setup(t, async url => { if (delay) await barrier; return goodHtml(url); });
  const initial = await service.startRefresh();
  delete initial.funds[0].sortino;
  delete initial.funds[0].metricUpdatedAt.sortino;
  await writeFile(service.cacheFile, JSON.stringify(initial));
  delay = true;
  const cached = await service.getData();
  assert.equal(cached.isUpdating, true);
  assert.deepEqual(cached.funds[0].performance, initial.funds[0].performance);
  const refresh = service.startRefresh();
  release(); await refresh;
  const updated = await service.getData();
  assert.equal(updated.isUpdating, false);
  assert.deepEqual(updated.funds[0].sortino, { '3Y': '1,4', '5Y': '1,8' });
});


test("inception year shares existing requests, falls back to another page, and preserves the previous year on failure", async (t) => {
  let fail = false; let requests = 0;
  const service = await setup(t, async (url) => {
    requests++;
    if (fail) throw new Error('offline');
    return (await goodHtml(url)) + (url.includes('tab=2') ? '<table><tr><td>Fecha Creación</td><td>23/10/2015</td></tr></table>' : '');
  });
  const first = await service.startRefresh();
  assert.equal(requests, 3);
  assert.equal(first.funds[0].inceptionYear, 2015);
  fail = true;
  const stale = await service.startRefresh();
  assert.equal(stale.funds[0].inceptionYear, 2015);
  await writeFile(service.configPath, 'funds:\n- name: Fondo\n  isin: ES001\n  morningstarId: CORRECTED\nplans: []');
  const corrected = await service.startRefresh();
  assert.equal(corrected.funds[0].inceptionYear, null);
});

test("an older cache gains inception year once; unpublished dates do not repeatedly refresh or mark products stale", async (t) => {
  let requests = 0;
  const service = await setup(t, async url => { requests++; return goodHtml(url); });
  const initial = await service.startRefresh();
  delete initial.funds[0].inceptionYear;
  await writeFile(service.cacheFile, JSON.stringify(initial));
  const cached = await service.getData();
  assert.equal(cached.isUpdating, true);
  await service.startRefresh();
  assert.equal(requests, 6);
  const updated = await service.getData();
  assert.equal(updated.isUpdating, false);
  assert.equal(updated.funds[0].inceptionYear, null);
  assert.equal(updated.funds[0].isStale, false);
  assert.equal(requests, 6);
});
