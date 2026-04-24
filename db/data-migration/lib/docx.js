/**
 * docx.js — Extract plain text from a .docx file.
 * Uses native .NET ZipFile + XML parsing (no npm dependencies).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

/**
 * Extract and return all paragraph text from a .docx file.
 * @param {string} docxPath  Absolute or relative path to the .docx file
 * @returns {string[]}  Array of non-empty paragraph strings
 */
function readDocx(docxPath) {
  const abs = path.resolve(docxPath);
  const tmpDir = path.join(os.tmpdir(), `docx_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  execSync(
    `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${abs.replace(/\\/g, '\\\\')}', '${tmpDir.replace(/\\/g, '\\\\')}')"`,
    { stdio: 'pipe' }
  );

  const docXml = fs.readFileSync(path.join(tmpDir, 'word', 'document.xml'), 'utf8');
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const paras = docXml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  const lines = [];
  for (const para of paras) {
    const runs = para.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    const text = runs.map(r => r.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '')).join('').trim();
    if (text.length > 0) lines.push(text);
  }
  return lines;
}

module.exports = { readDocx };
