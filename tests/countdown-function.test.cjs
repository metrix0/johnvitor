"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const { handler, _test }=require("../netlify/functions/countdown.js");
const previous={...process.env};
const originalFetch=global.fetch;
const secret="very-long-private-view-password-12345";
const request=key=>({httpMethod:"GET",headers:{authorization:"Bearer "+key}});
function json(response){return JSON.parse(response.body)}
test.after(()=>{Object.assign(process.env,previous);global.fetch=originalFetch});
test("rejects requests with no access key or wrong key",async()=>{
  process.env.COUNTDOWN_VIEW_KEY=secret;
  assert.equal((await handler({httpMethod:"GET",headers:{}})).statusCode,401);
  assert.equal((await handler(request("incorrect"))).statusCode,401);
  assert.equal((await handler({httpMethod:"POST",headers:{}})).statusCode,405);
});
test("rejects weak configured key and never leaks secrets",async()=>{
  process.env.COUNTDOWN_VIEW_KEY="weak";
  const r=await handler(request("weak"));
  assert.equal(r.statusCode,401);
  assert.equal(r.body.includes("weak"),false);
});
test("validates strict date and monetary goal",()=>{
  assert.equal(_test.validDate("2027-02-29"),null);
  assert.equal(_test.validDate("2028-02-29"),"2028-02-29");
  assert.equal(_test.amount("0"),null);
  assert.equal(_test.amount("12345.67"),12345.67);
  assert.equal(_test.amount("1,000"),null);
});
test("reports setup without calling Pluggy",async()=>{
  process.env.COUNTDOWN_VIEW_KEY=secret;
  for(const key of ["PLUGGY_CLIENT_ID","PLUGGY_CLIENT_SECRET","PLUGGY_ITEM_ID","RHINO_DATE","RHINO_GOAL_BRL"])delete process.env[key];
  global.fetch=()=>{throw Error("should not be called")};
  const r=await handler(request(secret)),body=json(r);
  assert.equal(r.statusCode,200);
  assert.equal(body.bankState,"needs_setup");
  assert.equal(body.balance,null);
  assert.equal(body.missing.length,5);
});
test("uses bank balance, never credit cards, and selects correct account",async()=>{
  Object.assign(process.env,{COUNTDOWN_VIEW_KEY:secret,PLUGGY_CLIENT_ID:"id",PLUGGY_CLIENT_SECRET:"secret",PLUGGY_ITEM_ID:"item",RHINO_DATE:"2032-06-21",RHINO_GOAL_BRL:"12345"});
  global.fetch=async (url,opts)=>{
    if(String(url).endsWith("/auth"))return {ok:true,json:async()=>({apiKey:"temporary"})};
    if(String(url).includes("/accounts?"))return {ok:true,json:async()=>({
      totalPages:1,results:[
        {id:"a",type:"CREDIT",currencyCode:"BRL",balance:4500},
        {id:"b",type:"BANK",currencyCode:"BRL",balance:5600.37,updatedAt:"2026-11-08T12:00:00Z"}
      ]})};
    throw Error("unexpected route");
  };
  const r=await handler(request(secret)),body=json(r);
  assert.equal(body.bankState,"ok");assert.equal(body.balance,5600.37);
  assert.equal(body.goal,12345);assert.equal(body.surgeryDate,"2032-06-21");
  assert.equal(r.headers["Cache-Control"].includes("no-store"),true);
});
