// Read all rows from NCBC sheet1 to see the full marks table
const fs = require('fs');

const base = 'db/data-migration/kti/raw/_unzip_ncbc';
const ssRaw = fs.readFileSync(base + '/xl/sharedStrings.xml', 'utf8');
const raw = fs.readFileSync(base + '/xl/worksheets/sheet1.xml', 'utf8');

const strings = [];
const siMatches = ssRaw.match(/<si>([\s\S]*?)<\/si>/g) || [];
for (const si of siMatches) {
  const tMatches = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
  const combined = tMatches.map(t => t.replace(/<t[^>]*>/, '').replace(/<\/t>/, '')).join('');
  strings.push(combined);
}

const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
let rowMatch;
while ((rowMatch = rowRe.exec(raw)) !== null) {
  const rowNum = rowMatch[1];
  const rowXml = rowMatch[2];
  const cellRe = /<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g;
  let cellMatch;
  const vals = [];
  while ((cellMatch = cellRe.exec(rowXml)) !== null) {
    const colRef = cellMatch[1];
    const attrs = cellMatch[2];
    const inner = cellMatch[3];
    const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
    if (!vMatch) continue;
    const v = vMatch[1];
    let display = v;
    if (attrs.includes('t="s"')) display = strings[parseInt(v)] || '?';
    vals.push(`${colRef}:${display}`);
  }
  if (vals.length > 0) console.log(`Row ${rowNum.padStart(3)}: ${vals.join('  |  ')}`);
}
