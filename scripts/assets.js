const fs = require('fs'); const path = require('path');
const dir = path.join(__dirname, '../miniprogram/assets'); fs.mkdirSync(dir, { recursive: true });
const paths = {
  home: '<path d="M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 5h2m4 0h2m-8 3h2"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3zm13-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 4 5v2h-4"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2z"/>',
  meal: '<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18m12-18c-4 0-5 8 0 9v9m0-18v9"/>',
  leaf: '<path d="M20 3C7 1 1 10 7 16c6 6 15-1 13-13ZM4 21 16 9"/>',
  book: '<path d="M12 5v16M3 3c4-1 7 0 9 2 2-2 5-3 9-2v16c-4-1-7 0-9 2-2-2-5-3-9-2z"/>',
  heart: '<path d="M20.5 5.5a5 5 0 0 0-8.5 1 5 5 0 0 0-8.5-1C-1 12 12 21 12 21s13-9 8.5-15.5Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>'
};
for (const [name, value] of Object.entries(paths)) fs.writeFileSync(path.join(dir, name + '.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#537258" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + value + '</svg>');
const avatar = (bg, clothes, hair, long) => `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="${bg}"/><path d="M19 100c0-34 62-34 62 0" fill="${clothes}"/><path d="M${long ? '25 75V40c0-34 49-34 49 0v35' : '28 48V35c0-28 46-28 46 0v13'}" fill="${hair}"/><rect x="43" y="58" width="14" height="21" rx="6" fill="#e5c5ac"/><ellipse cx="50" cy="44" rx="20" ry="25" fill="#f0d6bd"/><path d="M29 41c-4-26 41-36 44-3-10-2-19-11-22-17-3 10-12 16-22 20" fill="${hair}"/><circle cx="43" cy="45" r="1.6" fill="#524939"/><circle cx="58" cy="45" r="1.6" fill="#524939"/><path d="M46 57q5 4 10 0" fill="none" stroke="#b28470" stroke-width="2" stroke-linecap="round"/></svg>`;
fs.writeFileSync(path.join(dir, 'avatar-me.svg'), avatar('#dce6d5', '#92aa85', '#574e43', true));
fs.writeFileSync(path.join(dir, 'avatar-partner.svg'), avatar('#e9decb', '#b8a483', '#514d45', false));
console.log('Local SVG assets generated.');
