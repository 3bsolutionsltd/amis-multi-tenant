/**
 * xlsx.js — Extract sheets from an .xlsx file into arrays of row objects.
 * Uses native .NET ZipFile + XML parsing (no npm dependencies).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

/**
 * Extract and parse all sheets from an xlsx file.
 * @param {string} xlsxPath  Absolute or relative path to the .xlsx file
 * @returns {{ sheetName: string, rows: string[][] }[]}
 */
function readXlsx(xlsxPath) {
  const abs = path.resolve(xlsxPath);
  const tmpDir = path.join(os.tmpdir(), `xlsx_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  // Extract using .NET ZipFile (Windows; works on Node without extra modules)
  execSync(
    `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${abs.replace(/\\/g, '\\\\')}', '${tmpDir.replace(/\\/g, '\\\\')}')"`,
    { stdio: 'pipe' }
  );

  // Load shared strings
  const ssPath = path.join(tmpDir, 'xl', 'sharedStrings.xml');
  const shared = [];
  if (fs.existsSync(ssPath)) {
    const ssXml = fs.readFileSync(ssPath, 'utf8');
    const siMatches = ssXml.match(/<si>[\s\S]*?<\/si>/g) || [];
    for (const si of siMatches) {
      const tMatches = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
      shared.push(tMatches.map(t => t.replace(/<t[^>]*>/, '').replace(/<\/t>/, '')).join(''));
    }
  }

  // Load workbook sheet names
  const wbXml = fs.readFileSync(path.join(tmpDir, 'xl', 'workbook.xml'), 'utf8');
  const sheetDefs = [...wbXml.matchAll(/name="([^"]+)".*?r:id="(rId\d+)"/g)].map(m => ({
    name: m[1],
    rId: m[2],
  }));

  // Map rId → sheetN.xml via workbook.xml.rels
  const relsPath = path.join(tmpDir, 'xl', '_rels', 'workbook.xml.rels');
  const relsXml = fs.readFileSync(relsPath, 'utf8');
  const relMap = {};
  for (const m of relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
    relMap[m[1]] = m[2]; // e.g. rId1 → worksheets/sheet1.xml
  }

  // Parse each sheet
  const results = [];
  for (const def of sheetDefs) {
    const target = relMap[def.rId];
    if (!target) continue;
    const sheetFile = path.join(tmpDir, 'xl', target.replace(/\//g, path.sep));
    if (!fs.existsSync(sheetFile)) continue;

    const sheetXml = fs.readFileSync(sheetFile, 'utf8');
    const rows = [];
    const rowMatches = sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];

    for (const rowXml of rowMatches) {
      const cells = [...rowXml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)];
      const rowObj = {};
      let maxCol = 0;

      for (const cell of cells) {
        const col = colIndex(cell[1]);
        const attrs = cell[3];
        const inner = cell[4];
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        let val = '';

        if (vMatch) {
          if (/t="s"/.test(attrs)) {
            val = shared[parseInt(vMatch[1], 10)] ?? '';
          } else if (/t="str"/.test(attrs) || /t="inlineStr"/.test(attrs)) {
            const tMatch = inner.match(/<t>([\s\S]*?)<\/t>/);
            val = tMatch ? tMatch[1] : vMatch[1];
          } else {
            val = vMatch[1];
          }
        }
        rowObj[col] = val;
        if (col > maxCol) maxCol = col;
      }

      // Convert to dense array
      const arr = [];
      for (let i = 0; i <= maxCol; i++) arr.push(rowObj[i] ?? '');
      rows.push(arr);
    }

    results.push({ sheetName: def.name, rows });
  }

  // Cleanup temp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });
  return results;
}

/** Convert Excel column letters (A, B, ..., Z, AA, AB...) to 0-based index */
function colIndex(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

module.exports = { readXlsx };
