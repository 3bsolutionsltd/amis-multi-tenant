// Read NCBC marks template Excel
const fs = require('fs');

function parseExcel(base) {
  const ssRaw = fs.readFileSync(base + '/xl/sharedStrings.xml', 'utf8');
  const wbRaw = fs.readFileSync(base + '/xl/workbook.xml', 'utf8');

  const strings = [];
  const siMatches = ssRaw.match(/<si>([\s\S]*?)<\/si>/g) || [];
  for (const si of siMatches) {
    const tMatches = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
    const combined = tMatches.map(t => t.replace(/<t[^>]*>/, '').replace(/<\/t>/, '')).join('');
    strings.push(combined);
  }

  const sheetNameMap = {};
  const rIdMap = {};
  const sheetMatches = wbRaw.match(/<sheet[^>]+>/g) || [];
  for (const s of sheetMatches) {
    const nameM = s.match(/name="([^"]+)"/);
    const idM = s.match(/sheetId="([^"]+)"/);
    const rIdM = s.match(/r:id="([^"]+)"/);
    if (nameM && idM) sheetNameMap[idM[1]] = nameM[1];
  }

  // Read relationships to map rId to sheet files
  const relsRaw = fs.readFileSync(base + '/xl/_rels/workbook.xml.rels', 'utf8');
  const relMatches = relsRaw.match(/<Relationship[^>]+>/g) || [];
  const rIdToFile = {};
  for (const r of relMatches) {
    const idM = r.match(/Id="([^"]+)"/);
    const targetM = r.match(/Target="([^"]+)"/);
    if (idM && targetM) rIdToFile[idM[1]] = targetM[1];
  }

  return { strings, sheetNameMap, rIdToFile, base };
}

function readSheet(ctx, sheetFile, sheetName, numRows = 8) {
  const fullPath = ctx.base + '/xl/' + sheetFile.replace(/^worksheets\//, 'worksheets/');
  if (!fs.existsSync(fullPath)) { console.log(`  [file not found: ${fullPath}]`); return; }
  const raw = fs.readFileSync(fullPath, 'utf8');
  console.log(`\n=== ${sheetName.toUpperCase()} ===`);
  
  const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;
  let count = 0;
  while ((rowMatch = rowRe.exec(raw)) !== null && count < numRows) {
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
      if (attrs.includes('t="s"')) display = ctx.strings[parseInt(v)] || '?';
      vals.push(`${colRef}:${display}`);
    }
    if (vals.length > 0) console.log(`  Row ${rowNum}: ${vals.join('  |  ')}`);
    count++;
  }
}

const ncbc = parseExcel('db/data-migration/kti/raw/_unzip_ncbc');
console.log('\n=== NCBC EXCEL SHEET NAMES ===');
Object.entries(ncbc.sheetNameMap).forEach(([id, name]) => {
  const rId = `rId${id}`;
  const file = ncbc.rIdToFile[rId] || `worksheets/sheet${id}.xml`;
  console.log(`  sheet${id}: ${name}  =>  ${file}`);
});

// Read all sheets
for (let i = 1; i <= 3; i++) {
  const name = ncbc.sheetNameMap[String(i)] || `Sheet ${i}`;
  readSheet(ncbc, `worksheets/sheet${i}.xml`, name, 12);
}
