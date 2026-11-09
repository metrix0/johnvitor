"use strict";
const crypto = require("node:crypto");

const NO_STORE = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, private, max-age=0",
  "Pragma": "no-cache",
  "Vary": "Authorization",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Countdown-Sync-Mode": "pluggy-connect"
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
  if (!response.ok) {
    const error = new Error("Pluggy HTTP " + response.status);
    error.status = response.status;
    if (options && options.method === "PATCH") {
      const data = await response.json().catch(() => ({}));
      error.code = typeof data.codeDescription === "string" ? data.codeDescription :
        (data.error && typeof data.error.code === "string" ? data.error.code : null);
    }
    throw error;
  }
  return response.json();
}
async function getPluggyApiKey(env) {
  const auth = await pluggy("/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET })
  });
  if (!auth || !auth.apiKey) throw new Error("Pluggy authentication failed");
  return auth.apiKey;
}
async function getInvestments(env) {
  const apiKey = await getPluggyApiKey(env);
  const investments = [];
  for (let page = 1; page <= 20; page++) {
    const query = new URLSearchParams({ itemId: env.PLUGGY_ITEM_ID, page: String(page), pageSize: "500" });
    const result = await pluggy("/investments?" + query.toString(), {
      headers: { "X-API-KEY": apiKey }
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
  if (!["GET", "POST"].includes(event.httpMethod)) return reply(405, { message: "Método não permitido." });
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
  const pluggyMissing = missing.some(key => key.startsWith("PLUGGY_"));
  if (event.httpMethod === "POST") {
    if (pluggyMissing) return reply(503, { message: "Integração Pluggy não configurada." });
    // Manual updates use Pluggy Connect. A direct PATCH /items/{id} can be
    // rejected with HTTP 400 (required bank parameters/MFA or plan limits).
    // A scoped Connect token lets the official widget update this same Item
    // without duplicating the bank connection.
    try {
      const apiKey = await getPluggyApiKey(env);
      const token = await pluggy("/connect_token", {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: env.PLUGGY_ITEM_ID })
      });
      if (!token || typeof token.accessToken !== "string" || !token.accessToken) {
        throw new Error("Missing Connect accessToken");
      }
      return reply(200, {
        refreshState: "connect_required",
        connectToken: token.accessToken,
        itemId: env.PLUGGY_ITEM_ID
      });
    } catch (error) {
      console.warn("Pluggy Connect token request failed", { status: error.status || null, code: error.code || null });
      if (error.status === 401 || error.status === 403) {
        return reply(502, { message: "A Pluggy recusou a autenticação da integração." });
      }
      if (error.status === 404) {
        return reply(404, { message: "Conexão bancária não encontrada. Verifique o Item configurado." });
      }
      if (error.status === 429) {
        return reply(429, { message: "A Pluggy está limitando solicitações. Tente novamente em instantes." });
      }
      return reply(502, { message: "Não foi possível abrir a atualização do Pluggy. Tente novamente." });
    }
  }
  if (event.queryStringParameters && event.queryStringParameters.syncStatus === "1") {
    if (pluggyMissing) return reply(503, { message: "Integração Pluggy não configurada." });
    try {
      const apiKey = await getPluggyApiKey(env);
      const item = await pluggy("/items/" + encodeURIComponent(env.PLUGGY_ITEM_ID), {
        headers: { "X-API-KEY": apiKey }
      });
      const syncState = item.status === "UPDATED" ? "completed" :
        ["OUTDATED", "LOGIN_ERROR", "WAITING_USER_INPUT"].includes(item.status) ? "error" : "pending";
      return reply(200, { syncState, ...(syncState === "error" ? { message: "A sincronização precisa de atenção no Meu Pluggy." } : {}) });
    } catch (_) {
      return reply(502, { message: "Não foi possível verificar a sincronização no Pluggy." });
    }
  }
  if (pluggyMissing) return reply(200, result);
  try {
    return reply(200, { ...result, ...(await getInvestments(env)) });
  } catch (_) {
    return reply(200, { ...result, bankState: "error",
      message: "Falha ao consultar investimentos. Confira o acesso do Meu Pluggy e a permissão de investimentos." });
  }
};

exports._test = { matchesAccessKey, validDate, amount, getInvestments };
