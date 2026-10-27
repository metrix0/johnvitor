const {test}=require("node:test");
const assert=require("node:assert/strict");
const {handler}=require("../netlify/functions/imenu-env");
test("environment API fails closed and forwards only scoped operations",async()=>{
 const oldFetch=global.fetch, oldPassword=process.env.IMENU_ENV_PASSWORD, oldVps=process.env.IMENU_VPS_PASSWORD;
 let calls=0;
 const event=body=>({httpMethod:"POST",headers:{origin:"https://johnvitor.com"},body:JSON.stringify(body)});
 const password="a-private-password-of-at-least-32-characters";
 try {
  delete process.env.IMENU_ENV_PASSWORD;
  assert.equal((await handler(event({}))).statusCode,503);
  process.env.IMENU_ENV_PASSWORD=password;process.env.IMENU_VPS_PASSWORD="fixture";
  global.fetch=async(url,options)=>{
   calls++;const rpc=JSON.parse(options.body);
   assert.equal(rpc.params.name,"manage_environment");
   assert.deepEqual(rpc.params.arguments,{scope:"staging",action:"list"});
   return {ok:true,json:async()=>({result:{content:[{type:"text",text:JSON.stringify({keys:["ONE"],secret:"must never escape"})}]}})};
  };
  assert.equal((await handler(event({password:"wrong",scope:"staging",action:"list"}))).statusCode,401);
  assert.equal(calls,0);
  assert.equal((await handler(event({password,scope:"../../etc",action:"list"}))).statusCode,400);
  assert.equal((await handler(event({password,scope:"production",action:"set",key:"KEY",value:"x"}))).statusCode,400);
  const result=await handler(event({password,scope:"staging",action:"list"}));
  assert.equal(result.statusCode,200);assert.deepEqual(JSON.parse(result.body),{ok:true,keys:["ONE"]});assert.equal(calls,1);
  assert.equal((await handler({...event({password}),headers:{origin:"https://evil.example"}})).statusCode,403);
 } finally {global.fetch=oldFetch;for(const [key,value] of Object.entries({IMENU_ENV_PASSWORD:oldPassword,IMENU_VPS_PASSWORD:oldVps})){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
