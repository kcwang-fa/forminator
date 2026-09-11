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

function render(multicenterSiteRows, otherSitePiRows = [{ osp_name: '', osp_title: '', osp_unit: '', osp_phone: '' }]) {
  const zip = new PizZip(fs.readFileSync(TEMPLATE));
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.render({
    multicenter_site_rows: multicenterSiteRows,
    other_site_pi_rows: otherSitePiRows,
  });
  return doc.getZip().file('word/document.xml').asText();
}

// 抽出基本資料區「署外其他中心計畫主持人」表的資料列。
// 一位主持人 = 兩列（服務單位/聯絡電話 + 姓名/職稱），所以列數應為主持人數 × 2。
function extractOtherSitePiRows(xml) {
  const anchorIndex = xml.indexOf('署外其他中心計畫主持人');
  assert.notStrictEqual(anchorIndex, -1, '找不到署外主持人題');
  const endIndex = xml.indexOf('研究描述', anchorIndex);
  assert.ok(endIndex > anchorIndex, '找不到署外主持人表的結束位置');

  return [...xml.substring(anchorIndex, endIndex).matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)].map((row) =>
    [...row[0].matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)].map((cell) =>
      [...cell[0].matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((text) => text[1])
        .join(''),
    ),
  );
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

// ===== 署外其他中心計畫主持人表（兩列一組的 loop）=====
const emptySite = { country: '', city: '', location: '', contact: '' };

const twoPiRows = extractOtherSitePiRows(render([emptySite], [
  { osp_name: '陳大文', osp_title: '主治醫師', osp_unit: '臺大醫院感染科', osp_phone: '02-23123456' },
  { osp_name: '林小美', osp_title: '研究員', osp_unit: '高醫附院*', osp_phone: '07-3121101' },
]));
assert.strictEqual(twoPiRows.length, 4, '兩位署外主持人應輸出 4 列（每人兩列）');
assert.deepStrictEqual(twoPiRows[0], ['計畫主持人', '服務單位', '臺大醫院感染科', '聯絡電話', '02-23123456']);
assert.deepStrictEqual(twoPiRows[1], ['', '姓名', '陳大文', '職稱', '主治醫師']);
assert.deepStrictEqual(twoPiRows[2], ['計畫主持人', '服務單位', '高醫附院*', '聯絡電話', '07-3121101']);
assert.deepStrictEqual(twoPiRows[3], ['', '姓名', '林小美', '職稱', '研究員']);

const emptyPiRows = extractOtherSitePiRows(render([emptySite]));
assert.strictEqual(emptyPiRows.length, 2, '沒有署外主持人資料時仍應保留原本兩列空白版型');
assert.deepStrictEqual(emptyPiRows[0], ['計畫主持人', '服務單位', '', '聯絡電話', '']);
assert.deepStrictEqual(emptyPiRows[1], ['', '姓名', '', '職稱', '']);

console.log('✅ DOC-12 多中心表格 smoke test 通過（動態列 + 單中心兩列空白 + 署外主持人兩列一組）');
