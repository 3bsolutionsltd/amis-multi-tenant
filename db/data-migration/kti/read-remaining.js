'use strict';
const fs = require('fs');
const base = 'db/data-migration/kti/raw/_unzip_general';

const ssRaw = fs.readFileSync(base + '/xl/sharedStrings.xml', 'utf8');
const strings = [];
const siMatches = ssRaw.match(/<si>([\s\S]*?)<\/si>/g) || [];
for (const si of siMatches) {
  const tMatches = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
  strings.push(tMatches.map(t => t.replace(/<[^>]+>/g, '')).join(''));
}

function dump(file, name) {
  if (!fs.existsSync(file)) { console.log('\n=== ' + name + ' === (NOT FOUND)'); return; }
  const raw = fs.readFileSync(file, 'utf8');
  console.log('\n=== ' + name + ' ===');
  const rowRe = /<row[^>]+r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let m;
  while ((m = rowRe.exec(raw)) !== null) {
    const cells = [];
    const cellRe = /<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g;
    let c;
    while ((c = cellRe.exec(m[2])) !== null) {
      const v = c[3].match(/<v>([\s\S]*?)<\/v>/);
      if (!v) continue;
      const val = c[2].includes('t="s"') ? strings[+v[1]] : v[1];
      cells.push(c[1] + ':' + val);
    }
    if (cells.length) console.log('  ' + cells.join(' | '));
  }
}

dump(base + '/xl/worksheets/sheet6.xml',  'GRADES (full)');
dump(base + '/xl/worksheets/sheet1.xml',  'INSTITUTION PROFILE (full)');
dump(base + '/xl/worksheets/sheet11.xml', 'FEE COLLECTION');
dump(base + '/xl/worksheets/sheet9.xml',  'WORKFLOW');
dump(base + '/xl/worksheets/sheet10.xml', 'MARKS WORKFLOW');
