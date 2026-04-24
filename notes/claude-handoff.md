# Claude Handoff

## Date

- 2026-04-24

## Current status

- `Step5Database` uses `database_requests[]` for multiple database systems.
- `apply_year_start` / `apply_year_end` are shared global fields on `FormData`.
- UI only keeps the bottom-level `資料庫預定使用範圍彙整預覽`.
- legacy drafts / imported JSON are normalized through `src/utils/formNormalization.ts`.
- The first-stage UI refactor is partially done:
  - desktop form page is now a 2-column workbench
  - left column = workflow / progress
  - main column = current step form
  - the temporary right-side cards (`本關輸出文件 / 本關提醒 / 目前摘要`) were removed again to give more room to the form
  - the top standalone hero block (`研究計畫送件工作台`) was also removed
- Font settings were intentionally kept unchanged.

## Today changes

### 1. Result page document selection UI

- `src/App.tsx`
- `選擇要產生的文件` was changed to grouped expandable sections:
  - `IRB` -> `DOC-1` to `DOC-6`
  - `資料庫` -> `DOC-7` to `DOC-11`
- Group checkbox behavior was adjusted:
  - selecting `IRB` selects all IRB docs
  - selecting `資料庫` selects all database docs
  - if both groups are selected, clicking one isolates that group
  - partial child selection shows indeterminate state
- Group header checkbox was separated from the inner `Checkbox.Group` logic to avoid the earlier wrong-group toggle bug.

### 2. Database workflow text and ordering

- `src/data/planConfigs.ts`
- Signature/order wording was updated so database docs are shown in doc order:
  - `DOC-7` 資料庫保密切結書
  - `DOC-8` 資料庫使用申請單
  - `DOC-10` 個人資料利用申請表
- Step 4 description was changed from `第 3 關奉核後` to `資料庫申請奉核後`.

### 3. DOC-10 / DOC-11 were swapped globally

- `src/data/defaults.ts`
- `src/data/planConfigs.ts`
- `src/utils/docgen.ts`
- `scripts/inject-doc10.cjs`
- `scripts/inject-doc11.cjs`
- `public/templates/DOC-10.docx`
- `public/templates/DOC-11.docx`

Current mapping:

- `DOC-10 = 個人資料利用申請表`
- `DOC-11 = 應用系統維護單`

Workflow now matches that mapping:

- Step 3 uses `DOC-10`
- Step 4 uses `DOC-11`

### 4. DOC-11 layout and content fixes

- `scripts/inject-doc11.cjs`
- `src/utils/docgen.ts`
- `public/templates/DOC-11.docx`

Changes:

- Fixed the broken vertical-layout issue in `需求內容描述`.
- The left vertical label stays as `需求內容描述`.
- The actual content is injected into the right content area.
- `doc11_request_desc` now uses `buildDatabaseUsageScopePreview(...)`, so DOC-11 matches the UI preview text.

### 5. DOC-8 deadline and personnel fixes

- `src/utils/docgen.ts`
- `scripts/inject-doc8.cjs`
- `public/templates/DOC-8.docx`

Changes:

- `DOC-8` `資料使用期限` / `分析期限` now prefers `execution_end`; fallback is `analysis_deadline`.
- `db_personnel` now includes all filled personnel except `pi`.
- The `共同參與研究人員及實際處理資料人員清冊` table in `DOC-8` was not wired before; today a row loop was injected:
  - `{#db_personnel}{name_zh}`
  - `{unit}`
  - `{title}`
  - `{phone}{/db_personnel}`
- Four blank roster rows were collapsed into one loop row, so docxtemplater can expand the roster at generation time.
- There was a second bug after the loop injection: placeholders were inserted left-to-right and shifted later cell offsets, causing the roster columns to drift.
- `scripts/inject-doc8.cjs` now injects roster placeholders right-to-left so the final order stays:
  - 姓名 -> `{name_zh}`
  - 服務單位 -> `{unit}`
  - 職稱 -> `{title}`
  - 聯絡電話 -> `{phone}`

### 6. DOC-9 explanation / proposal formatting fix

- `scripts/inject-doc9.cjs`
- `public/templates/DOC-9.docx`

Changes:

