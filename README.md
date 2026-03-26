# 研究計畫表單終結者 Forminator

> "I'll be back... with all 7 forms."

疾管署（CDC）研究計畫申請表單自動化工具。研究人員填寫一次表單，即可打包下載 7 份 Word 文件。

目前僅支援**署內無經費研究**之免審申請表單生成。

## 功能

- 5 步驟引導式表單（基本資料 → 人員 → 研究內容 → IRB → 資料庫）
- AI 自動翻譯計畫名稱（中→英），支援 Groq / Google Gemini
- AI 自動生成中英文摘要與關鍵詞
- 自動產生甘特圖（依執行期程）
- 一鍵打包下載 7 份 Word 文件 ZIP
- 自動儲存（瀏覽器 localStorage，下次開啟自動還原）
- 表單草稿匯出/匯入（JSON，跨瀏覽器或電腦轉移）
- 頁面內嵌意見回饋表單

## 產出文件

| 編號 | 文件名稱 | 來源 |
|------|---------|------|
| DOC-1 | IRB-004 研究計畫書 | CDC 原始模板 |
| DOC-2 | IRB-012 免審申請表 | CDC 原始模板 |
| DOC-3 | IRB-018 保密切結書（研究人員） | CDC 原始模板 |
| DOC-4 | 署內研究計畫書 | CDC 原始模板 |
| DOC-5 | 資料庫保密切結書（署內員工使用） | CDC 原始模板 |
| DOC-6 | 資料庫使用申請單 | CDC 原始模板 |
| DOC-7 | 研究計畫簽呈（含公文系統操作說明） | 程式生成 |

> DOC-1～6 使用 CDC/IRB 官方 Word 模板注入佔位符；DOC-7 由程式碼從零生成。

## 快速開始

### 安裝

```bash
git clone https://github.com/kcwang-fa/forminator.git
cd forminator
npm install
```

### 開發

```bash
npm run dev
```

### AI 設定

AI 翻譯與摘要功能支援兩種 LLM 服務，使用者在網頁右上角「AI 設定」面板中選擇並輸入 API Key（僅存於瀏覽器 localStorage，不上傳伺服器）：

| 服務 | 模型 | 取得 API Key |
|------|------|-------------|
| Groq | Qwen3 32B | [Groq Console](https://console.groq.com/keys) |
| Google Gemini | Gemini 3.1 Flash Lite | [Google AI Studio](https://aistudio.google.com/apikey) |

後端環境變數（本地開發或自架部署時使用）：

```bash
export GROQ_API_KEY=your_key_here      # 後端 fallback 用
export GROQ_MODEL=qwen/qwen3-32b       # 可選，預設值
```

### 部署

專案部署於 Vercel，推送至 `main` 分支即自動部署。

## 技術架構

```
瀏覽器（前端）
├── React + TypeScript + Vite
├── Ant Design（UI 元件）
├── React Hook Form（表單狀態管理）
├── docxtemplater（Word 模板填入）
├── JSZip + file-saver（ZIP 打包下載）
└── dayjs（日期處理）

伺服器（後端）
├── Vercel Serverless Functions（正式環境）
├── Express（本地開發）
└── GROQ API / qwen3-32b（AI 翻譯 & 摘要）
```

## 模板維護

DOC-1～6 的模板注入流程：

1. 將 CDC 原始 `.docx` 放入 `/tmp/forminator-templates/`
2. 執行 `node scripts/inject-placeholders.cjs`
3. 輸出至 `public/templates/DOC-*.docx`

DOC-7 由程式碼生成：

```bash
node scripts/generate-templates.cjs
```

## 授權

MIT
