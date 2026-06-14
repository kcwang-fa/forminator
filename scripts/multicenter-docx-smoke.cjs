// 驗證 DOC-12 多中心官方四欄表格：
//   1. 多中心資料會依中心數量展開列數。
//   2. 單中心會保留原範本的兩列空白資料列。

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const TEMPLATE = path.join(__dirname, '../public/templates/DOC-12.docx');

function render(multicenterSiteRows) {
  const zip = new PizZip(fs.readFileSync(TEMPLATE));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.render({ multicenter_site_rows: multicenterSiteRows });
  return doc.getZip().file('word/document.xml').asText();
}

function extractMulticenterRows(xml) {
  const anchorIndex = xml.indexOf('國別</w:t>');
  assert.notStrictEqual(anchorIndex, -1, '找不到多中心表格表頭');

  const tableStart = xml.lastIndexOf('<w:tbl>', anchorIndex);
  const tableEnd = xml.indexOf('</w:tbl>', anchorIndex) + '</w:tbl>'.length;
  assert.ok(tableStart >= 0 && tableEnd > tableStart, '找不到多中心表格範圍');

  const table = xml.substring(tableStart, tableEnd);
  return [...table.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)].map((row) =>
    [...row[0].matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)].map((cell) =>
      [...cell[0].matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((text) => text[1])
        .join(''),
    ),
  );
}

const multicenterRows = extractMulticenterRows(render([
  {
    country: '臺灣',
    city: '臺北市',
    location: '疾病管制署',
    contact: '王小明／02-12345678／wang@example.org',
  },
  {
    country: '臺灣',
    city: '高雄市',
    location: '高雄醫學大學附設醫院',
    contact: '李小華／07-1234567／lee@example.org',
  },
  {
    country: '日本',
    city: '東京',
    location: '研究中心',
    contact: 'Tanaka／+81-3-1234-5678／tanaka@example.org',
  },
]));

assert.deepStrictEqual(multicenterRows[0], ['國別', '城市', '地點', '聯絡人姓名/電話/電子信箱']);
assert.strictEqual(multicenterRows.length, 4, '三個中心應輸出表頭加三列資料');
assert.deepStrictEqual(multicenterRows[1], [
  '臺灣',
  '臺北市',
  '疾病管制署',
  '王小明／02-12345678／wang@example.org',
]);
assert.deepStrictEqual(multicenterRows[3], [
  '日本',
  '東京',
  '研究中心',
  'Tanaka／+81-3-1234-5678／tanaka@example.org',
]);

const singleCenterRows = extractMulticenterRows(render([
  { country: '', city: '', location: '', contact: '' },
  { country: '', city: '', location: '', contact: '' },
]));
assert.strictEqual(singleCenterRows.length, 3, '單中心應保留表頭加兩列空白資料');
assert.deepStrictEqual(singleCenterRows[1], ['', '', '', '']);
assert.deepStrictEqual(singleCenterRows[2], ['', '', '', '']);

console.log('✅ DOC-12 多中心表格 smoke test 通過（動態列 + 單中心兩列空白）');