- `說明` and `擬辦` were previously split across multiple Word paragraphs and wrapped badly.
- They are now rebuilt as fixed full paragraphs:
  - `說明：`
  - `一、依據本署「防疫資料庫員工研究計畫使用申請作業」辦理。`
  - `二、本案研究計畫（附件1）已取得本署 IRB 審查許可書（附件2），合先敘明。`
  - `三、檢附本案申請所需相關表件如下：使用申請單（附件3），資訊安全管理系統文件之「個人資料利用申請表」（附件4）及保密切結書（附件5）。`
  - blank line
  - `擬辦：奉核後，填具「應用系統維護單」等相關表單委請資訊室協助進行資料去識別化處理，以產製本計畫所需之研究分析資料。`
- `DOC-9` subject no longer uses only `primaryRequest.apply_condition`.
- A new placeholder `doc9_apply_scope_text` is now generated in `src/utils/docgen.ts`.
- Its format is:
  - `資料擷取期間起迄民國年 + 第一個系統的擷取資料條件`
  - example: `113至114年 listeria`

### 7. First-stage UI refactor in App.tsx

- `src/App.tsx`

Changes:

- The old single-column wizard layout was changed into a workbench layout.
- Current desktop layout is:
  - left: `申請流程` + `目前進度`
  - center: current step form card
- The temporary right panel was removed after review because it reduced form space too much.
- The top hero card with `研究計畫送件工作台` was also removed; its useful status tags were folded back into the left workflow card.
- Current step card still shows:
  - current step number
  - affected docs as tags
  - a short hint sentence from `STEP_HINT_MAP`
- `本關輸出文件 / 本關提醒 / 目前摘要` are no longer rendered.

### 8. Recent UI copy adjustments

- `src/components/wizard/Step3Research.tsx`
- `src/components/wizard/Step5Database.tsx`
- `src/App.tsx`

Changes:

- `研究方法／實施方法及進行步驟` label was shortened to `研究方法`.
- The corresponding AI validation message in `Step5Database` was also changed to `請先填寫研究目的、研究方法...`.
- `預期成果及主要效益` label is now rendered as 2 lines:
  - `預期成果`
  - `及主要效益`
- The personnel step hint text in `STEP_HINT_MAP` was shortened to:
  - `這一步決定逐人文件與研究團隊附表內容。`

## Important document behavior

- `DOC-8` supports up to the first 3 non-empty `database_requests`.
- `DOC-8` `計畫期間` uses `execution_period_text`.
- `DOC-8` database blocks still use shared `apply_year_text`.
- `DOC-8` roster loop is now present and the roster cell order has been verified in regenerated XML.
- `DOC-10` is the personal data use form.
- `DOC-11` is the application system maintenance form.
- `DOC-11` request description now follows the UI preview wording, not the old custom assembled text.
- `DOC-9` subject now uses `doc9_apply_scope_text`, not raw `apply_condition`.
- Current form-page UI is intentionally room-first:
  - no top hero block
  - no right summary column
  - font family remains unchanged from existing theme token

## Files touched today

- `src/App.tsx`
- `src/components/wizard/Step3Research.tsx`
- `src/components/wizard/Step5Database.tsx`
- `src/data/defaults.ts`
- `src/data/planConfigs.ts`
- `src/utils/docgen.ts`
- `scripts/inject-doc8.cjs`
- `scripts/inject-doc9.cjs`
- `scripts/inject-doc10.cjs`
- `scripts/inject-doc11.cjs`
- regenerated:
  - `public/templates/DOC-8.docx`
  - `public/templates/DOC-9.docx`
  - `public/templates/DOC-10.docx`
  - `public/templates/DOC-11.docx`

## Validation status

- Passed:
  - `npm run inject-doc8`
  - `npm run inject-doc9`
  - `npm run inject-doc10`
  - `npm run inject-doc11`
  - `npm run build`
- Build still shows the existing large chunk warning from Vite, but no new compile error.

## Notes for Claude

- The git worktree is dirty with many unrelated user changes. Do not revert unrelated files.
- `notes/` may still show as untracked in `git status` depending on the repo state; this handoff file is the latest intended version.
- If the user says DOC-8 roster is still blank, the next thing to inspect is runtime data passed into docxtemplater, not the template XML. The template loop itself is now present in `public/templates/DOC-8.docx`.
- If the user says DOC-8 roster columns are shifted again, inspect `processDbPersonnelRoster()` first; the fragile point is placeholder injection order, not form data.
- If continuing the UI refactor, do not reintroduce a large hero block or a wide right sidebar by default unless the user asks again; the latest direction was to maximize form width.
