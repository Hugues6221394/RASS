const fs = require('fs');
let content = fs.readFileSync('FarmerDashboardPage.tsx', 'utf8');
content = content.replace(' */ CONSTANTS /* ', '/* CONSTANTS */');
content = content.replaceAll(' */ ', ' */\n');
const lines = content.split('\n');
console.log('Line 12:', JSON.stringify(lines[11]));
console.log('Total lines:', lines.length);
fs.writeFileSync('FarmerDashboardPage.tsx', content, 'utf8');
