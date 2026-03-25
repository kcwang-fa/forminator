# Forminator 開發學習指南

> 從「表單終結者」的開發實戰中，學到的技術選型、踩坑紀錄與工程思維。
> 適合剛接觸前端開發或第一次碰 Word 文件自動化的人閱讀。

---

## 目錄

0. [技術全景：這個專案用了什麼？](#0-技術全景這個專案用了什麼)
1. [Office Open XML 操作](#1-office-open-xml-操作)
2. [Template-based 文件生成](#2-template-based-文件生成)
3. [LLM API 整合](#3-llm-api-整合)
4. [React Hook Form 多步驟表單](#4-react-hook-form-多步驟表單)
5. [日期處理：民國年與西元年](#5-日期處理民國年與西元年)
6. [自動化工作流程設計](#6-自動化工作流程設計)

---

## 0. 技術全景：這個專案用了什麼？

### 一句話說明

Forminator 是一個**跑在瀏覽器裡的表單應用**，使用者填完表單後，它會在瀏覽器端直接產生 Word 文件打包下載。後端只負責呼叫 AI 做翻譯和摘要。

### 技術堆疊總覽

```
┌─────────────────────────────────────────────────┐
│  瀏覽器（前端）                                    │
│                                                   │
│  React ──── 畫面元件                               │
│  TypeScript ── 型別安全的 JavaScript               │
│  Vite ────── 開發伺服器 & 打包工具                  │
│  Ant Design ─ UI 元件庫（按鈕、表格、日期選擇器等）  │
│  React Hook Form ── 表單資料管理                    │
│  docxtemplater ──── 在 Word 模板裡填入資料          │
│  JSZip + file-saver ── 打包成 ZIP 並下載           │
│  dayjs ──── 日期處理                               │
│                                                   │
├─────────────────────────────────────────────────┤
│  伺服器（後端）                                    │
│                                                   │
│  Vercel Serverless Functions ── 部署在雲端          │
│  Express（備用）── 本地開發用                       │
│  GROQ API（qwen3-32b）── AI 翻譯 & 摘要生成       │
│                                                   │
├─────────────────────────────────────────────────┤
│  開發工具                                          │
│                                                   │
│  Node.js 腳本 ── 在 Word 模板 XML 裡注入佔位符     │
│  Python（輔助）── 分析 .docx 內部 XML 結構          │
│  Git + GitHub ── 版本控制                          │
└─────────────────────────────────────────────────┘
```

### 每個技術是什麼？為什麼選它？

#### 前端

| 技術 | 它是什麼 | 為什麼用它 | 新手學習建議 |
|------|---------|-----------|------------|
| **React** | Facebook 開發的 UI 框架，用「元件」組合畫面 | 生態系最大、文件最多、找人接手最容易 | 先學 [官方教學](https://react.dev/learn)，理解 JSX、state、props |
| **TypeScript** | JavaScript 的超集，加上型別檢查 | 表單欄位 30+ 個，沒型別會搞混；IDE 自動補全超好用 | 不用一開始就學完，先看懂 `interface` 和 `: string` 就夠 |
| **Vite** | 新一代前端打包工具，取代 Webpack | 啟動快（<1秒）、設定簡單、HMR 即時更新 | `npm run dev` 就對了，設定幾乎不用碰 |
| **Ant Design** | 螞蟻金服出的 UI 元件庫 | 內建中文 locale、表單元件齊全、企業風格 | 到 [元件文件](https://ant.design/components/overview-cn/) 找需要的元件，複製範例改 |
| **React Hook Form** | 表單狀態管理函式庫 | 效能好（不會每打一個字就 re-render 整頁）、驗證簡單 | 先理解 `useForm()`、`Controller`、`watch()` 三個 API |
| **docxtemplater** | 在 .docx 模板中填入資料的函式庫 | 不需要後端，瀏覽器直接生成 Word | 看 [官方 demo](https://docxtemplater.com/demo/) 跑一次就懂了 |
| **JSZip** | 在瀏覽器裡建立 ZIP 檔案 | 7 份文件打包成一個 ZIP 下載 | API 很簡單：`zip.file('name.docx', blob)` |
| **dayjs** | 輕量日期處理（2KB） | Ant Design DatePicker 需要 | 類似 moment.js 但小很多 |

#### 後端

| 技術 | 它是什麼 | 為什麼用它 |
|------|---------|-----------|
| **Vercel** | 前端部署平台，支援 Serverless Functions | 免費 tier 夠用、從 GitHub push 自動部署 |
| **Express** | Node.js 的 Web 框架 | 本地開發用，一個 `server.js` 搞定 |
| **GROQ API** | LLM 推論平台（跑 qwen3-32b 模型） | 免費額度高、回應快、OpenAI 相容格式 |

#### 開發工具

| 技術 | 它是什麼 | 為什麼用它 |
|------|---------|-----------|
| **Node.js** | 在伺服器端跑 JavaScript | 注入腳本用 JS 寫，跟前端同語言 |
| **Python** | 通用程式語言 | 快速分析 .docx 的 XML 結構（`zipfile` 模組方便） |
| **Git** | 版本控制系統 | 追蹤每次修改、可以回滾 |

### 新手 FAQ

**Q: 我需要全部學完才能改這個專案嗎？**
A: 不用。看你要改什麼：
- 改表單欄位 → 只需要懂 React + Ant Design + React Hook Form
- 改文件生成 → 只需要懂 docxtemplater + `docgen.ts`
- 改模板注入 → 只需要懂 Node.js + XML 基礎
- 改 AI 功能 → 只需要懂 `fetch` API + JSON

**Q: 為什麼文件生成不在後端做？**
A: 因為不需要。docxtemplater 跑在瀏覽器裡就好，省掉伺服器成本，也不用處理檔案上傳下載。使用者的資料完全不離開瀏覽器（除了 AI 翻譯/摘要功能）。

**Q: 為什麼不用 Google Docs API 或 Microsoft Graph？**
A: CDC 的表單必須是特定格式的 `.docx`，用 API 反而要處理格式轉換。直接操作 Word 模板最保險。

**Q: 專案怎麼跑起來？**
```bash
# 1. 安裝依賴
npm install

# 2. 啟動開發伺服器（前端）
npm run dev
# → 瀏覽器開 http://localhost:5173

# 3.（選用）如果要用 AI 功能，設定環境變數
export GROQ_API_KEY=your-key-here
npm start
# → 後端跑在 http://localhost:3000
```

### 延伸閱讀（新手起步路線）

如果你是完全的新手，建議按這個順序學習：

1. **JavaScript 基礎** → [MDN JavaScript Guide](https://developer.mozilla.org/zh-TW/docs/Web/JavaScript/Guide)
2. **React 入門** → [React 官方教學](https://react.dev/learn)
3. **TypeScript 基礎** → [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
4. **Ant Design 元件** → [Ant Design 文件](https://ant.design/components/overview-cn/)
5. **React Hook Form** → [官方入門](https://react-hook-form.com/get-started)
6. **docxtemplater** → [官方 Demo](https://docxtemplater.com/demo/)

---

## 1. Office Open XML 操作

### 這是什麼？

`.docx` 不是一個二進位檔案，它其實是一個 **ZIP 壓縮包**，裡面裝了一堆 XML 檔案。核心內容在 `word/document.xml`。

```
my-doc.docx (ZIP)
├── [Content_Types].xml
├── _rels/.rels
├── word/
│   ├── document.xml    ← 主要內容在這
│   ├── styles.xml      ← 樣式定義
│   ├── numbering.xml   ← 編號/項目符號
│   └── ...
```

### 新手思維 vs 老手思維

| 新手 | 老手 |
|------|------|
| 「用程式從零生成 Word 文件」 | 「用原始 Word 模板，只替換需要的部分」 |
| 「直接字串替換就好了」 | 「Word 會把一個詞拆成多個 XML 節點，要考慮 run splitting」 |
| 「格式用程式設定」 | 「格式讓 Word 保留，我只管內容」 |

### 常見的坑

#### 坑 1：Word 的 Run Splitting

你在 Word 裡看到的「計畫主持人」，在 XML 裡可能變成：

```xml
<w:r><w:t>計畫</w:t></w:r>
<w:r><w:t>主持人</w:t></w:r>
```

甚至更碎：

```xml
<w:r><w:t>計</w:t></w:r>
<w:r><w:t>畫</w:t></w:r>
<w:r><w:t>主</w:t></w:r>
<w:r><w:t>持</w:t></w:r>
<w:r><w:t>人</w:t></w:r>
```

**為什麼？** Word 在編輯過程中會記錄每次修改的歷史（revision tracking），不同時間點輸入的文字會被分成不同的 `<w:r>`（run）。

**解法：** 不要假設文字一定在同一個 run 裡。本專案的做法是：
- 用全形空白 `○○○` 或 `OOO` 作為佔位符號，這些是一次性輸入的，通常不會被拆開
- 如果標籤被拆開（如「電話」→「電」+「話」），用最後一個字作為 anchor

#### 坑 2：表格 cell 中標籤與值的關係

Word 表格中，「標籤」和「值」可能在：
- **同一個 cell**（標籤後面接值）
- **不同 cell**（左 cell 是標籤，右 cell 是值）

你必須先分析 XML 結構才知道 placeholder 該放哪裡。本專案用 Python 腳本分析：

```python
import zipfile, re
with zipfile.ZipFile('template.docx') as z:
    xml = z.read('word/document.xml').decode('utf-8')
    texts = re.findall(r'<w:t[^>]*>([^<]+)</w:t>', xml)
    for i, t in enumerate(texts):
        print(f'{i}: {t}')
```

#### 坑 3：`>OO<` 的替換順序

用 regex 的 `replace` 搭配 counter 來依序替換時，**必須確認模板中佔位符的實際出現順序**。本專案的執行期限就因為假設錯順序而導致「全程計畫」顯示月份=24、日期=31 的 bug。

**教訓：永遠先 dump 出 XML 裡的實際順序，再寫替換邏輯。**

### 延伸思考

- 為什麼不用 `docx-js` 從零生成？→ 因為官方模板有複雜的表格合併、底線、特殊格式，程式重建不划算且容易走樣。
- 如果模板更新了怎麼辦？→ 重新跑 `inject-placeholders.cjs`，但需要驗證 XML 結構是否改變。

### 延伸閱讀

- [ECMA-376 Office Open XML 規範](http://www.ecma-international.org/publications-and-standards/standards/ecma-376/)
- [Understanding Word XML](https://docs.microsoft.com/en-us/office/open-xml/understanding-the-open-xml-file-formats)
- [PizZip GitHub](https://github.com/nicolomaioli/pizzip) — 本專案用來讀寫 ZIP

---

## 2. Template-based 文件生成

### 這是什麼？

[docxtemplater](https://docxtemplater.com/) 是一個在 `.docx` 模板中填入資料的函式庫，語法類似 Mustache：
- `{variable}` — 簡單替換
- `{#loop}...{/loop}` — 迴圈（複製表格行、段落等）
- `{%condition}...{/condition}` — 條件

### 新手思維 vs 老手思維

| 新手 | 老手 |
|------|------|
| 「把所有資料都塞進一個大 JSON」 | 「分層準備：common data → per-doc overrides → per-person data」 |
| 「loop 放在段落裡就好」 | 「loop tag 的位置決定了複製的單位：放在 cell 裡複製 cell，放在 row 裡複製 row」 |
| 「直接 `doc.render(data)`」 | 「先確認 template 裡所有 placeholder 都有對應的 data key，否則 docxtemplater 會 throw」 |

### 常見的坑

#### 坑 1：Loop 的作用範圍

```
{#items}
  {name} — {price}
{/items}
```

如果 `{#items}` 和 `{/items}` 在同一個表格行（`<w:tr>`）的不同 cell 中，docxtemplater 會**複製整個表格行**。如果跨了行，行為就不可預期。

**原則：loop 的開始和結束 tag 必須在同一個結構單位內。**

#### 坑 2：Delimiter 衝突

預設 delimiter 是 `{` `}`，但 Word 裡如果有 JSON 範例或大括號文字，會被誤判為 placeholder。本專案的模板原本就用 `{` `}` 作為佔位符格式，所以剛好不衝突。如果遇到衝突，可以改用：

```js
const doc = new Docxtemplater(zip, {
  delimiters: { start: '<<', end: '>>' },
});
```

### 延伸思考

- docxtemplater 的 loop 不支援巢狀表格（nested tables），如果需要，考慮用 [docxtemplater subtemplate module](https://docxtemplater.com/modules/)（付費）。
- 想在 Word 裡畫出核取方塊（☐ / ☑）？直接用 Unicode 字元 `□`（U+25A1）和 `■`（U+25A0）最簡單。

### 延伸閱讀

- [docxtemplater 官方文件](https://docxtemplater.com/docs/)
- [docxtemplater loops 說明](https://docxtemplater.com/docs/tag-types/#loops)

---

## 3. LLM API 整合

### 這是什麼？

透過 GROQ API（OpenAI 相容格式）呼叫 LLM（qwen3-32b）來做：
1. 中文計畫名稱 → 英文翻譯
2. 研究內容 → 生成中英文摘要與關鍵詞

### 新手思維 vs 老手思維

| 新手 | 老手 |
|------|------|
| 「設 `response_format: json_object` 就保證拿到 JSON」 | 「不是所有模型都支援，要做 fallback」 |
| 「LLM 回傳的就是純內容」 | 「有些模型會加 thinking tags、markdown code blocks、前後綴文字」 |
| 「設 `max_tokens: 200` 翻譯夠了」 | 「thinking 模型的 token 包含思考過程，200 遠遠不夠」 |
| 「錯誤顯示『翻譯失敗』就好」 | 「要把 LLM 的原始回應帶回前端，否則無法 debug」 |

### 常見的坑

#### 坑 1：Thinking 模型的隱藏成本

qwen3 預設開啟 thinking mode，回應格式為：

```
<think>
好的，用户让我翻译...首先我需要确认...
</think>

{"project_title_en": "..."}
```

問題：
1. `<think>` 內容消耗 token → `max_tokens: 200` 可能在思考完之前就截斷
2. 截斷後 `<think>` 沒有 `</think>` 關閉 → regex `/<think>[\s\S]*?<\/think>/` 匹配不到
3. JSON 根本沒有被生成出來

**解法（三層防護）：**

```js
// 1. 給足 token（思考 + 回答）
max_tokens: 1024,

// 2. 清除已關閉和未關閉的 <think>
const cleaned = content
  .replace(/<think>[\s\S]*?<\/think>/g, '')  // 已關閉
  .replace(/<think>[\s\S]*/g, '')            // 未關閉（截斷）
  .trim();

// 3. 從清理後的文字中提取 JSON
const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
```

#### 坑 2：`response_format` 不是萬能的

`response_format: { type: 'json_object' }` 只有部分模型支援（OpenAI GPT-4o、部分 Groq 模型）。不支援的模型會直接回 HTTP 400。

**最穩健的做法：不依賴 `response_format`，用 prompt 引導 + regex 提取。**

#### 坑 3：錯誤訊息要有 debug 資訊

千萬不要只回 `{ error: '翻譯失敗' }`。在開發/除錯階段，把 LLM 的原始回應（截取前 500 字）放進 error response：

```js
return res.status(502).json({
  error: 'LLM 回應格式錯誤',
  debug: cleaned.substring(0, 500),
});
```

前端再把 `debug` 欄位顯示出來，一眼就能看出問題。

### 延伸思考

- 為什麼不直接在前端呼叫 GROQ API？→ API key 會暴露在瀏覽器。
- 為什麼用 GROQ 而不是 OpenAI？→ 免費 tier 額度較高，適合 MVP。
- 如果想關閉 qwen3 的 thinking，可以在 prompt 加 `/no_think`，但這會降低回答品質。

### 延伸閱讀

- [GROQ API 文件](https://console.groq.com/docs/api-reference)
- [OpenAI JSON Mode 說明](https://platform.openai.com/docs/guides/json-mode)
- [Qwen3 Thinking Mode](https://qwen.readthedocs.io/) — 理解 `<think>` 標籤的行為

---

## 4. React Hook Form 多步驟表單

### 這是什麼？

Forminator 用 React Hook Form（RHF）管理一個跨 5 個步驟的大型表單。所有步驟共用同一個 form instance，透過 Context 傳遞。

### 新手思維 vs 老手思維

| 新手 | 老手 |
|------|------|
| 「每個步驟一個 form，最後合併」 | 「一個 form instance 跨所有步驟，資料一致性有保障」 |
| 「用 `useState` 管理表單」 | 「RHF 的 `useForm` 自帶效能優化（不會每次 keystroke re-render）」 |
| 「驗證放在 submit」 | 「用 `rules` 做即時驗證，切步驟時也能檢查」 |

### 常見的坑

#### 坑 1：`useFieldArray` 的 key

動態新增/刪除人員時，`useFieldArray` 會自動管理 key。但如果你用 `index` 作為 React key 而不是 `field.id`，刪除中間項目後表單值會錯亂。

```tsx
// ✅ 正確
{fields.map((field, index) => (
  <Card key={field.id}>...</Card>
))}

// ❌ 錯誤
{fields.map((field, index) => (
  <Card key={index}>...</Card>
))}
```

#### 坑 2：`watch` vs `getValues`

- `watch('field')` — **響應式**，值變化時觸發 re-render
- `getValues('field')` — **非響應式**，只在呼叫時讀取當前值

在 `useEffect` 裡要用 `watch` 的回傳值作為 dependency，不要用 `getValues`。

### 延伸閱讀

- [React Hook Form 官方文件](https://react-hook-form.com/)
- [useFieldArray API](https://react-hook-form.com/docs/usefieldarray)

---

## 5. 日期處理：民國年與西元年

### 這是什麼？

台灣公文用民國紀年（ROC calendar）。民國年 = 西元年 - 1911。

### 常見的坑

#### 坑 1：月份 off-by-one

JavaScript 的 `Date.getMonth()` 是 **0-based**（0=一月、11=十二月）。

```js
// ❌ 錯誤
const month = date.getMonth();     // 一月 → 0

// ✅ 正確
const month = date.getMonth() + 1; // 一月 → 1
```

#### 坑 2：日期字串的時區

`new Date('2026-03-24')` 在不同時區可能是 3/23 或 3/24。如果你只需要日期部分，用 `split('-')` 手動解析比 `new Date()` 更安全。

### 延伸思考

- 為什麼不用 `dayjs`？→ 本專案有用（前端 DatePicker），但 docgen 裡為了減少依賴直接用原生 `Date`。
- 民國 113 年以後的跨年計畫，年份可能跨到 114、115，要確認所有日期欄位都正確轉換。

---

## 6. 自動化工作流程設計

### 這是什麼？

Forminator 的核心設計哲學是：**一次填寫，生成多份文件**。

### 新手思維 vs 老手思維

| 新手 | 老手 |
|------|------|
| 「每份文件獨立填寫」 | 「一個 FormData 對應所有文件，`prepareCommonData()` 統一轉換」 |
| 「模板寫死在程式裡」 | 「模板是獨立的 .docx 檔案，injection 腳本可以重跑」 |
| 「生成完直接下載」 | 「打包成 ZIP，檔名帶計畫名稱，方便歸檔」 |

### 架構決策紀錄

**為什麼從「程式生成模板」改成「原始模板 + placeholder 注入」？**

初版用 `docx-js` 從零生成 Word 文件，但遇到：
1. 表格格式（合併儲存格、框線樣式）難以精確重現
2. 字型、間距等微調需要大量嘗試
3. 每次官方模板更新，要重寫大量程式碼

改用原始模板後：
- 格式 100% 忠於官方
- 只需維護 placeholder 注入邏輯
- 更新模板只需重跑 `node scripts/inject-placeholders.cjs`

**為什麼甘特圖用 ■ 而不是底色填充？**

docxtemplater 只能填文字，不能改 cell 背景色。用 `■`（Unicode 全形方塊）是最簡單的視覺表示。如果需要底色，要用 docxtemplater 的付費 [styling module](https://docxtemplater.com/modules/styling/)。

**為什麼目錄頁碼用 PAGEREF 而不是寫死？**

頁碼取決於 Word 排版引擎（字型、邊距、內容長度），JavaScript 無法計算。插入 PAGEREF 欄位碼後，使用者打開 Word 按 `Ctrl+A → F9` 即可自動更新。

### 延伸思考

- 如果要支援多年期計畫，哪些地方需要改？→ 執行期限要拆成「本年度」和「全程」兩組不同值，甘特圖月份數要動態調整。
- 如果要支援有經費的計畫？→ 需要新增經費表格的 placeholder 注入，表單加上經費編列步驟。

### 延伸閱讀

- [docx-js（programmatic generation）](https://github.com/dolanmiu/docx) — 本專案早期使用，適合從零生成
- [JSZip](https://stuk.github.io/jszip/) — 前端 ZIP 打包
- [file-saver](https://github.com/nicolomaioli/FileSaver.js) — 觸發瀏覽器下載

---

## 總結：從這個專案學到的原則

1. **先理解結構再動手** — 分析 XML、dump 文字順序、確認 cell 邊界，比直接寫 regex 重要十倍
2. **不要假設 LLM 的輸出格式** — 永遠做清理、提取、驗證三步驟
3. **保留原始格式** — 用模板注入而非程式生成，維護成本低且格式保真
4. **錯誤訊息要具體** — 「翻譯失敗」不如「GROQ API 錯誤: 400」不如顯示實際回應內容
5. **增量式開發** — 先跑通最簡單的 placeholder，再逐步加入 loop、PAGEREF 等進階功能
