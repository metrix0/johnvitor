const { createHash } = require('node:crypto');

// Only real product DOM, not rotating Next.js scripts, Flight data or chunk IDs.
function snapshotPage(html) {
  if (typeof html !== 'string' || !html.trim()) throw new Error('Product page returned empty HTML');
  const match = html.match(/<main\b[^>]*>[\s\S]*?<\/main\s*>/i);
  if (!match) throw new Error('Product page missing its main content');
  const main = match[0]
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  if (!/<h1\b/i.test(main)) throw new Error('Incomplete product page (no heading)');
  const title = (html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] || '').trim();
  return JSON.stringify({title, main});
}

function hashSnapshot(snapshot) {
  return createHash('sha256').update(snapshot, 'utf8').digest('hex');
}

function humanDiff(before, after) {
  if (!before) return 'No previous product-page snapshot';
  let a; let b;
  try { a = JSON.parse(before); b = JSON.parse(after); }
  catch { a = {title:'',main:before}; b = {title:'',main:after}; }
  const text = s => String(s || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const beforeText = text(a.title + ' ' + a.main);
  const afterText = text(b.title + ' ' + b.main);
  const oldValue = beforeText === afterText ? a.main : beforeText;
  const newValue = beforeText === afterText ? b.main : afterText;
  let i = 0;
  while (i < oldValue.length && i < newValue.length && oldValue[i] === newValue[i]) i++;
  const excerpt = value => String(value).slice(Math.max(0,i-70), i+130).replace(/\s+/g,' ').trim();
  return 'Before: ' + excerpt(oldValue) + '\nAfter: ' + excerpt(newValue);
}

module.exports = {snapshotPage, hashSnapshot, humanDiff};
