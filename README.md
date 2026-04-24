# 研究計畫表單終結者 Forminator

> "I'll be back... with all 11 forms."

疾管署（CDC）研究計畫申請表單自動化工具。研究人員填寫一次精靈式表單，即可打包下載 DOC-1 ~ DOC-11 共 11 份預填好的 Word 文件。

目前支援計畫類型：

- ✅ **署內資料庫回溯性研究（免審，無經費）**
- ✅ **署內資料庫回溯性研究（免審，有經費）**
- 🚧 簡易審查、一般審查（模板待備）

## 功能

- 精靈式表單，依計畫類型動態切換步驟
- AI 自動翻譯計畫名稱（中→英），支援 Groq / Google Gemini
- AI 自動生成中英文摘要與關鍵詞
- 自動產生甘特圖（依執行期程推算 7 項預設任務）
- 經費概算自動計算（含管理費規則、PI 費不計入基數）
- 一鍵打包下載 ZIP（依計畫類型自動選取需要的文件）
- 自動儲存草稿（localStorage，2 秒 debounce，寫入失敗時自動改為 JSON 下載）
- 草稿匯出/匯入（JSON，含版本檢查）
- 4 關跑關流程指引（研究計畫上簽 → IRB 審查 → 資料庫申請 → 資訊室去識別化）

## 產出文件

以 `src/data/defaults.ts` 的 `DOC_NAMES` 為唯一權威來源。

| 編號 | 文件名稱 | 使用關卡 |
|------|---------|---------|
| DOC-1  | 研究計畫簽呈（含公文系統操作說明） | Step 1 |
| DOC-2  | 署內研究計畫書（封面 + 壹~捌主體 + 附表一~三） | Step 1, Step 2 |
| DOC-3  | IRB-002 計畫送件核對表 | Step 2 |
| DOC-4  | IRB-004 研究計畫書 | Step 2 |
| DOC-5  | IRB-012 免審申請表 | Step 2 |
| DOC-6  | IRB-018 保密切結書（研究人員，逐人） | Step 2 |
| DOC-7  | 資料庫保密切結書（署內員工使用，逐人） | Step 3 |
| DOC-8  | 資料庫使用申請單 | Step 3 |
| DOC-9  | 資料庫申請簽呈（含公文系統操作說明） | Step 3 |
| DOC-10 | 個人資料利用申請表 | Step 3 |
| DOC-11 | 應用系統維護單 | Step 4 |

> DOC-2 ~ DOC-11 使用 CDC/IRB 官方 Word 模板注入佔位符（`{placeholder}`）；DOC-1 由程式碼從零生成。DOC-6、DOC-7 為逐人文件（每位研究人員各一份）。

## 快速開始

```bash
git clone https://github.com/kcwang-fa/forminator.git
cd forminator
npm install
npm run dev
```

常用指令：

| 指令 | 說明 |
|------|------|
| `npm run dev` | Vite dev server + API proxy |
| `npm run build` | `tsc -b && vite build` → `/dist/` |
| `npm start` | Express 伺服器（port 3000） |
| `npm run lint` | ESLint |
| `npm run inject-doc<N>` | 重新生成 DOC-N.docx 模板（N = 2~11） |
| `npm run inject-all` | 一次重建 DOC-2 ~ DOC-11 全部模板 |
| `npm run snapshot:write` | 產出 `prepareCommonData` 基準線 |
| `npm run snapshot:check` | 比對當前輸出與基準線（重構抓行為漂移） |

## AI 設定

AI 翻譯與摘要功能支援兩種 LLM 服務。使用者在網頁右上角「AI 設定」面板選擇並輸入 API Key（僅存於瀏覽器 localStorage，不上傳伺服器）：

| 服務 | 模型 | 取得 API Key |
|------|------|-------------|
| Groq | Qwen3 32B | [Groq Console](https://console.groq.com/keys) |
| Google Gemini | Gemini 2.5 Flash-Lite | [Google AI Studio](https://aistudio.google.com/apikey) |

後端環境變數（本地開發或自架部署時使用）：

```bash
export GROQ_API_KEY=your_key_here      # 後端 fallback
export GROQ_MODEL=qwen/qwen3-32b       # 可選，預設值
```

> qwen3 會輸出 `<think>...</think>` 思考標籤，後端會先清除再用 regex 提取 JSON。

## 技術架構

```
瀏覽器（前端）
├── React 19 + TypeScript + Vite 8
├── Ant Design 6（UI，locale: zh_TW）
├── React Hook Form（單一 FormData，跨 wizard steps 共享）
├── docxtemplater + PizZip（Word 模板填入）
├── JSZip + file-saver（ZIP 打包下載）
└── dayjs（日期處理，含 ROC ↔ 西元轉換）

伺服器（後端）
├── Vercel Serverless Functions（正式環境，api/llm/*.js）
├── Express（本地開發 / Railway，server.js）
└── Groq API / Google Gemini（AI 翻譯 & 摘要）
```

### 資料流

React Hook Form (`useFormStore.ts`) 管理單一 `FormData`，步驟由 `PlanConfig.wizardStepKeys` 驅動（切換 `review_type` 自動調整步驟）。送出時 `docgen.ts` 將 FormData 映射為 docxtemplater placeholders，從 `public/templates/` 讀取 `.docx` 模板，打包成 ZIP 下載。

### 新增計畫類型 SOP

1. `src/types/form.ts` — 確認 `ReviewType` 包含新類型
2. `src/data/planConfigs.ts` — 在 `PLAN_CONFIGS` 加一個 key（`docs` / `wizardStepKeys` / `workflowSteps` / `ready`）
3. 準備 `scripts/inject-docN.cjs` 和 Word 原始範本（放到 `../source-templates/`），執行後 output 到 `public/templates/`
4. `Step4IRB` — 若新類型需要額外欄位，加條件式渲染
5. `src/data/defaults.ts` — `DOC_NAMES` 補上新增的 DOC 編號

其餘（App.tsx、WorkflowGuide、useDocumentGeneration）自動讀 planConfig，不用改。

## 模板維護

1. 將 CDC 原始 `.docx` 放入 `../source-templates/`（`forminator/` 的上層）
2. `.doc` 需先用 Word 另存為 `.docx`（例如 DOC-3 來源）
3. 執行 `npm run inject-doc<N>`，輸出至 `public/templates/DOC-N.docx`

完整檔案對應、placeholder mapping、DOC-2 loop 結構（personnel_appendix / gantt_rows / budget_rows）等細節見 [`CLAUDE.md`](./CLAUDE.md)。

## 部署

- **Vercel**（primary）：推送至 `main` 自動部署，`vercel.json` 設定 Vite framework + SPA rewrite
- **Railway**（legacy）：`server.js` 同時提供靜態 dist 與 API proxy

## 授權

MIT
