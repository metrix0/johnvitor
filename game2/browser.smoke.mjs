import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('game2');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.mjs':'text/javascript'};
const server=createServer(async(req,res)=>{
 const uri=new URL(req.url,'http://localhost');
 let path=resolve(root,'.'+decodeURIComponent(uri.pathname));
 if(uri.pathname==='/'||uri.pathname==='/game2/')path=resolve(root,'index.html');
 if(!path.startsWith(root+sep)&&path!==root){res.writeHead(403);res.end();return;}
 try{const data=await readFile(path);res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(ok=>server.listen(8877,'127.0.0.1',ok));
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',msg=>{if(msg.type()==='error')errors.push('console: '+msg.text());});
try{
 await page.goto('http://127.0.0.1:8877/',{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>window.getawayReady===true,{timeout:45000});
 await page.screenshot({path:'/tmp/getaway-menu.png',fullPage:false});
 await page.locator('#playerName').fill('QATEST26');
 await page.locator('#solo').click();
 await page.waitForSelector('#gameScreen:not(.hidden)',{timeout:15000});
 await page.waitForSelector('#overlayTitle',{timeout:15000});
 assert.match(await page.locator('#overlayTitle').innerText(),/AFTER HOURS/);
 const canvas=page.locator('#stage > canvas').first();
 assert.equal(await canvas.count(),1,'3D renderer canvas exists');
 await page.locator('#overlayAction').click();
 await page.waitForFunction(()=>document.getElementById('centerOverlay').classList.contains('hidden'),null,{timeout:15000});
 await page.waitForTimeout(1000);
 assert.match(await page.locator('#hudMission').innerText(),/AFTER HOURS/);
 assert.match(await page.locator('#hpLabel').innerText(),/100/);
 assert.match(await page.locator('#ammoValue').innerText(),/15/);
 await page.keyboard.down(' ');await page.waitForTimeout(450);await page.keyboard.up(' ');
 await page.waitForTimeout(180);
 const ammunition=Number((await page.locator('#ammoValue').innerText()).match(/\d+/)[0]);
 assert.ok(ammunition<15,'shooting should consume ammo: '+ammunition);
 await page.screenshot({path:'/tmp/getaway-smoke.png'});
 const fatal=await page.locator('#fatal').isVisible();
 assert.equal(fatal,false,'no fatal error overlay');
 assert.equal(errors.filter(e=>e.startsWith('pageerror')).length,0,'no page runtime errors: '+errors.join('; '));
 console.log('BROWSER SMOKE PASS: lobby -> solo -> mission briefing -> live WebGL render -> HUD -> shooting (ammo dropped to '+ammunition+')');
 console.log('Browser console observations:',errors.slice(0,8));
}finally{await browser.close();await new Promise(ok=>server.close(ok));}
