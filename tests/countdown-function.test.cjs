"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { handler, _test } = require("../netlify/functions/countdown.js");
const secret = "test-only-private-access-token-long-enough";
const original = { ...process.env };
const originalFetch = global.fetch;
const request = (key, method = "GET", queryStringParameters) => ({
  httpMethod: method, headers: { authorization: "Bearer " + key }, queryStringParameters
});
const body = response => JSON.parse(response.body);
test.after(() => { process.env = original; global.fetch = originalFetch; });
function env() {
  Object.assign(process.env, {
    COUNTDOWN_VIEW_KEY: secret, PLUGGY_CLIENT_ID: "id", PLUGGY_CLIENT_SECRET: "secret",
    PLUGGY_ITEM_ID: "c6-item", RHINO_DATE: "2034-07-16", RHINO_GOAL_BRL: "15000"
  });
}
function mockInvestments(pages) {
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push(String(url));
    if (String(url).endsWith("/auth")) return { ok: true, json: async () => ({ apiKey: "temporary-test-only" }) };
    const u = new URL(String(url));
    assert.equal(u.pathname, "/investments");
    assert.equal(u.searchParams.get("itemId"), "c6-item");
    assert.equal(options.headers["X-API-KEY"], "temporary-test-only");
    const page = Number(u.searchParams.get("page"));
    return { ok: true, json: async () => ({ results: pages[page - 1] || [], totalPages: pages.length }) };
  };
  return calls;
}
test("requires access key without exposing financial data", async () => {
  env();
  assert.equal((await handler({ httpMethod: "GET", headers: {} })).statusCode, 401);
  assert.equal((await handler(request("bad"))).statusCode, 401);
  assert.equal((await handler({ httpMethod: "POST", headers: {} })).statusCode, 405);
});
test("rejects weak configured access keys", async () => {
  env(); process.env.COUNTDOWN_VIEW_KEY = "weak";
  assert.equal((await handler(request("weak"))).statusCode, 401);
});
test("checks surgery date and goal", () => {
  assert.equal(_test.validDate("2031-02-29"), null);
  assert.equal(_test.validDate("2032-02-29"), "2032-02-29");
  assert.equal(_test.amount("0"), null);
  assert.equal(_test.amount("15000.50"), 15000.5);
});
test("setup is reported without contacting Pluggy", async () => {
  env();
  delete process.env.PLUGGY_ITEM_ID;
  global.fetch = () => { throw new Error("unexpected fetch"); };
  const result = body(await handler(request(secret)));
  assert.equal(result.bankState, "needs_setup");
  assert.ok(result.missing.includes("PLUGGY_ITEM_ID"));
});
test("sums active net investments only, excluding checking accounts, cards, withdrawn, pending and foreign positions", async () => {
  env();
  const calls = mockInvestments([
    [
      { id: "a", type: "FIXED_INCOME", currencyCode: "BRL", status: "ACTIVE", balance: 3600.11, amount: 3800 },
      { id: "b", type: "ETF", currencyCode: "BRL", status: "ACTIVE", balance: 2100.22 },
      { id: "c", type: "MUTUAL_FUND", currencyCode: "BRL", status: "PENDING", balance: 500 },
      { id: "d", type: "EQUITY", currencyCode: "BRL", status: "TOTAL_WITHDRAWAL", balance: 900 },
      { id: "e", type: "ETF", currencyCode: "USD", status: "ACTIVE", balance: 600 },
      { id: "f", type: "FIXED_INCOME", currencyCode: "BRL", status: "ACTIVE", balance: null }
    ],
    [{ id: "g", type: "FIXED_INCOME", currencyCode: "BRL", status: "ACTIVE", balance: 299.67 }]
  ]);
  const response = await handler(request(secret)), result = body(response);
  assert.equal(result.bankState, "ok");
  assert.equal(result.balance, 6000);
  assert.equal(result.goal, 15000);
  assert.equal(calls.filter(u => u.includes("/investments?")).length, 2);
  assert.equal(calls.some(u => u.includes("/accounts?")), false);
  assert.equal(response.headers["Cache-Control"].includes("no-store"), true);
});
test("reports missing investment data instead of substituting checking balance or zero", async () => {
  env(); mockInvestments([[]]);
  const result = body(await handler(request(secret)));
  assert.equal(result.bankState, "empty");
  assert.equal(result.balance, null);
});
test("reports Pluggy failures without leaking credentials", async () => {
  env(); global.fetch = async () => ({ ok: false, status: 403 });
  const response = await handler(request(secret));
  assert.equal(body(response).bankState, "error");
  assert.equal(response.body.includes("secret"), false);
});

test("manual refresh requires authentication and calls Pluggy PATCH without exposing credentials", async () => {
  env();
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/auth")) return { ok: true, json: async () => ({ apiKey: "test-key" }) };
    assert.equal(String(url), "https://api.pluggy.ai/items/c6-item");
    assert.equal(options.method, "PATCH");
    assert.equal(options.headers["X-API-KEY"], "test-key");
    assert.equal(options.body, "{}");
    return { ok: true, json: async () => ({ status: "UPDATING" }) };
  };
  assert.equal((await handler(request("bad", "POST"))).statusCode, 401);
  assert.equal(calls.length, 0);
  const response = await handler(request(secret, "POST"));
  assert.equal(response.statusCode, 202);
  assert.equal(body(response).refreshState, "started");
  assert.equal(calls.length, 2);
  assert.equal(response.body.includes("test-key"), false);
});
test("polling Pluggy item status distinguishes completion and in-progress updates", async () => {
  env();
  let current = "UPDATING";
  global.fetch = async (url, options) => {
    if (String(url).endsWith("/auth")) return { ok: true, json: async () => ({ apiKey: "test-key" }) };
    assert.equal(String(url), "https://api.pluggy.ai/items/c6-item");
    assert.equal(options.headers["X-API-KEY"], "test-key");
    return { ok: true, json: async () => ({ status: current }) };
  };
  const poll = () => handler(request(secret, "GET", { syncStatus: "1" }));
  assert.equal(body(await poll()).syncState, "pending");
  current = "UPDATED";
  assert.equal(body(await poll()).syncState, "completed");
  current = "LOGIN_ERROR";
  assert.equal(body(await poll()).syncState, "error");
});
test("Pluggy refresh frequency limit is displayed as a safe user message", async () => {
  env();
  global.fetch = async url => {
    if (String(url).endsWith("/auth")) return { ok: true, json: async () => ({ apiKey: "test-key" }) };
    return { ok: false, status: 409, json: async () => ({ codeDescription: "CLIENT_IS_UPDATING_BEFORE_ALLOWED_FREQUENCY" }) };
  };
  const response = await handler(request(secret, "POST"));
  assert.equal(response.statusCode, 429);
  assert.match(body(response).message, /Aguarde/);
  assert.equal(response.body.includes("secret"), false);
});
