// Extract text from Word DOCX (word/document.xml)
const fs = require('fs');

function readDocx(base, label) {
  const docPath = base + '/word/document.xml';
  if (!fs.existsSync(docPath)) { console.log(`${label}: document.xml not found`); return; }
  const raw = fs.readFileSync(docPath, 'utf8');
  
  // Extract text runs from paragraphs
  const paras = raw.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  console.log(`\n${'='.repeat(60)}\n${label}\n${'='.repeat(60)}`);
  for (const para of paras) {
    const runs = para.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    const text = runs.map(r => r.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, '')).join('');
    const trimmed = text.trim();
    if (trimmed.length > 0) console.log(trimmed);
  }
}

readDocx(
  'db/data-migration/kti/raw/_unzip_student_data_form_at_institutional_level_docx',
  'STUDENT DATA FORM'
);
readDocx(
  'db/data-migration/kti/raw/_unzip______private_admission_letters__docx',
  'ADMISSION LETTER'
);
