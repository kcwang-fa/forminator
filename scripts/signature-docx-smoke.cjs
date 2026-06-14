// 簽名圖嵌入 smoke test。
// 驗證「注入後的模板 + docxtemplater-image-module-free」整條路是通的：
//   1. DOC-5 有簽名 → 簽章欄出現 <w:drawing>、media 檔存在、標籤不殘留
//   2. DOC-5 沒簽名 → 零 drawing、簽章欄維持原樣（可手簽）、標籤不殘留
//   3. DOC-2 多張圖（封面 + 附表一逐人 loop）→ 張數正確、docPr id 不重複
//      （docPr id 重複會讓 Word 開檔報「內容有問題」，靠 fix-doc-pr-corruption 修）
// 跑法：npm run smoke:signature-docx（需先 inject-doc2 / inject-doc5 產出模板）

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const ImageModule = require('docxtemplater-image-module-free');
// docxtemplater 官方修復模組（core 內建檔案），與 src/utils/docgen.ts 用同一支
const fixDocPrCorruption = require('docxtemplater/js/modules/fix-doc-pr-corruption.js');

// 1×1 黑色 PNG（最小合法 PNG），模擬簽名圖
const SIG_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// 與 docgen.ts 的 generateDoc 相同的渲染設定（image module + 修復模組）
function render(templateFile, data) {
  const zip = new PizZip(fs.readFileSync(path.join(__dirname, '../public/templates', templateFile)));
  const imageModule = new ImageModule({
    centered: false,
    getImage: (tagValue) => Buffer.from(tagValue.slice(tagValue.indexOf(',') + 1), 'base64'),
    getSize: () => [120, 40],
  });
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
    modules: [imageModule, fixDocPrCorruption],
  });
  doc.render(data);
  const out = doc.getZip();
  return {
    xml: out.file('word/document.xml').asText(),
    mediaFiles: Object.keys(out.files).filter((f) => f.startsWith('word/media/')),
  };
}

const countDrawings = (xml) => (xml.match(/<w:drawing>/g) || []).length;
const docPrIds = (xml) => [...xml.matchAll(/<wp:docPr id="(\d+)"/g)].map((m) => m[1]);

// ===== 1. DOC-5 有簽名 =====
{
  const { xml, mediaFiles } = render('DOC-5.docx', { pi_has_sig: true, pi_sig: SIG_PNG });
  assert.equal(countDrawings(xml), 1, 'DOC-5 有簽名應恰好 1 張圖');
  assert.ok(mediaFiles.length >= 1, 'DOC-5 media 資料夾應有圖檔');
  assert.ok(!xml.includes('pi_sig'), 'DOC-5 不應殘留簽名標籤');
  // 單位主管簽章欄必須乾淨（不得有圖）：取該 label 之後 400 字元檢查
  const mgr = xml.indexOf('單位主管簽章：');
  assert.ok(mgr > 0, 'DOC-5 應有單位主管簽章欄');
  assert.ok(!xml.slice(mgr, mgr + 400).includes('<w:drawing>'), 'DOC-5 單位主管欄不得出現簽名圖');
  console.log('[signature-docx-smoke] ✓ DOC-5 有簽名：1 張圖、主管欄乾淨');
}

// ===== 2. DOC-5 沒簽名（留白可手簽）=====
{
  const { xml } = render('DOC-5.docx', { pi_has_sig: false, pi_sig: '' });
  assert.equal(countDrawings(xml), 0, 'DOC-5 沒簽名不應有任何圖');
  assert.ok(!xml.includes('pi_sig'), 'DOC-5 沒簽名也不應殘留標籤');
  console.log('[signature-docx-smoke] ✓ DOC-5 沒簽名：零圖、標籤不殘留');
}

// ===== 3. DOC-2 多張圖（封面 + 附表一逐人 loop）=====
// 兩位人員：王小明有簽、李大華沒簽。預期圖數 =
//   封面主持人 1 + 附表一填表人 1（只有王小明簽了）+ 附表一主持人簽章 2（每人一份附表一）= 4
{
  const { xml } = render('DOC-2.docx', {
    pi_has_sig: true,
    pi_sig: SIG_PNG,
    personnel_appendix: [
      { pa_name_zh: '王小明', pa_has_sig: true,  pa_sig: SIG_PNG },
      { pa_name_zh: '李大華', pa_has_sig: false, pa_sig: '' },
    ],
  });
  assert.equal(countDrawings(xml), 4, 'DOC-2 應恰好 4 張圖（封面1 + 填表人1 + 主持人簽章2）');
  const ids = docPrIds(xml);
  assert.equal(new Set(ids).size, ids.length, `DOC-2 docPr id 不得重複（實際：${ids.join(',')}）`);
  assert.ok(!xml.includes('{%pi_sig}') && !xml.includes('{%pa_sig}'), 'DOC-2 不應殘留簽名標籤');
  console.log('[signature-docx-smoke] ✓ DOC-2 多張圖：4 張、docPr id 不重複');
}

// ===== 4. 逐人文件 DOC-6 / DOC-7（person_sig）=====
// ⚠️ DOC-7 範本本身就內含 2 張圖（DOC-8 內含 1 張），不能斷言「總共 1 張」，
//    要斷言「簽名後比沒簽名多恰好 1 張」（差值法，對範本既有圖免疫）。
{
  for (const file of ['DOC-6.docx', 'DOC-7.docx']) {
    const unsigned = render(file, { person_name_zh: '王小明', person_has_sig: false, person_sig: '' });
    const signed   = render(file, { person_name_zh: '王小明', person_has_sig: true,  person_sig: SIG_PNG });
    const baseline = countDrawings(unsigned.xml);
    assert.equal(countDrawings(signed.xml), baseline + 1, `${file} 有簽名應比沒簽名多恰好 1 張圖`);
    assert.ok(!unsigned.xml.includes('person_sig'), `${file} 不應殘留簽名標籤`);
  }
  console.log('[signature-docx-smoke] ✓ DOC-6/DOC-7 逐人簽名：簽名多 1 張、沒簽不殘留');
}

// ===== 5. DOC-8 / DOC-12 / DOC-13（pi_sig，主管欄必須乾淨）=====
{
  for (const [file, mgrLabel] of [
    ['DOC-8.docx', '單位主管簽名'],
    ['DOC-12.docx', '單位主管簽章：'],
    ['DOC-13.docx', '單位主管簽章：'],
  ]) {
    const unsigned = render(file, { pi_has_sig: false, pi_sig: '' });
    const signed   = render(file, { pi_has_sig: true,  pi_sig: SIG_PNG });
    assert.equal(countDrawings(signed.xml), countDrawings(unsigned.xml) + 1,
      `${file} 有簽名應比沒簽名多恰好 1 張圖`);
    // 主管欄乾淨檢查：簽名前後，主管 label 之後 400 字元內的圖數必須相同
    // （= 我們的注入完全沒碰主管欄；用差值法對範本既有圖免疫）
    const mgrArea = (xml) => {
      const i = xml.indexOf(mgrLabel);
      assert.ok(i > 0, `${file} 應有「${mgrLabel}」欄`);
      return (xml.slice(i, i + 400).match(/<w:drawing>/g) || []).length;
    };
    assert.equal(mgrArea(signed.xml), mgrArea(unsigned.xml), `${file} 主管欄不得出現簽名圖`);
  }
  console.log('[signature-docx-smoke] ✓ DOC-8/DOC-12/DOC-13 申請人簽名：簽名多 1 張、主管欄乾淨');
}

console.log('[signature-docx-smoke] ✓ 全部通過');
