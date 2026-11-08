"use strict";
const crypto = require("node:crypto");

const NO_STORE = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, private, max-age=0",
  "Pragma": "no-cache",
  "Vary": "Authorization",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer"
};

function reply(statusCode, body) {
  return { statusCode, headers: NO_STORE, body: JSON.stringify(body) };
}
function matchesAccessKey(header, configured) {
  if (typeof configured !== "string" || configured.length < 20) return false;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const supplied = header.slice(7);
  if (supplied.length > 512) return false;
  const hash = value => crypto.createHash("sha256").update(value, "utf8").digest();
  return crypto.timingSafeEqual(hash(supplied), hash(configured));
}
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value ? value : null;
}
function amount(value) {
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
async function pluggy(endpoint, options) {
  const response = await fetch("https://api.pluggy.ai" + endpoint, {
    ...options,
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Pluggy HTTP " + response.status);
  return response.json();
}
async function getInvestments(env) {
  const auth = await pluggy("/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET })
  });
  if (!auth || !auth.apiKey) throw new Error("Pluggy authentication failed");
  const investments = [];
  for (let page = 1; page <= 20; page++) {
    const query = new URLSearchParams({ itemId: env.PLUGGY_ITEM_ID, page: String(page), pageSize: "500" });
    const result = await pluggy("/investments?" + query.toString(), {
      headers: { "X-API-KEY": auth.apiKey }
    });
    if (!Array.isArray(result.results)) throw new Error("Unexpected investments response");
    investments.push(...result.results);
    if (!result.totalPages || page >= result.totalPages) break;
    if (page === 20) throw new Error("Investment pagination limit exceeded");
  }
  // The investment balance is NET of tax/fees. Do not include checking,
  // savings/current accounts, credit card limits or withdrawn/pending positions.
  const active = investments.filter(position =>
    position && position.currencyCode === "BRL" &&
    (position.status == null || position.status === "ACTIVE") &&
    typeof position.balance === "number" && Number.isFinite(position.balance)
  );
  if (!active.length) return { bankState: "empty", balance: null };
  const sum = Math.round(active.reduce((total, position) => total + position.balance, 0) * 100) / 100;
  return { bankState: "ok", balance: sum };
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") return reply(405, { message: "Método não permitido." });
  const env = process.env;
  const authorization = event.headers && (event.headers.authorization || event.headers.Authorization);
  if (!matchesAccessKey(authorization, env.COUNTDOWN_VIEW_KEY)) {
    return reply(401, { message: "Acesso não autorizado." });
  }
  const missing = [];
  const surgeryDate = validDate(env.RHINO_DATE);
  const goal = amount(env.RHINO_GOAL_BRL);
  if (!surgeryDate) missing.push("RHINO_DATE");
  if (goal === null) missing.push("RHINO_GOAL_BRL");
  for (const key of ["PLUGGY_CLIENT_ID", "PLUGGY_CLIENT_SECRET", "PLUGGY_ITEM_ID"]) {
    if (!env[key]) missing.push(key);
  }
  const result = { surgeryDate, goal, balance: null, bankState: "needs_setup", missing };
  if (missing.some(key => key.startsWith("PLUGGY_"))) return reply(200, result);
  try {
    return reply(200, { ...result, ...(await getInvestments(env)) });
  } catch (_) {
    return reply(200, { ...result, bankState: "error",
      message: "Falha ao consultar investimentos. Confira o acesso do Meu Pluggy e a permissão de investimentos." });
  }
};

exports._test = { matchesAccessKey, validDate, amount, getInvestments };
