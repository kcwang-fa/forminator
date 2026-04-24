// Phase 0 baseline snapshot — docgen 重構前的迴歸護網
//
// 用途：
//   npm run snapshot:write  → 產出 scripts/baselines/placeholders.json（基準線）
//   npm run snapshot:check  → 重跑 prepareCommonData + 逐人合併，比對基準線
//
// 設計重點：
//   - 我們不跑完整的 docxtemplater 渲染（那會牽扯模板 XML），只快照 placeholder 物件本身
//   - placeholder 物件的 key/value 若在 Phase 1/2 重構後有差異 → 立即抓到行為漂移
//   - key 排序後輸出，確保 JSON 文字穩定、diff 可讀
//   - 逐人文件（DOC-6 / DOC-7）按 personnel 順序迭代，快照每一份 personData
//
// 注意：fetch / saveAs 等瀏覽器 API 在此不會被觸發，因為我們只呼叫 prepareCommonData()。

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareCommonData } from '../src/utils/docgen';
import { fixtureExemptFunded } from './fixtures/fixture-exempt-funded';
import type { Personnel } from '../src/types/form';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = resolve(__dirname, 'baselines/placeholders.json');

// 與 docgen.ts 的 generatePerPersonDoc() 同步：逐人文件會在 commonData 之上
// 合併每位人員的基本資料與 role checkbox。若該邏輯變動，此處要同步更新。
function mergePerPersonData(baseData: Record<string, unknown>, person: Personnel) {
  return {
    ...baseData,
    person_name_zh: person.name_zh,
    person_title: person.title,
    person_unit: person.unit,
    person_phone: person.phone,
    person_email: person.email,
    person_id_number: person.id_number,
    role_pi: person.role === 'pi' ? '■' : '□',
    role_co_pi: person.role === 'co_pi' ? '■' : '□',
    role_researcher: person.role === 'researcher' ? '■' : '□',
    role_other: !['pi', 'co_pi', 'researcher'].includes(person.role) ? '■' : '□',
  };
}

// 遞迴排序 object 的 key，陣列保持順序
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, sortKeys(v)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

function buildSnapshot() {
  const common = prepareCommonData(fixtureExemptFunded);
  const perPerson = fixtureExemptFunded.personnel.map(p => ({
    role: p.role,
    name_zh: p.name_zh,
    data: mergePerPersonData(common, p),
  }));
  return sortKeys({
    fixture: 'exempt-funded',
    common,
    perPerson,
  });
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

function write() {
  const snapshot = buildSnapshot();
  writeFileSync(BASELINE_PATH, stableStringify(snapshot), 'utf8');
  console.log(`[snapshot] baseline 已寫入：${BASELINE_PATH}`);
}

function check() {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`[snapshot] 找不到基準線檔案：${BASELINE_PATH}`);
    console.error('[snapshot] 請先執行 npm run snapshot:write 建立基準線');
    process.exit(2);
  }
  const expected = readFileSync(BASELINE_PATH, 'utf8');
  const actual = stableStringify(buildSnapshot());
  if (actual === expected) {
    console.log('[snapshot] ✓ 與基準線完全一致');
    return;
  }
  console.error('[snapshot] ✗ 快照與基準線有差異，列出前 80 行 diff：');
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const maxLen = Math.max(expectedLines.length, actualLines.length);
  let shown = 0;
  for (let i = 0; i < maxLen && shown < 80; i++) {
    if (expectedLines[i] !== actualLines[i]) {
      console.error(`  L${i + 1}`);
      console.error(`    - ${expectedLines[i] ?? '<EOF>'}`);
      console.error(`    + ${actualLines[i] ?? '<EOF>'}`);
      shown++;
    }
  }
  process.exit(1);
}

const mode = process.argv[2];
if (mode === 'write') write();
else if (mode === 'check') check();
else {
  console.error('用法：tsx scripts/docgen-snapshot.ts <write|check>');
  process.exit(2);
}
