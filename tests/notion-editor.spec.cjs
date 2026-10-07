const { test, expect, chromium } = require('playwright/test');
const path = require('node:path');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { handler } = require('../netlify/functions/notion.js');
const ROOT = path.resolve(__dirname, '..');
let server, browser, page, blocks, order, seq, requests, savedBodies, pageErrors;
const rich = text => [{ type: 'text', text: { content: text }, plain_text: text, annotations: { bold:false, italic:false, underline:false, strikethrough:false, code:false, color:'default' } }];
const b = (id, type, text, children = [], extra = {}) => ({ id, type, [type]: { rich_text:rich(text), ...extra }, children });
const fixture = () => [b('first','paragraph','Alpha'), b('second','paragraph','Bravo'), b('third','paragraph','Charlie'), b('heading','heading_2','Section'), b('bullet','bulleted_list_item','One', [b('nested','paragraph','Child')]), b('number1','numbered_list_item','First'), b('number2','numbered_list_item','Second'), b('todo','to_do','Task',[],{checked:false}), b('toggle','toggle','Details',[b('toggle-child','paragraph','Inside')]), {id:'divider',type:'divider',divider:{}}, {id:'image',type:'image',image:{type:'external', external:{url:'https://example.com/image.png'},caption:[]}}, b('last','paragraph','End')];
function init() {
 blocks = new Map(); order = new Map([['page',[]]]); seq = 0; requests = []; savedBodies = [];
 function add(items,parent) { order.set(parent, items.map(x=>x.id)); for(const item of items) { const {children,...data}=item;blocks.set(item.id,{...data,parent,has_children:Boolean(children?.length)});add(children||[],item.id); } }
 add(fixture(),'page');
}
function response(data,status=200) { return {ok:status<400,status,headers:new Headers(),json:async()=>data,text:async()=>JSON.stringify(data)}; }
async function fakeNotion(url, options={}) {
 const route = new URL(url).pathname.replace('/v1',''), method=options.method||'GET', body=options.body ? JSON.parse(options.body):null;
 requests.push({route,method,body});
 if(route==='/pages/page') return response({properties:{title:{type:'title',title:rich('iMenu')}}});
 const match=route.match(/^\/blocks\/([^/]+)(\/children)?$/); if(!match) throw new Error('Unexpected Notion URL '+url);
 const id=match[1];
 if(match[2] && method==='GET') return response({results:(order.get(id)||[]).filter(x=>!blocks.get(x)?.in_trash).map(x=>{const data=blocks.get(x);return {...data,has_children:(order.get(x)||[]).some(c=>!blocks.get(c)?.in_trash)};}),has_more:false});
 if(match[2] && method==='PATCH') {
   if(id!=='page' && (!blocks.has(id)||blocks.get(id).in_trash)) return response({error:'missing parent'},400);
   const current=order.get(id)||[];
   const results=[];
   function add(payload,parent) { const bid='saved-'+(++seq), value={...payload[payload.type]}, children=value.children||[];delete value.children;
     if(payload.type==='table' && (!children.length||children.some(c=>c.table_row.cells.length!==value.table_width))) throw new Error('Invalid table creation');
     const block={id:bid,type:payload.type,[payload.type]:value,parent,has_children:Boolean(children.length)};blocks.set(bid,block);order.set(bid,children.map(c=>add(c,bid).id));return block; }
   for(const child of body.children) results.push(add(child,id));
   let index=body.position.type==='start'?0:current.indexOf(body.position.after_block.id)+1;
   if(body.position.type!=='start' && index===0) return response({error:'missing after'},400);
   current.splice(index,0,...results.map(x=>x.id));order.set(id,current);return response({results});
 }
 if(method==='PATCH') { const old=blocks.get(id);if(!old) return response({},404);if(body.in_trash) old.in_trash=true;
   else if(body[old.type]) old[old.type]={...old[old.type],...body[old.type]};else throw new Error('Attempted Notion type mutation');return response(old); }
 throw new Error('Unmocked Notion operation');
}
test.beforeAll(async()=>{
 process.env.NOTION_TOKEN='test-token';process.env.NOTION_IMENU_PAGE_ID='page';global.fetch=fakeNotion;
 server=createServer(async(req,res)=>{try {const pathname=new URL(req.url,'http://localhost').pathname;const file=path.join(ROOT,pathname.endsWith('/')?pathname+'index.html':pathname);if(!file.startsWith(ROOT+'/'))throw Error('invalid path');const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);}catch {res.statusCode=404;res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:process.env.NOTION_TEST_CHROMIUM,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
});
test.afterAll(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});
test.beforeEach(async()=>{
 init();pageErrors=[];page=await browser.newPage();page.on('pageerror',error=>pageErrors.push(error.message));
 await page.addInitScript(()=>localStorage.setItem('ANKI_APP_ACCESS_UNTIL',String(Date.now()+86400000)));
 await page.route('**/api/notion?**',async route=>{const req=route.request();if(req.method()==='PUT')savedBodies.push(req.postDataJSON());const result=await handler({httpMethod:req.method(),queryStringParameters:{page:'imenu'},body:req.postData()});await route.fulfill({status:result.statusCode,headers:result.headers,body:result.body});});
 await page.route('https://example.com/**',route=>route.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/imenu/`);await expect(page.locator('#statusBadge')).toHaveText('Connected');
});
test.afterEach(async()=>{await page.close();expect(pageErrors).toEqual([]);});
const el=id=>page.locator(`[data-editable][data-id="${id}"]`).first();
async function caret(id,offset){await page.evaluate(({id,offset})=>placeCaret(document.querySelector(`[data-editable][data-id="${id}"]`),false,offset),{id,offset});}
async function selectText(a,ao,b,bo){await page.evaluate(({a,ao,b,bo})=>{const x=document.querySelector(`[data-id="${a}"]`),y=document.querySelector(`[data-id="${b}"]`);content.focus();getSelection().setBaseAndExtent(x.firstChild,ao,y.firstChild,bo);},{a,ao,b,bo});}
async function saveReload(){await page.keyboard.press('Control+s');await expect(page.locator('#saveStatus')).toHaveText('Saved');await page.reload();await expect(page.locator('#statusBadge')).toHaveText('Connected');}

test('Enter splits rich text; soft breaks stay inside the block and persist',async()=>{
 await caret('first',2);await page.keyboard.press('Enter');await page.keyboard.type('new');
 await expect(el('first')).toHaveText('Al');const next=page.locator('.block-paragraph [data-editable]').nth(1);await expect(next).toHaveText('newpha');
 await page.keyboard.press('Shift+Enter');await page.keyboard.type('line');
 expect(await next.evaluate(e=>serializeEditableRichText(e).map(x=>x.text.content).join(''))).toBe('new\nlinepha');
 expect(requests.filter(x=>x.method==='PATCH')).toHaveLength(0);await saveReload();await expect(page.locator('.block-paragraph [data-editable]').nth(1)).toHaveText('new\nlinepha');
});
test('trailing soft break produces a visible caret line without an extra saved break',async()=>{
 await caret('first',5);await page.keyboard.press('Shift+Enter');await page.keyboard.type('After');
 expect(await el('first').evaluate(e=>serializeEditableRichText(e).map(x=>x.text.content).join(''))).toBe('Alpha\nAfter');
 await saveReload();await expect(el('first')).toHaveText('Alpha\nAfter');
});
test('cross-block text deletion preserves wrappers, merges endpoints, undo restores all',async()=>{
 await selectText('first',2,'third',3);await page.keyboard.press('Backspace');await expect(el('first')).toHaveText('Alrlie');
 await expect(el('second')).toHaveCount(0);await expect(el('third')).toHaveCount(0);
 await page.keyboard.press('Control+z');await expect(el('first')).toHaveText('Alpha');await expect(el('second')).toHaveText('Bravo');await expect(el('third')).toHaveText('Charlie');
 await page.keyboard.press('Control+Shift+z');await expect(el('first')).toHaveText('Alrlie');await saveReload();await expect(el('first')).toHaveText('Alrlie');await expect(el('second')).toHaveCount(0);
});
test('typing replaces a backward cross-block selection',async()=>{
 await selectText('third',3,'first',2);await page.keyboard.type('X');await expect(el('first')).toHaveText('AlXrlie');await expect(el('second')).toHaveCount(0);
});
test('structural undo/redo and saved deletion undo recreate the removed block',async()=>{
 await caret('first',5);await page.keyboard.press('Enter');await page.keyboard.type('Inserted');await page.keyboard.press('Control+z');await expect(page.locator('.block-paragraph [data-editable]').nth(1)).toHaveText('');await page.keyboard.press('Control+z');await expect(el('second')).toHaveText('Bravo');
 await caret('second',0);await page.keyboard.press('Escape');await page.keyboard.press('Delete');await page.keyboard.press('Control+s');await expect(page.locator('#saveStatus')).toHaveText('Saved');await page.keyboard.press('Control+z');
 await expect(page.locator('[data-editable]').filter({hasText:'Bravo'})).toHaveCount(1);await saveReload();await expect(page.locator('[data-editable]').filter({hasText:'Bravo'})).toHaveCount(1);
});
test('Tab indents a parent with children and Shift+Tab preserves the subtree',async()=>{
 await caret('heading',1);await page.keyboard.press('Control+Shift+0');const parent=page.locator('[data-editable]').filter({hasText:/^Section$/});await caret('bullet',1);await page.keyboard.press('Tab');await expect(page.locator('.block-paragraph .block-bulleted_list_item .notion-children [data-editable]')).toHaveText('Child');await saveReload();const one=page.locator('.block-bulleted_list_item > .list-row [data-editable]');await one.click();await page.keyboard.press('Shift+Tab');await saveReload();await expect(page.locator('#notionContent > .block-bulleted_list_item .notion-children [data-editable]')).toHaveText('Child');
});
test('Tab nesting, reload and outdent preserve nested children',async()=>{
 await caret('bullet',1);await page.keyboard.press('Control+Shift+0'); // paragraph can nest
 const bullet=page.locator('[data-editable]').filter({hasText:/^One$/});await bullet.click();await page.keyboard.press('Tab');
 await expect(page.locator('.block-heading_2 .notion-children')).toHaveCount(0); // heading cannot host without toggle mode
 await caret('second',1);await page.keyboard.press('Tab');await expect(page.locator('[data-block-id="first"] > .notion-children')).toHaveCount(1);await saveReload();
 const bravo=page.locator('[data-editable]').filter({hasText:/^Bravo$/});await bravo.click();await page.keyboard.press('Shift+Tab');await saveReload();await expect(page.locator('#notionContent > .block-paragraph [data-editable]').filter({hasText:/^Bravo$/})).toHaveCount(1);
});
test('list continuation, empty list exit, numbering and checkbox undo',async()=>{
 await caret('number2',6);await page.keyboard.press('Enter');expect(await page.locator('.block-numbered_list_item').last().locator('.list-marker').textContent()).toBe('3.');await page.keyboard.press('Enter');await expect(page.locator('.block-numbered_list_item')).toHaveCount(2);
 await page.locator('[data-todo-id="todo"]').click();await expect(page.locator('[data-todo-id="todo"]')).toBeChecked();await page.keyboard.press('Control+z');await expect(page.locator('[data-todo-id="todo"]')).not.toBeChecked();
});
test('slash conversion, markdown divider and heading persist through Notion',async()=>{
 await caret('last',3);await page.keyboard.press('Enter');await page.keyboard.type('/h1');await expect(page.locator('.notion-command-menu')).toBeVisible();await page.keyboard.press('Enter');await page.keyboard.type('New heading');
 await page.keyboard.press('Enter');await page.keyboard.type('---');await expect(page.locator('.block-divider')).toHaveCount(2);
 await page.keyboard.press('Enter');await page.keyboard.type('# ');await page.keyboard.type('Markdown heading');await saveReload();await expect(page.locator('.block-heading_1')).toHaveCount(2);await expect(page.locator('.block-divider')).toHaveCount(2);
});
test('Esc block selection, Shift arrows, duplicate, delete and Ctrl+A stay scoped',async()=>{
 await caret('first',1);await page.keyboard.press('Escape');await expect(page.locator('.block-selected')).toHaveCount(1);await page.keyboard.press('Shift+ArrowDown');await expect(page.locator('.block-selected')).toHaveCount(2);
 await page.keyboard.press('Control+d');await expect(page.locator('[data-editable]').filter({hasText:/^Alpha$/})).toHaveCount(2);await page.keyboard.press('Delete');await expect(page.locator('[data-editable]').filter({hasText:/^Alpha$/})).toHaveCount(1);
 await caret('first',1);await page.keyboard.press('Control+a');expect(await page.evaluate(()=>getSelection().toString())).toBe('Alpha');await page.keyboard.press('Control+a');await expect(page.locator('.block-selected')).toHaveCount(visibleFixtureCount());
});
function visibleFixtureCount(){return 13;} // nested bullet child is visible; collapsed toggle child is hidden

test('rich multiline paste creates blocks and keeps the suffix',async()=>{
 await caret('first',2);await page.evaluate(()=>{const d=new DataTransfer();d.setData('text/plain','X\nY');d.setData('text/html','<p><strong>X</strong></p><p><em>Y</em></p>');content.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));});
 await expect(el('first')).toHaveText('AlX');await expect(page.locator('.block-paragraph [data-editable]').nth(1)).toHaveText('Ypha');await expect(el('first').locator('strong')).toHaveText('X');await saveReload();await expect(page.locator('.block-paragraph [data-editable]').nth(1).locator('em')).toHaveText('Y');
});
test('paste URL over selected text creates a link and formatting works across blocks',async()=>{
 await selectText('first',1,'second',3);await page.keyboard.press('Control+b');await expect(el('first').locator('b,strong')).toHaveText('lpha');await expect(el('second').locator('b,strong')).toHaveText('Bra');
 await selectText('third',0,'third',7);await page.evaluate(()=>{const d=new DataTransfer();d.setData('text/plain','https://example.com');content.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));});await expect(el('third').locator('a')).toHaveAttribute('href','https://example.com');await saveReload();await expect(el('third').locator('a')).toHaveText('Charlie');
});
test('new tables: edit, Tab, row/column creation and save round trip',async()=>{
 await caret('last',3);await page.keyboard.press('Enter');await page.keyboard.type('/table');await page.keyboard.press('Enter');await page.keyboard.type('A');await page.keyboard.press('Tab');await page.keyboard.type('B');
 await page.locator('[data-table-action="row"]').click();await page.keyboard.type('C');await page.locator('[data-table-action="column"]').click();await saveReload();
 await expect(page.locator('.notion-table tr')).toHaveCount(3);await expect(page.locator('.notion-table td')).toHaveCount(9);await expect(page.locator('.notion-table td').nth(0)).toHaveText('A');await expect(page.locator('.notion-table td').nth(1)).toHaveText('B');await expect(page.locator('.notion-table td').nth(6)).toHaveText('C');
});
test('moving with shortcut preserves nested subtree; duplicate and reload',async()=>{
 await caret('bullet',1);await page.keyboard.press('Escape');await page.keyboard.press('Control+Shift+ArrowUp');await expect(page.locator('#notionContent > .notion-block').nth(3).locator('[data-editable]').first()).toHaveText('One');await saveReload();await expect(page.locator('.block-bulleted_list_item .notion-children [data-editable]')).toHaveText('Child');
 const one=page.locator('.block-bulleted_list_item > .list-row [data-editable]');await one.click();await page.keyboard.press('Escape');await page.keyboard.press('Control+d');await saveReload();await expect(page.locator('.block-bulleted_list_item')).toHaveCount(2);await expect(page.locator('.block-bulleted_list_item .notion-children [data-editable]')).toHaveCount(2);
});
test('toggle controls still work after undo; Ctrl+Enter checks todo',async()=>{
 await caret('first',5);await page.keyboard.press('Enter');await page.keyboard.press('Control+z');await page.locator('[data-block-id="toggle"] > .toggle-row .toggle-marker').click();await expect(el('toggle-child')).toBeVisible();
 await caret('todo',1);await page.keyboard.press('Control+Enter');await expect(page.locator('[data-todo-id="todo"]')).toBeChecked();await saveReload();await expect(page.locator('[data-todo-id="todo"]')).toBeChecked();
});
test('save failures do not duplicate partially created blocks on retry',async()=>{
 await caret('first',5);await page.keyboard.press('Enter');await page.keyboard.type('New');let fail=true;
 const real=global.fetch;global.fetch=async(url,opts)=>{if(fail && url.includes('/blocks/second') && !url.endsWith('/children') && opts?.method==='PATCH'){fail=false;return response({error:'failure'},400);}return real(url,opts);};
 await caret('second',5);await page.keyboard.type(' edit');await page.keyboard.press('Control+s');await expect(page.locator('#saveStatus')).toHaveText('Save failed');global.fetch=real;await saveReload();await expect(page.locator('[data-editable]').filter({hasText:/^New$/})).toHaveCount(1);
});

test('mouse dragging text across lines then replacing keeps valid blocks',async()=>{
 const a=await el('first').boundingBox(), z=await el('third').boundingBox();
 await page.mouse.move(a.x+16,a.y+12);await page.mouse.down();await page.mouse.move(z.x+30,z.y+12,{steps:12});await page.mouse.up();
 expect((await page.evaluate(()=>getSelection().toString())).length).toBeGreaterThan(8);
 await page.keyboard.type('Replacement');await expect(page.locator('#notionContent > .notion-block')).toHaveCount(10);await saveReload();
 expect((await page.locator('#notionContent').textContent()).includes('Replacement')).toBe(true);
});
test('selection over media and dividers removes selected non-text blocks only',async()=>{
 await page.locator('[data-block-id="toggle"] > .toggle-row .toggle-marker').click();
 await selectText('toggle-child',2,'last',1);await page.keyboard.press('Delete');await expect(page.locator('.block-divider')).toHaveCount(0);await expect(page.locator('.block-image')).toHaveCount(0);await expect(el('toggle-child')).toHaveText('Innd');await saveReload();await expect(page.locator('.block-image')).toHaveCount(0);
});
test('merging a parent preserves its children and caret offset after a soft break',async()=>{
 await caret('first',5);await page.keyboard.press('Shift+Enter');await page.keyboard.type('line');
 await caret('second',0);await page.keyboard.press('Backspace');await page.keyboard.type('X');await expect(el('first')).toHaveText('Alpha\nlineXBravo');await saveReload();await expect(el('first')).toHaveText('Alpha\nlineXBravo');
 await caret('bullet',0);await page.keyboard.press('Backspace'); // convert list to paragraph first
 const one=page.locator('[data-editable]').filter({hasText:/^One$/});await one.click();await page.keyboard.press('Home');await page.keyboard.press('Backspace');await saveReload();await expect(page.locator('.notion-children [data-editable]').filter({hasText:/^Child$/})).toHaveCount(1);
});
test('checkbox redo, block color and inline color survive reload',async()=>{
 await page.locator('[data-todo-id="todo"]').click();await page.keyboard.press('Control+z');await page.keyboard.press('Control+Shift+z');await expect(page.locator('[data-todo-id="todo"]')).toBeChecked();
 await caret('first',5);await page.keyboard.type(' /red');await page.keyboard.press('Enter');await expect(page.locator('[data-block-id="first"]')).toHaveAttribute('data-notion-color','red');
 await selectText('third',1,'third',5);await page.locator('[data-format="color"]').click();await page.locator('.notion-command-menu button').filter({hasText:/^Blue text$/}).click();await saveReload();await expect(page.locator('[data-block-id="first"]')).toHaveAttribute('data-notion-color','red');await expect(el('third').locator('[data-notion-color="blue"]')).toHaveText('harl');
});
test('block copy/cut/paste preserves nesting and rich types',async()=>{
 await caret('bullet',1);await page.keyboard.press('Escape');
 const clipboard=await page.evaluate(()=>{const d=new DataTransfer();content.dispatchEvent(new ClipboardEvent('cut',{clipboardData:d,bubbles:true,cancelable:true}));return {custom:d.getData('application/x-johnvitor-notion-blocks'),text:d.getData('text/plain')};});
 expect(clipboard.custom).toContain('Child');await expect(page.locator('.block-bulleted_list_item')).toHaveCount(0);
 await caret('last',3);await page.keyboard.press('Enter');await page.evaluate(({custom,text})=>{const d=new DataTransfer();d.setData('application/x-johnvitor-notion-blocks',custom);d.setData('text/plain',text);content.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));},clipboard);await saveReload();await expect(page.locator('.block-bulleted_list_item .notion-children [data-editable]')).toHaveText('Child');
});
test('drag handle reorders actual blocks and keeps descendants',async()=>{
 const handle=page.locator('[data-block-id="bullet"] > .block-tools [draggable]');
 await handle.dragTo(page.locator('[data-block-id="first"]'),{targetPosition:{x:5,y:2}});
 await expect(page.locator('#notionContent > .notion-block').first().locator('[data-editable]').first()).toHaveText('One');await saveReload();await expect(page.locator('.block-bulleted_list_item .notion-children [data-editable]')).toHaveText('Child');
});
test('marquee selection selects blocks without changing the document',async()=>{
 const a=await el('first').boundingBox(), z=await el('third').boundingBox();
 await page.mouse.move(a.x-50,a.y+2);await page.mouse.down();await page.mouse.move(z.x-45,z.y+20,{steps:10});await page.mouse.up();await expect(page.locator('.block-selected')).toHaveCount(3);await expect(page.locator('#saveStatus')).toHaveText('Saved');
});
test('IME composition does not split blocks or trigger commands prematurely',async()=>{
 await caret('first',5);await page.evaluate(()=>{const e=document.querySelector('[data-id="first"]');e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));e.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:'insertParagraph',isComposing:true}));e.firstChild.nodeValue+='ç';e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));e.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));});await expect(el('first')).toHaveText('Alphaç');await page.keyboard.press('Control+z');await expect(el('first')).toHaveText('Alpha');
});
test('parent transform to incompatible type refuses to erase nested blocks',async()=>{
 await caret('bullet',1);await page.keyboard.type(' /h1');await page.keyboard.press('Enter');await expect(page.locator('.block-bulleted_list_item .notion-children [data-editable]')).toHaveText('Child');await saveReload();await expect(page.locator('.block-bulleted_list_item .notion-children [data-editable]')).toHaveText('Child');
});
test('selected block typing replaces the block and paste sanitizes scripts',async()=>{
 await caret('second',1);await page.keyboard.press('Escape');await page.keyboard.type('Fresh');await expect(page.locator('[data-editable]').filter({hasText:/^Fresh$/})).toHaveCount(1);await expect(el('second')).toHaveCount(0);
 await page.evaluate(()=>{const d=new DataTransfer();d.setData('text/plain','Safe');d.setData('text/html','<strong onclick="alert(1)">Safe</strong><script>window.HACKED=true</script>');content.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));});expect(await page.evaluate(()=>window.HACKED)).toBeUndefined();await expect(page.locator('#notionContent [onclick]')).toHaveCount(0);await saveReload();
});

test('inline marks and mention identity are preserved while editing and saving',async()=>{
 blocks.set('mention-block',{id:'mention-block',type:'paragraph',paragraph:{},parent:'page'});
 await page.evaluate(()=>{const data={page:'imenu',title:{property:'title',text:'iMenu'},blocks:[{id:'mention-block',type:'paragraph',paragraph:{color:'green',rich_text:[{type:'mention',mention:{type:'page',page:{id:'ref-page'}},plain_text:'Referenced page',annotations:{bold:false,color:'default'}},{type:'text',text:{content:' tail'},annotations:{color:'blue',italic:true}}]}}]};render(data);});
 await caret('mention-block',20);await page.keyboard.type(' edited');await page.keyboard.press('Control+s');await expect(page.locator('#saveStatus')).toHaveText('Saved');
 const update=requests.find(x=>x.method==='PATCH'&&x.route==='/blocks/mention-block');expect(update.body.paragraph.rich_text[0].mention.page.id).toBe('ref-page');expect(update.body.paragraph.color).toBe('green');expect(update.body.paragraph.rich_text.some(x=>x.annotations?.italic)).toBe(true);
});
test('editable children inside existing column containers save normally',async()=>{
 const columns={id:'columns',type:'column_list',column_list:{},children:[{id:'column',type:'column',column:{},children:[b('column-text','paragraph','Column text')]}]};
 blocks.set('columns',{...columns,parent:'page',has_children:true});blocks.set('column',{...columns.children[0],parent:'columns',has_children:true});blocks.set('column-text',{...columns.children[0].children[0],parent:'column',has_children:false});order.set('page',[...order.get('page'),'columns']);order.set('columns',['column']);order.set('column',['column-text']);order.set('column-text',[]);
 await page.reload();await expect(page.locator('#statusBadge')).toHaveText('Connected');await el('column-text').click();await page.keyboard.press('End');await page.keyboard.type(' edit');await saveReload();await expect(el('column-text')).toHaveText('Column text edit');
});
test('unsupported blocks and hosted files cannot be silently lost by moving their parent',async()=>{
 await page.evaluate(()=>render({title:{property:'title',text:'iMenu'},blocks:[{id:'p',type:'paragraph',paragraph:{rich_text:[{type:'text',text:{content:'Parent'}}]},children:[{id:'f',type:'image',image:{type:'file',file:{url:'https://example.com/signed'},caption:[]}}]},{id:'end',type:'paragraph',paragraph:{rich_text:[{type:'text',text:{content:'End'}}]}}]}));
 await caret('p',1);await page.keyboard.press('Escape');await page.keyboard.press('Control+d');await expect(page.locator('.block-paragraph')).toHaveCount(2);await expect(page.locator('.block-image')).toHaveCount(1);await expect(page.locator('#toast')).toContainText('Cannot duplicate');
});
test('saving freezes controls and prevents lost checkbox edits during a slow request',async()=>{
 let release;const wait=new Promise(resolve=>release=resolve);const real=global.fetch;
 global.fetch=async(url,options)=>{if(options?.method==='PATCH')await wait;return real(url,options);};
 await caret('first',5);await page.keyboard.type(' edit');await page.keyboard.press('Control+s');await expect(page.locator('#saveStatus')).toHaveText('Saving...');await expect(page.locator('[data-todo-id="todo"]')).toBeDisabled();
 release();await expect(page.locator('#saveStatus')).toHaveText('Saved');global.fetch=real;await expect(page.locator('[data-todo-id="todo"]')).toBeEnabled();await page.keyboard.press('Control+z');await expect(el('first')).toHaveText('Alpha');
});
test('table cells retain IDs across consecutive saves without a reload',async()=>{
 await caret('last',3);await page.keyboard.press('Enter');await page.keyboard.type('/table');await page.keyboard.press('Enter');await page.keyboard.type('A');await page.keyboard.press('Control+s');await expect(page.locator('#saveStatus')).toHaveText('Saved');await page.locator('.notion-table td').nth(1).click();await page.keyboard.type('B');await saveReload();await expect(page.locator('.notion-table td').nth(1)).toHaveText('B');
});
test('keyboard Shift+Down selection across blocks stays editable and saves',async()=>{
 await caret('first',2);await page.keyboard.press('Shift+ArrowDown');expect((await page.evaluate(()=>getSelection().toString())).length).toBeGreaterThan(1);await page.keyboard.type('X');await saveReload();expect((await page.locator('#notionContent').textContent()).includes('X')).toBe(true);
});
test('mobile layout and toolbar remain within the viewport',async()=>{
 await page.setViewportSize({width:390,height:844});await selectText('first',0,'second',3);await expect(page.locator('.notion-format-toolbar')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.screenshot({path:'/tmp/johnvitor-editor-mobile.png'});
});
test('desktop editor has no overflow and block actions align with content',async()=>{
 await page.setViewportSize({width:1280,height:900});await el('first').hover();await selectText('first',1,'first',5);await page.screenshot({path:'/tmp/johnvitor-editor-desktop.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
});

test('retry recovers table row IDs after a failed mapping read without duplicating rows',async()=>{
 await caret('last',3);await page.keyboard.press('Enter');await page.keyboard.type('/table');await page.keyboard.press('Enter');await page.keyboard.type('A');
 const real=global.fetch;let fail=true;global.fetch=async(url,opts)=>{if(fail && /\/blocks\/saved-\d+\/children/.test(url) && !opts?.method){fail=false;return response({error:'read failure'},400);}return real(url,opts);};
 await page.keyboard.press('Control+s');await expect(page.locator('#saveStatus')).toHaveText('Save failed');global.fetch=real;await page.locator('.notion-table td').first().click();await page.keyboard.press('End');await page.keyboard.type(' edited');await saveReload();await expect(page.locator('.block-table')).toHaveCount(1);await expect(page.locator('.notion-table tr')).toHaveCount(2);await expect(page.locator('.notion-table td').first()).toHaveText('A edited');
});
