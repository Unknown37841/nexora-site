const fs = require('fs');

function checkFile(filename) {
  console.log('--- Checking ' + filename + ' ---');
  const html = fs.readFileSync(filename, 'utf8');

  // 1. Check duplicate IDs
  const idRegex = /\bid=["']([^"']+)["']/g;
  const ids = new Map();
  let m;
  while ((m = idRegex.exec(html)) !== null) {
    const id = m[1];
    ids.set(id, (ids.get(id) || 0) + 1);
  }
  const duplicates = [...ids.entries()].filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.error('DUPLICATE IDS:', duplicates);
  } else {
    console.log('No duplicate IDs (' + ids.size + ' unique ids).');
  }

  // 2. Check $('...') references in scripts
  const scriptRegex = /<script>([\s\S]*?)<\/script>/g;
  while ((m = scriptRegex.exec(html)) !== null) {
    const js = m[1];
    const dollarCalls = [...js.matchAll(/\$\(\s*['"]([^'"]+)['"]\s*\)/g)].map(x => x[1]);
    const missing = dollarCalls.filter(id => !ids.has(id));
    const uniqueMissing = [...new Set(missing)];
    if (uniqueMissing.length > 0) {
      console.warn('MISSING IDS referenced by $("..."):', uniqueMissing);
    } else {
      console.log('All $("...") references exist (' + dollarCalls.length + ' references checked).');
    }
  }
}

checkFile('public/index.html');
checkFile('public/admin.html');
