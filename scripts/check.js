const fs = require('fs'); const path = require('path'); const cp = require('child_process');
const root = path.resolve(__dirname, '..'); let count = 0;
function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { if (['node_modules', '.git', 'output'].includes(entry.name)) continue; const file = path.join(dir, entry.name); if (entry.isDirectory()) walk(file); else if (file.endsWith('.js')) { cp.execFileSync(process.execPath, ['--check', file]); count++; } else if (file.endsWith('.json')) { JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } } }
walk(root);
const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json')));
for (const page of app.pages) {
  const source = fs.readFileSync(path.join(root, 'miniprogram', page + '.wxml'), 'utf8');
  if (/{{[^}]*&amp;/.test(source)) throw new Error('HTML escaped operator in WXML expression: ' + page);
  for (const match of source.matchAll(/wx:(if|elif|for)="([^"]*)"/g)) if (!match[2].startsWith('{{')) throw new Error('Unbound WXML directive: ' + match[0]);
}
for (const page of app.pages) for (const ext of ['js', 'json', 'wxml', 'wxss']) { if (!fs.existsSync(path.join(root, 'miniprogram', page + '.' + ext))) throw new Error('Missing page ' + page + '.' + ext); }
const a = fs.readFileSync(path.join(root, 'miniprogram/utils/domain.js')), b = fs.readFileSync(path.join(root, 'cloudfunctions/couple/domain.js'));
if (!a.equals(b)) throw new Error('Run npm run sync before deployment');
console.log('Syntax, JSON, page files and shared rules checked:', count, 'JS files');
