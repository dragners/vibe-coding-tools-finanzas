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
  assert.deepEqual(next.funds[0].volatility, first.funds[0].volatility);
  assert.equal(next.funds[0].metricUpdatedAt.sharpe['3Y'], '2026-10-13T08:00:00.000Z');
  assert.equal(next.funds[0].metricUpdatedAt.performance['1M'], '2026-10-13T09:00:00.000Z');
  assert.equal(next.funds[0].isStale, true);
  assert.deepEqual(next.funds[0].updateErrors, ['sharpe', 'volatility']);
});

test("a total fetch failure retains all previous figures and their actual date", async (t) => {
  let fail = false;
  const service = await setup(t, async (url) => { if (fail) throw new Error('offline'); return goodHtml(url); });
  const old = await service.startRefresh(); fail = true;
  service.setTime('2026-10-13T13:00:00Z');
  const next = await service.startRefresh();
  for (const key of ['performance', 'sharpe', 'volatility', 'ter']) assert.deepEqual(next.funds[0][key], old.funds[0][key]);
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
