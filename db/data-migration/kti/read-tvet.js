// Extract clean text from TVET/CoVE Word doc preserving paragraph structure
const fs = require('fs');

const raw = fs.readFileSync('db/data-migration/kti/raw/_unzip_tvet_cove/word/document.xml', 'utf8');

// Extract paragraphs
const paras = raw.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
const lines = [];

for (const para of paras) {
  // Check for heading style
  const styleMatch = para.match(/w:styleId="([^"]+)"/);
  const style = styleMatch ? styleMatch[1] : '';
  
  // Get all text runs
  const runs = para.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
  const text = runs.map(r => r.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '')).join('');
  const trimmed = text.trim();
  
  if (trimmed.length > 0) {
    if (style.includes('eading')) {
      lines.push('\n## ' + trimmed);
    } else {
      lines.push(trimmed);
    }
  }
}

console.log(lines.join('\n'));
