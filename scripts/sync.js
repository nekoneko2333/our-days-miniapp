const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
fs.copyFileSync(path.join(root, 'miniprogram/utils/domain.js'), path.join(root, 'cloudfunctions/couple/domain.js'));
console.log('Shared rules synced.');
