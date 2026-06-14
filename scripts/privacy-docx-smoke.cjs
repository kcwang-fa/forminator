// 驗證 DOC-5 / DOC-12 的隱私保護三段 placeholder 可正常渲染且順序不漂移。

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

const VALUES = {
  privacy_during: 'PRIVACY_DURING_研究中測試',
  privacy_after: 'PRIVACY_AFTER_研究結束後測試',
  privacy_withdrawal: 'PRIVACY_WITHDRAWAL_中途退出測試',
};

function renderTemplate(docId) {
  const templatePath = path.join(__dirname, `../public/templates/${docId}.docx`);
  const zip = new PizZip(fs.readFileSync(templatePath));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.render({
    ...VALUES,
    multicenter_site_rows: [
      { country: '', city: '', location: '', contact: '' },
      { country: '', city: '', location: '', contact: '' },
    ],
  });
  const xml = doc.getZip().file('word/document.xml').asText();
  return [...xml.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join('');
}

for (const docId of ['DOC-5', 'DOC-12']) {
  const text = renderTemplate(docId);
  const duringIndex = text.indexOf(VALUES.privacy_during);
  const afterIndex = text.indexOf(VALUES.privacy_after);
  const withdrawalIndex = text.indexOf(VALUES.privacy_withdrawal);

  assert.ok(duringIndex >= 0, `${docId} 找不到研究中隱私保護文字`);
  assert.ok(afterIndex > duringIndex, `${docId} 研究結束後文字順序錯誤`);
  assert.ok(withdrawalIndex > afterIndex, `${docId} 中途退出文字順序錯誤`);
}

console.log('[privacy-docx-smoke] ✓ DOC-5 / DOC-12 隱私三段渲染與順序正確');
