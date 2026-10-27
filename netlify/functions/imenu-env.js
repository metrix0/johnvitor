const { createHash, timingSafeEqual } = require("node:crypto");
const scopes = ["staging", "staging-build", "production", "production-build"];
const reply = (statusCode, data) => ({ statusCode, headers: {"Content-Type":"application/json", "Cache-Control":"no-store", "X-Content-Type-Options":"nosniff"}, body:JSON.stringify(data) });
exports.handler = async event => {
  if (event.httpMethod !== "POST") return reply(405,{error:"Method not allowed."});
  const origin = event.headers?.origin;
  if (origin && !["https://johnvitor.com","https://www.johnvitor.com"].includes(origin)) return reply(403,{error:"Forbidden."});
  const password = process.env.IMENU_ENV_PASSWORD;
  if (!password || password.length < 32) return reply(503,{error:"Set IMENU_ENV_PASSWORD in Netlify (at least 32 characters)."});
  if (!event.body || Buffer.byteLength(event.body)>20000) return reply(400,{error:"Invalid request."});
  let body;
  try { body=JSON.parse(event.body); } catch { return reply(400,{error:"Invalid request."}); }
  if (!body || typeof body !== "object") return reply(400,{error:"Invalid request."});
  const hash = value => createHash("sha256").update(value).digest();
  if (typeof body.password!=="string" || !timingSafeEqual(hash(body.password),hash(password))) return reply(401,{error:"Wrong environment password."});
  if (!scopes.includes(body.scope) || !["list","set","delete"].includes(body.action)) return reply(400,{error:"Invalid operation."});
  if (body.action!=="list" && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(body.key||"")) return reply(400,{error:"Invalid variable name."});
  if (body.action==="set" && (typeof body.value!=="string" || Buffer.byteLength(body.value)>8192 || /[\x00\r\n']/.test(body.value))) return reply(400,{error:"Use a single-line value without apostrophes (required by the VPS deployment format)."});
  if (body.action!=="list" && body.confirm!==true) return reply(400,{error:"Confirmation required."});
  if (!process.env.IMENU_VPS_PASSWORD) return reply(503,{error:"Set IMENU_VPS_PASSWORD in Netlify."});
  const args={scope:body.scope,action:body.action};
  if(body.action!=="list") args.key=body.key;
  if(body.action==="set") args.value=body.value;
  try {
    const response=await fetch("https://api-vps-stage.imenuapp.com.br/deploy-mcp/mcp",{
      method:"POST", headers:{"Content-Type":"application/json","Authorization":"Basic "+Buffer.from("imenu_deploy:"+process.env.IMENU_VPS_PASSWORD).toString("base64")},
      body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/call",params:{name:"manage_environment",arguments:args}}),
      signal:AbortSignal.timeout(12000)
    });
    if(!response.ok) throw new Error();
    const rpc=await response.json();
    if(rpc.error || rpc.result?.isError) throw new Error();
    const result=JSON.parse(rpc.result.content.find(c=>c.type==="text").text);
    if(body.action==="list") {
      if(!Array.isArray(result.keys)) throw new Error();
      return reply(200,{ok:true,keys:result.keys.filter(k=>typeof k==="string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(k))});
    }
    if(result.ok!==true) throw new Error();
    return reply(200,{ok:true});
  } catch { return reply(502,{error:"VPS operation failed. Check VPS credentials and handler configuration; refresh keys before retrying a change."}); }
};
