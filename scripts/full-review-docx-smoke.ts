// 一般審查 smoke test：
//   1. IRB 文件清單包含 DOC-12、排除簡審專用 DOC-13。
//   2. DOC-12 正確勾選「不符合簡易審查／不符合免予審查」。
//   3. 一般審資料可完整渲染 DOC-12，且不殘留 placeholder。

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import PizZip from 'pizzip';
import fixDocPrCorruption from 'docxtemplater/js/modules/fix-doc-pr-corruption.js';
import { defaultFormData } from '../src/data/defaults';
import { resolveActivePlan } from '../src/data/planConfigs';
import { prepareCommonData } from '../src/utils/docgen';
import { prepareIrb002_1Data } from '../src/utils/docgen/irb0021';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatePath = resolve(__dirname, '../public/templates/DOC-12.docx');

const active = resolveActivePlan('full', ['irb']);
assert.equal(active.planConfig.ready, true);
assert.deepEqual(active.docs, ['DOC-3', 'DOC-4', 'DOC-6', 'DOC-12']);
assert.ok(!active.docs.includes('DOC-13'), '一般審不得包含簡審專用 IRB-003');
assert.match(active.planConfig.workflowSteps[1]?.description || '', /2 位主審委員/);

const fullReviewData = {
  ...defaultFormData,
  review_type: 'full' as const,
  project_title_zh: '一般審查測試計畫',
  project_title_en: 'Full Review Test Project',
};

const irb0021 = prepareIrb002_1Data(fullReviewData);
assert.equal(irb0021.irb0021_meets_expedited, '□');
assert.equal(irb0021.irb0021_not_meets_expedited, '■');
assert.equal(irb0021.irb0021_meets_exempt, '□');
assert.equal(irb0021.irb0021_not_meets_exempt, '■');

const zip = new PizZip(readFileSync(templatePath));
const imageModule = new ImageModule({
  centered: false,
  getImage: () => {
    throw new Error('一般審 smoke test 未提供簽名，不應要求讀取圖片');
  },
  getSize: () => [120, 40],
});
const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
  delimiters: { start: '{', end: '}' },
  modules: [imageModule, fixDocPrCorruption],
});
doc.render(prepareCommonData(fullReviewData));

const xml = doc.getZip().file('word/document.xml').asText();
assert.ok(!/\{[#/%]?[A-Za-z0-9_]+\}/.test(xml), 'DOC-12 不應殘留未渲染 placeholder');
assert.ok(!xml.includes('pi_sig'), '未簽名時 DOC-12 不應殘留簽名標籤');

console.log('[full-review-docx-smoke] ✓ 一般審文件清單、審查勾選與 DOC-12 渲染正確');
