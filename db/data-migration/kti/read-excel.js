const fs = require('fs');
const AdmZip = require && false; // use manual unzip only

const base = 'db/data-migration/kti/raw/_unzip_general';

const ssRaw = fs.readFileSync(base + '/xl/sharedStrings.xml', 'utf8');
const wbRaw = fs.readFileSync(base + '/xl/workbook.xml', 'utf8');

// Parse shared strings - each <si> element holds one string (may have <t> or <r><t> children)
const strings = [];
const siMatches = ssRaw.match(/<si>([\s\S]*?)<\/si>/g) || [];
for (const si of siMatches) {
  const tMatches = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
  const combined = tMatches.map(t => t.replace(/<t[^>]*>/, '').replace(/<\/t>/, '')).join('');
  strings.push(combined);
}

// Parse workbook sheet names
const sheetNameMap = {};
const sheetMatches = wbRaw.match(/<sheet[^>]+>/g) || [];
for (const s of sheetMatches) {
  const nameM = s.match(/name="([^"]+)"/);
  const idM = s.match(/sheetId="([^"]+)"/);
  if (nameM && idM) sheetNameMap[idM[1]] = nameM[1];
}
console.log('\n=== SHEET NAMES ===');
Object.entries(sheetNameMap).forEach(([id, name]) => console.log(`  sheet${id}: ${name}`));

function readSheet(sheetFile, sheetName, numRows = 5) {
  if (!fs.existsSync(sheetFile)) return;
  const raw = fs.readFileSync(sheetFile, 'utf8');
  console.log(`\n=== ${sheetName.toUpperCase()} (first ${numRows} rows) ===`);
  
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
      if (!vMatch) { vals.push(`${colRef}:`); continue; }
      const v = vMatch[1];
      if (attrs.includes('t="s"')) {
        vals.push(`${colRef}:${strings[parseInt(v)] || '?'}`);
      } else {
        vals.push(`${colRef}:${v}`);
      }
    }
    console.log(`  Row ${rowNum}: ${vals.join('  |  ')}`);
    count++;
  }
}

// Read all meaningful sheets
const sheetsToRead = [
  { file: base + '/xl/worksheets/sheet1.xml', name: 'INSTITUTION PROFILE' },
  { file: base + '/xl/worksheets/sheet2.xml', name: 'PROGRAMME' },
  { file: base + '/xl/worksheets/sheet4.xml', name: 'STUDENTS REGISTER', rows: 10 },
  { file: base + '/xl/worksheets/sheet5.xml', name: 'MARKS' },
  { file: base + '/xl/worksheets/sheet6.xml', name: 'GRADES' },
  { file: base + '/xl/worksheets/sheet7.xml', name: 'FEES RECORDS' },
  { file: base + '/xl/worksheets/sheet8.xml', name: 'STAFF USERS' },
  { file: base + '/xl/worksheets/sheet11.xml', name: 'FEE COLLECTION' },
];

for (const s of sheetsToRead) {
  readSheet(s.file, s.name, s.rows || 6);
}
