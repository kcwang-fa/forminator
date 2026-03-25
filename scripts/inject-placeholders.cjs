// ===== 在原始 .docx 範本中注入 docxtemplater placeholder =====
// 直接操作 word/document.xml，保留原始格式

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = '/tmp/forminator-templates';
const OUT = path.join(__dirname, '..', 'public', 'templates');
fs.mkdirSync(OUT, { recursive: true });

// ===== 工具函式 =====

function readDocXml(zipPath) {
  const buf = fs.readFileSync(zipPath);
  const zip = new PizZip(buf);
  const xml = zip.file('word/document.xml').asText();
  return { zip, xml };
}

function saveDoc(zip, xml, outName) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  const fp = path.join(OUT, outName);
  fs.writeFileSync(fp, buf);
  console.log(`✅ ${outName} (${(buf.length / 1024).toFixed(1)} KB)`);
}

// 替換 <w:t> 中的文字（處理 xml:space="preserve" 的情況）
function replaceText(xml, oldText, newText) {
  // 先嘗試直接替換 <w:t> 內容
  const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(>)${escaped}(<)`, 'g');
  const result = xml.replace(regex, `$1${newText}$2`);
  if (result !== xml) return result;

  // 也嘗試帶 preserve 的
  const regex2 = new RegExp(escaped, 'g');
  return xml.replace(regex2, newText);
}

// 在指定標籤文字後面的下一個空白 <w:t> 中插入 placeholder
// 適用於 "label：" 後面跟著空格或空值的情況
function replaceAfterLabel(xml, label, placeholder) {
  return replaceText(xml, label, label + placeholder);
}

// 在第 nth 次出現 labelText 的 cell 之後的空 cell 中插入 placeholder
function insertInNthEmptyCell(xml, labelText, placeholder, nth = 1) {
  const escaped = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Find all positions of labelText in <w:t> nodes
  const regex = new RegExp(escaped, 'g');
  let match;
  let count = 0;
  let targetPos = -1;
  while ((match = regex.exec(xml)) !== null) {
    count++;
    if (count === nth) {
      targetPos = match.index;
      break;
    }
  }
  if (targetPos === -1) return xml;

  // Find the next </w:tc> after targetPos (end of label cell)
  const tcEnd = xml.indexOf('</w:tc>', targetPos);
  if (tcEnd === -1) return xml;

  // Find the next <w:p> in the next cell, and insert a run with the placeholder
  // Pattern: </w:tc><w:tc>...<w:p...>...</w:p>
  const afterTc = xml.substring(tcEnd + 7); // after </w:tc>
  // Insert placeholder text in the first <w:p> of the next cell
  const pMatch = afterTc.match(/(<w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*><w:pPr>[\s\S]*?<\/w:pPr>)(<\/w:p>)/);
  if (pMatch) {
    const insertPoint = tcEnd + 7 + pMatch.index + pMatch[1].length;
    return xml.substring(0, insertPoint) +
      `<w:r><w:t>${placeholder}</w:t></w:r>` +
      xml.substring(insertPoint);
  }
  // Fallback: try simpler pattern without <w:pPr>
  const pMatch2 = afterTc.match(/(<w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*?>)(<\/w:p>)/);
  if (pMatch2) {
    const insertPoint = tcEnd + 7 + pMatch2.index + pMatch2[1].length;
    return xml.substring(0, insertPoint) +
      `<w:r><w:t>${placeholder}</w:t></w:r>` +
      xml.substring(insertPoint);
  }
  return xml;
}

// ========================================
// DOC-4: 署內研究計畫書
// ========================================
function processDOC4() {
  console.log('\n📄 Processing DOC-4: 署內研究計畫書');
  let { zip, xml } = readDocXml(path.join(SRC, 'DOC-4.docx'));

  // 封面頁
  xml = replaceText(xml, '○○○年\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000',
    '{project_year}年');

  // 封面計畫名稱（帶底線的全形空格）
  xml = xml.replace(
    /(<w:t[^>]*>計畫名稱：<\/w:t>[\s\S]*?<w:t[^>]*>)([\u3000\s]+)(<\/w:t>)/,
    '$1{project_title_zh}$3'
  );

  // 封面負責單位
  xml = xml.replace(
    /(<w:t[^>]*>負責單位：<\/w:t>[\s\S]*?<w:t[^>]*>)([\u3000\s]+)(<\/w:t>)/,
    '$1{responsible_unit}$3'
  );

  // 封面主持人
  xml = xml.replace(
    /(<w:t[^>]*>主持人：<\/w:t>[\s\S]*?<w:t[^>]*>)([\u3000\s]+)(<\/w:t>)/,
    '$1{pi_name_zh}$3'
  );

  // 封面簽名 — 留白，由本人親簽

  // 封面協同主持人（3個位置）
  let copiCount = 0;
  xml = xml.replace(
    /(<w:t[^>]*>協同主持人：<\/w:t>[\s\S]*?<w:t[^>]*>)([\u3000\s]+)(<\/w:t>)/g,
    (match, p1, p2, p3) => {
      copiCount++;
      if (copiCount <= 3) return `${p1}{co_pi_name_${copiCount}}${p3}`;
      return match;
    }
  );

  // 封面研究人員（4個位置）
  let resCount = 0;
  xml = xml.replace(
    /(<w:t[^>]*>研究人員：<\/w:t>[\s\S]*?<w:t[^>]*>)([\u3000\s]+)(<\/w:t>)/g,
    (match, p1, p2, p3) => {
      resCount++;
      if (resCount <= 4) return `${p1}{researcher_name_${resCount}}${p3}`;
      return match;
    }
  );

  // 封面填報日期
  xml = replaceText(xml,
    '填報日期：\u3000\u3000\u3000\u3000\u3000年\u3000\u3000\u3000月\u3000\u3000\u3000日',
    '填報日期：{filing_date_roc}');

  // 壹、綜合資料表格內
  // 計畫名稱 中文/英文
  xml = replaceText(xml, '>中文：<', '>{zh_title_prefix}{project_title_zh}<');
  // 先做標記避免重複替換
  xml = xml.replace('{zh_title_prefix}', '中文：');

  xml = replaceText(xml, '>英文：<', '>{en_title_prefix}{project_title_en}<');
  xml = xml.replace('{en_title_prefix}', '英文：');

  // 計畫類別 checkbox（預設新增型一年期）
  xml = replaceText(xml, '□新增計畫：', '{project_type_new}新增計畫：');
  xml = replaceText(xml, '□一年期計畫', '{project_type_1yr}一年期計畫');
  xml = replaceText(xml, '□多年期計畫，共', '{project_type_multi}多年期計畫，共');
  xml = replaceText(xml, '□舊多年期計畫', '{project_type_old}舊多年期計畫');

  // 實驗類別
  xml = replaceText(xml, '□人體研究', '{exp_human}人體研究');
  xml = replaceText(xml, '□人體基因重組', '{exp_gene}人體基因重組');

  // 執行期限 — OOO=年, OO=月/日
  // 模板每行排列：本年度(年,月,日) → 全程(年,月,日)，共兩行（起、止）
  // MVP 一年期計畫，全程=本年度，所以兩組用同一組 placeholder
  let oooIdx = 0;
  xml = xml.replace(/>OOO</g, () => {
    oooIdx++;
    // 1,2 = 起始年(本年度,全程), 3,4 = 截止年(本年度,全程)
    if (oooIdx <= 2) return '>{exec_start_y}<';
    return '>{exec_end_y}<';
  });
  let ooIdx = 0;
  xml = xml.replace(/>OO</g, () => {
    ooIdx++;
    // 每行: 本年度月,本年度日,全程月,全程日
    // 第一行(起): 1=起月, 2=起日, 3=起月, 4=起日
    // 第二行(止): 5=止月, 6=止日, 7=止月, 8=止日
    const mapping = [
      'exec_start_m', 'exec_start_d', 'exec_start_m', 'exec_start_d',
      'exec_end_m',   'exec_end_d',   'exec_end_m',   'exec_end_d',
    ];
    return `>{${mapping[ooIdx - 1] || 'exec_end_d'}}<`;
  });

  // 經費需求 — 原始模板中無對應 checkbox，此場景固定為「無經費需求」

  // 計畫主持人/計畫連絡人 — ○○○ 佔位順序：PI姓名, PI職稱, 聯絡人姓名, 聯絡人職稱
  let circleCount = 0;
  const circleMapping = [
    '{pi_name_zh}', '{pi_title}', '{contact_name_zh}', '{contact_title}',
  ];
  xml = xml.replace(/○○○/g, () => {
    const ph = circleMapping[circleCount] || '○○○';
    circleCount++;
    return ph;
  });

  // 計畫主持人/連絡人 — 電話、傳真、E-mail、連絡地址
  // 表格結構：左 cell = 標籤, 右 cell = 值（空的）
  // 在空的值 cell 的 <w:p> 裡插入 placeholder
  // 使用 insertInEmptyNextCell: 找到標籤文字所在的 </w:tc>，在下一個 <w:tc> 的空 <w:p> 中插入
  const piContactFields = [
    // [標籤匹配文字, placeholder, 第幾次出現(1-based)]
    ['E-mail', '{pi_email}', 1],
    ['E-mail', '{contact_email}', 2],
    ['連絡地址', '{pi_address}', 1],
    ['連絡地址', '{contact_address}', 2],
  ];
  for (const [label, ph, nth] of piContactFields) {
    xml = insertInNthEmptyCell(xml, label, ph, nth);
  }

  // 電話/傳真 — 標籤文字在 XML 中被拆成多個 <w:t>（「電」+空白+「話」）
  // 用「話」和「真」作為 anchor 來找到正確的 cell
  xml = insertInNthEmptyCell(xml, '話', '{pi_phone}', 1);
  xml = insertInNthEmptyCell(xml, '話', '{contact_phone}', 2);
  xml = insertInNthEmptyCell(xml, '真', '{pi_fax}', 1);
  xml = insertInNthEmptyCell(xml, '真', '{contact_fax}', 2);

  // 貳、中文摘要 — 替換提示文字
  // 第一個「請摘述本計畫之目的與實施方法及關鍵詞」是中文摘要
  let abstractCount = 0;
  xml = xml.replace(/請摘述本計畫之目的與實施方法及關鍵詞/g, () => {
    abstractCount++;
    if (abstractCount === 1) return '{abstract_zh}';
    if (abstractCount === 2) return '{abstract_en}';
    return '請摘述本計畫之目的與實施方法及關鍵詞';
  });

  // 中文關鍵詞
  xml = xml.replace(
    /(>關鍵詞：<\/w:t><\/w:r>[\s\S]*?<w:t[^>]*>)([\u3000]+)(<\/w:t>)/,
    '$1{keywords_zh}$3'
  );

  // 英文 keywords
  xml = xml.replace(
    /(>keywords<\/w:t>[\s\S]*?>：<\/w:t><\/w:r>[\s\S]*?<w:t[^>]*>)([\u3000]+)(<\/w:t>)/,
    '$1{keywords_en}$3'
  );

  // 肆、計畫內容 — 在各節提示文字的段落末尾插入 placeholder 段落
  // 策略：找到提示文字的最後一個 </w:p>，在後面插入一個新段落
  const contentSections = [
    // [anchor 文字（該節提示文字中唯一或最後的片段）, placeholder]
    ['應避免空泛性之敘述', '{purpose}'],
    ['本計畫與防疫工作之相關性等', '{background}'],
    ['將實施方法及進行步驟詳細說明', '{methodology}'],
    ['計畫之成果預估', '{expected_outcome}'],
    ['並於計畫內容引用處標註之', '{references}'],
  ];
  for (const [anchor, ph] of contentSections) {
    const anchorIdx = xml.indexOf(anchor);
    if (anchorIdx === -1) continue;
    // Find the end of the paragraph containing this anchor
    const pEnd = xml.indexOf('</w:p>', anchorIdx);
    if (pEnd === -1) continue;
    const insertAt = pEnd + 6; // after </w:p>
    xml = xml.substring(0, insertAt) +
      `<w:p><w:r><w:t>${ph}</w:t></w:r></w:p>` +
      xml.substring(insertAt);
  }

  // 七、預定進度 — 甘特圖表格 loop 注入
  // 表格：月次/工作項目 | 第1月 | ... | 第12月 | 備註（共 14 cell）
  // 標頭行後有 19 個空白資料行，保留第 1 行改為 loop，刪除其餘 18 行
  const ganttAnchor = '月\u3000次';
  const ganttIdx = xml.indexOf(ganttAnchor);
  if (ganttIdx !== -1) {
    // Find the table containing the gantt chart
    const ganttTblStart = xml.lastIndexOf('<w:tbl', ganttIdx);
    const ganttTblEnd = xml.indexOf('</w:tbl>', ganttIdx) + 8;

    if (ganttTblStart !== -1 && ganttTblEnd > 8) {
      let ganttTable = xml.substring(ganttTblStart, ganttTblEnd);
      const ganttRowParts = ganttTable.split('</w:tr>');
      // ganttRowParts[0] = header row, [1]~[19] = data rows, [20] = after last </w:tr>

      if (ganttRowParts.length > 2) {
        // Modify first data row (index 1) to have loop placeholders
        let dataRow = ganttRowParts[1] + '</w:tr>';
        // 14 cells: [0]=task_name, [1]~[12]=months, [13]=備註
        const ganttPlaceholders = [
          '{#gantt_rows}{task_name}',
          '{m1}', '{m2}', '{m3}', '{m4}', '{m5}', '{m6}',
          '{m7}', '{m8}', '{m9}', '{m10}', '{m11}', '{m12}',
          '{/gantt_rows}',
        ];
        let gcIdx = 0;
        dataRow = dataRow.replace(/(<w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?)(<\/w:p>)/g,
          (match, before, after) => {
            if (gcIdx < ganttPlaceholders.length) {
              const ph = ganttPlaceholders[gcIdx];
              gcIdx++;
              return `${before}<w:r><w:t>${ph}</w:t></w:r>${after}`;
            }
            return match;
          }
        );

        // Rebuild table: header + loop row + closing (skip rows 2~19)
        const newTable = ganttRowParts[0] + '</w:tr>' + dataRow + ganttRowParts[ganttRowParts.length - 1];
        xml = xml.substring(0, ganttTblStart) + newTable + xml.substring(ganttTblEnd);
      }
    }
  }

  // 伍、人力配置 — 用 docxtemplater loop 語法注入
  // 表格結構：類別 | 姓名 | 現職 | 在本計畫內擔任之具體工作性質、項目及範圍
  // 在表頭行後的空資料行中：第一個 cell 放 {#personnel_rows}{role_text}，
  // 中間 cell 放 {name_zh} 和 {title}，最後 cell 放 {work_description}{/personnel_rows}
  const personnelAnchor = '在本計畫內擔任之具體工作性質、項目及範圍';
  const personnelIdx = xml.indexOf(personnelAnchor);
  if (personnelIdx !== -1) {
    // Find the end of the header row </w:tr>
    const trEnd = xml.indexOf('</w:tr>', personnelIdx);
    if (trEnd !== -1) {
      const insertAt = trEnd + 7;
      // Find the next </w:tr> (the empty data row)
      const nextTrEnd = xml.indexOf('</w:tr>', insertAt);
      if (nextTrEnd !== -1) {
        let rowXml = xml.substring(insertAt, nextTrEnd + 7);
        // Insert placeholders into each cell's empty <w:p>
        // docxtemplater loop: {#personnel_rows} in first cell, {/personnel_rows} in last cell
        const cellPlaceholders = [
          '{#personnel_rows}{role_text}',
          '{name_zh}',
          '{title}',
          '{work_description}{/personnel_rows}',
        ];
        let cellIdx = 0;
        rowXml = rowXml.replace(/(<w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?)(<\/w:p>)/g,
          (match, before, after) => {
            if (cellIdx < cellPlaceholders.length) {
              const ph = cellPlaceholders[cellIdx];
              cellIdx++;
              return `${before}<w:r><w:t>${ph}</w:t></w:r>${after}`;
            }
            return match;
          }
        );
        xml = xml.substring(0, insertAt) + rowXml + xml.substring(nextTrEnd + 7);
      }
    }
  }

  // ===== 目錄頁碼：bookmark + PAGEREF =====
  // 目錄中的 (  ) 替換為 PAGEREF 欄位碼，本文章節標題加 bookmark
  const tocSections = [
    // [目錄文字, bookmark 名稱, 本文 anchor（用來找到第二次出現的標題）]
    ['壹、綜合資料', 'sec_1', '壹、綜合資料'],
    ['貳、計畫中文摘要', 'sec_2', '貳、計畫中文摘要'],
    ['參、計畫英文摘要', 'sec_3', '參、計畫英文摘要'],
    ['肆、計畫內容', 'sec_4', '肆、計畫內容'],
    ['一、研究主旨', 'sec_4_1', '一、研究主旨'],
    ['二、背景分析', 'sec_4_2', '二、背景分析'],
    ['三、多年期計畫之執行成果概要', 'sec_4_3', '三、多年期計畫之執行成果概要'],
    ['四、實施方法及進行步驟', 'sec_4_4', '四、實施方法及進行步驟'],
    ['五、成果預估', 'sec_4_5', '五、成果預估'],
    ['六、重要參考文獻', 'sec_4_6', '六、重要參考文獻'],
    ['七、預定進度', 'sec_4_7', null], // 七、在 XML 中被拆開，特殊處理
    ['伍、人力配置', 'sec_5', '伍、人力配置'],
    ['陸、經費需求', 'sec_6', '陸、經費需求'],
    ['柒、需其他機關配合或協調事項', 'sec_7', '柒、需其他機關配合或協調事項'],
    ['捌、附表', 'sec_8', '捌、附表'],
  ];

  let bmId = 100; // bookmark ID 起始值

  // Step 1: 在本文章節標題處插入 bookmark
  for (const [, bmName, bodyAnchor] of tocSections) {
    if (!bodyAnchor) continue;
    // 找本文中的標題（跳過目錄中的第一次出現）
    const firstIdx = xml.indexOf(bodyAnchor);
    if (firstIdx === -1) continue;
    const secondIdx = xml.indexOf(bodyAnchor, firstIdx + bodyAnchor.length);
    const targetIdx = secondIdx !== -1 ? secondIdx : firstIdx;

    // 找到包含此標題的 <w:p> 開頭
    const pStart = xml.lastIndexOf('<w:p ', targetIdx - 500 < 0 ? 0 : targetIdx - 500);
    if (pStart === -1 || pStart > targetIdx) continue;
    // 確認這個 <w:p> 確實包含目標文字
    const pEnd = xml.indexOf('</w:p>', targetIdx);
    if (pEnd === -1) continue;

    // 在 <w:p ...> 的結尾 > 後面插入 bookmarkStart 和 bookmarkEnd
    const pTagEnd = xml.indexOf('>', pStart) + 1;
    const bmXml = `<w:bookmarkStart w:id="${bmId}" w:name="${bmName}"/><w:bookmarkEnd w:id="${bmId}"/>`;
    xml = xml.substring(0, pTagEnd) + bmXml + xml.substring(pTagEnd);
    bmId++;
  }

  // 特殊處理「七、預定進度」— XML 中被拆成 "七、" + "年度預定進度"
  {
    // 找本文中的 "年度預定進度"（第二次出現，跳過目錄）
    const anchor = '年度預定進度';
    const firstIdx = xml.indexOf(anchor);
    const secondIdx = xml.indexOf(anchor, firstIdx + anchor.length);
    const targetIdx = secondIdx !== -1 ? secondIdx : firstIdx;
    if (targetIdx !== -1) {
      const pStart = xml.lastIndexOf('<w:p ', targetIdx - 500 < 0 ? 0 : targetIdx - 500);
      if (pStart !== -1 && pStart < targetIdx) {
        const pTagEnd = xml.indexOf('>', pStart) + 1;
        const bmXml = `<w:bookmarkStart w:id="${bmId}" w:name="sec_4_7"/><w:bookmarkEnd w:id="${bmId}"/>`;
        xml = xml.substring(0, pTagEnd) + bmXml + xml.substring(pTagEnd);
        bmId++;
      }
    }
  }

  // Step 2: 替換目錄中的 (  ) 為 PAGEREF 欄位碼
  // 目錄中 (  ) 的順序對應 tocSections 的順序
  let tocIdx = 0;
  // 限定只替換目錄區域的 (  )（在「壹、綜合資料」第一次出現之前的區域之後）
  const tocAreaStart = xml.indexOf('壹、綜合資料');
  const tocAreaEnd = xml.indexOf('衛生福利部疾病管制署', tocAreaStart + 10);

  if (tocAreaStart !== -1 && tocAreaEnd !== -1) {
    const beforeToc = xml.substring(0, tocAreaStart);
    let tocArea = xml.substring(tocAreaStart, tocAreaEnd);
    const afterToc = xml.substring(tocAreaEnd);

    tocArea = tocArea.replace(/<w:t>\(\s{2}\)<\/w:t>/g, (match) => {
      if (tocIdx < tocSections.length) {
        const bmName = tocSections[tocIdx][1];
        tocIdx++;
        return '<w:t></w:t></w:r>' +
          '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
          `<w:r><w:instrText xml:space="preserve"> PAGEREF ${bmName} \\h </w:instrText></w:r>` +
          '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
          '<w:r><w:t>?</w:t></w:r>' +
          '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
          '<w:r><w:t></w:t>';
      }
      return match;
    });

    xml = beforeToc + tocArea + afterToc;
  }

  saveDoc(zip, xml, 'DOC-4.docx');
}

// ========================================
// DOC-5: 資料庫保密切結書（署內員工）
// ========================================
function processDOC5() {
  console.log('\n📄 Processing DOC-5: 資料庫保密切結書');
  let { zip, xml } = readDocXml(path.join(SRC, 'DOC-5.docx'));

  // 立書人名字（原始文件有 "邱乾順" 作為範例）
  xml = replaceText(xml, '邱乾順', '{person_name_zh}');

  // 立書人姓名欄位（簽名處）
  xml = replaceText(xml, '>立書人姓名：<', '>立書人姓名：{person_name_zh}<');

  // 職稱
  xml = replaceText(xml, '>職稱：<', '>職稱：{person_title}<');

  // 身分證字號（可能被拆成多個 run）
  xml = replaceText(xml, '>證字號：<', '>證字號：{person_id_number}<');

  // 日期
  xml = replaceText(xml, '中華民國     年     月    日', '中華民國{signing_date_roc}');

  saveDoc(zip, xml, 'DOC-5.docx');
}

// ========================================
// DOC-6: 資料庫使用申請單
// ========================================
function processDOC6() {
  console.log('\n📄 Processing DOC-6: 資料庫使用申請單');
  let { zip, xml } = readDocXml(path.join(SRC, 'DOC-6.docx'));

  // 申請日期
  xml = xml.replace(
    /民國[\u3000\s]+年[\u3000\s]+月[\u3000\s]+日/,
    '民國{apply_date_roc}'
  );

  // 一、申請者資料 - 表格內的欄位值
  // 這些欄位在表格的第二列，跟在標籤後面
  // 申請單位、申請人員、公務電話、E-mail 的值在相鄰 cell 中

  // 研究目的及用途 checkbox
  xml = replaceText(xml, '□署內科技研究計畫', '{purpose_internal}署內科技研究計畫');
  xml = replaceText(xml, '□碩、博士論文', '{purpose_thesis}碩、博士論文');
  // ⬛️ is a filled checkbox in the original
  xml = replaceText(xml, '⬛️無需經費研究計畫', '{purpose_no_fund}無需經費研究計畫');
  xml = replaceText(xml, '□其他，請說明：', '{purpose_other}其他，請說明：{purpose_other_detail}');

  // 資料交付方式
  xml = replaceText(xml, '□紙本', '{delivery_paper}紙本');
  xml = replaceText(xml, '⬛️數位檔案', '{delivery_digital}數位檔案');

  // 資料使用地點
  xml = replaceText(xml, '⬛️本署署內辦公場域', '{loc_office}本署署內辦公場域');
  xml = replaceText(xml, '⬛️個人公務電腦', '{loc_pc}個人公務電腦');
  xml = replaceText(xml, '□其他分析平台：', '{loc_other}其他分析平台：');
  xml = replaceText(xml, '□資科中心', '{loc_data_center}資科中心');

  // 研究成果類型
  xml = replaceText(xml, '□1.提供決策___件', '{outcome_policy}1.提供決策{outcome_policy_count}件');
  xml = replaceText(xml, '□2.研究報告___件', '{outcome_report}2.研究報告{outcome_report_count}件');
  xml = replaceText(xml, '⬛️3.論文寫作1件', '{outcome_paper_writing}3.論文寫作{outcome_paper_writing_count}件');
  xml = replaceText(xml, '□4.論文發表___件', '{outcome_paper_publish}4.論文發表{outcome_paper_publish_count}件');
  xml = replaceText(xml, '□5.其他___件', '{outcome_other}5.其他{outcome_other_count}件');

  // 計畫主持人 checkbox
  xml = replaceText(xml, '⬛️同申請人員', '{pi_same}同申請人員');

  // 資料庫勾稽
  xml = replaceText(xml, '⬛️否', '{cross_link_no}否');
  xml = replaceText(xml, '□是，資科中心資料庫名稱：', '{cross_link_yes}是，資科中心資料庫名稱：{cross_link_db_name}');

  saveDoc(zip, xml, 'DOC-6.docx');
}

// ========================================
// DOC-1: IRB-004 研究計畫書
// ========================================
function processDOC1() {
  console.log('\n📄 Processing DOC-1: IRB-004 研究計畫書');
  let { zip, xml } = readDocXml(path.join(SRC, 'DOC-1.docx'));

  // 基本資料 - 「中文」和「：」在同一個 cell 裡但被拆成兩個 run
  // 在「：」後面的 </w:p> 前插入 placeholder run
  xml = xml.replace(
    /(>中文<\/w:t><\/w:r>[\s\S]*?>：<\/w:t><\/w:r>)(<\/w:p>)/,
    '$1<w:r><w:rPr><w:rFonts w:eastAsia="DFKai-SB" w:hint="eastAsia"/></w:rPr><w:t>{project_title_zh}</w:t></w:r>$2'
  );
  xml = xml.replace(
    /(>英文<\/w:t><\/w:r>[\s\S]*?>：<\/w:t><\/w:r>)(<\/w:p>)/,
    '$1<w:r><w:rPr><w:rFonts w:eastAsia="DFKai-SB" w:hint="eastAsia"/></w:rPr><w:t>{project_title_en}</w:t></w:r>$2'
  );

  // 計畫主持人姓名（"姓名：" 出現在 "計畫主持人" 的下一個 cell）
  // 第一個 "姓名：" = PI, 第二個 = co-PI
  let nameCount = 0;
  xml = xml.replace(/>姓名：</g, (match) => {
    nameCount++;
    if (nameCount === 1) return '>姓名：{pi_name_zh}<';
    if (nameCount === 2) return '>姓名：{co_pi_names}<';
    return match;
  });

  // 研究描述欄位 - 這些是表格 cell，標籤和值在不同 cell 中
  // "計畫摘要" 的值在相鄰的空 cell 裡
  // 使用方法：找到標籤所在的 </w:tc>，然後在下一個 <w:tc> 的 <w:t> 裡插入
  xml = insertInNextCell(xml, '計畫摘要', '{abstract_zh}');

  // "背景說明"（原始 XML 裡拆成 "計畫" + "背景說明"）
  xml = insertInNextCell(xml, '背景說明', '{background}');

  // 研究方法及程序區塊
  xml = insertInNextCell(xml, '研究設計與進行方法', '{methodology}');
  // "研究" + "限與預期進度"（被拆開了）
  xml = insertInNextCell(xml, '限與預期進度', '{schedule_text}');
  xml = insertInNextCell(xml, '研究人力及相關設備需求', '{personnel_equipment_text}');
  // 第 7 點「對研究對象可能之傷害及處理」— 原始模板已有「(不適用)」，不需注入

  // 其他區塊
  xml = insertInNextCell(xml, '預期成果及主要效益', '{expected_outcome}');
  // "研發成果之歸" + "屬及運用"（被拆開了）
  xml = insertInNextCell(xml, '屬及運用', '{outcome_usage_text}');

  saveDoc(zip, xml, 'DOC-1.docx');
}

// 在標籤所在 cell 的下一個相鄰 cell 中插入 placeholder
function insertInNextCell(xml, labelText, placeholder) {
  const escaped = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 找到包含 labelText 的 </w:tc>，然後在後面的 <w:tc> 裡第一個空 <w:p> 中插入
  const pattern = new RegExp(
    `(${escaped}</w:t></w:r></w:p></w:tc>` +
    `<w:tc><w:tcPr>[\\s\\S]*?</w:tcPr>` +
    `<w:p[^>]*><w:pPr>[\\s\\S]*?</w:pPr>)` +
    `(</w:p>)`
  );
  const result = xml.replace(pattern, `$1<w:r><w:t>${placeholder}</w:t></w:r>$2`);
  if (result === xml) {
    // 備用：直接在標籤文字後附加
    return replaceText(xml, labelText, labelText + '\n' + placeholder);
  }
  return result;
}

// ========================================
// DOC-2: IRB-012 免審申請表
// ========================================
function processDOC2() {
  console.log('\n📄 Processing DOC-2: IRB-012 免審申請表');
  let { zip, xml } = readDocXml(path.join(SRC, 'DOC-2.docx'));

  // 計畫名稱中英文 - "中文" / "英文" 在表格 cell，值在相鄰空 cell
  xml = insertInNextCell(xml, '中文', '{project_title_zh}');
  xml = insertInNextCell(xml, '英文', '{project_title_en}');

  // 計畫主持人
  xml = insertInNextCell(xml, '中文姓名', '{pi_name_zh}');
  xml = insertInNextCell(xml, '英文姓名', '{pi_name_en}');

  // 協同主持人姓名
  // "協同主持人" 下面的 "姓名" cell 旁邊的空 cell
  xml = xml.replace(
    /(協同主持人[\s\S]*?姓名<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>)([\s\S]*?)(<\/w:p>)/,
    '$1<w:r><w:t>{co_pi_names}</w:t></w:r>$3'
  );
  if (!xml.includes('{co_pi_names}')) {
    xml = replaceAfterLabel(xml, '>姓名<', '>{co_pi_label}{co_pi_names}<');
    // 只替換協同主持人那個
  }

  // 聯絡人
  xml = xml.replace(
    /(聯絡人[\s\S]*?姓名<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>)([\s\S]*?)(<\/w:p>)/,
    '$1<w:r><w:t>{contact_name_zh}</w:t></w:r>$3'
  );

  // 研究描述 - 研究計畫目的
  xml = insertInNextCell(xml, '研究計畫目的', '{purpose}');

  // 免審理由
  xml = replaceText(xml,
    '本研究為次級資料研究，資料皆已去識別化。',
    '{exempt_reason}');

  // 研究方法及工具（長預填文字）
  xml = replaceText(xml,
    '本研究使用疾管署防疫資料庫，依據「衛生福利部疾病管制署防疫資料庫員工研究計畫使用申請作業說明」提出申請，並檢附本IRB審查通過證明文件後，依序完成資料權責單位、資訊室及企劃組審核，經一層核定後取得去識別化資料。',
    '{data_source}');

  // 納入排除條件
  xml = replaceAfterLabel(xml, '(1)納入條件：', '{inclusion_criteria}');
  xml = replaceAfterLabel(xml, '(2)排除條件：', '{exclusion_criteria}');

  saveDoc(zip, xml, 'DOC-2.docx');
}

// ========================================
// DOC-3: IRB-018 保密切結書（研究人員）
// ========================================
function processDOC3() {
  console.log('\n📄 Processing DOC-3: IRB-018 保密切結書(研究人員)');
  let { zip, xml } = readDocXml(path.join(SRC, 'DOC-3.docx'));

  // 本人_____名字（XML 裡是 "本人_________________"）
  xml = replaceText(xml, '本人_________________', '本人{person_name_zh}');

  // 角色 checkbox（都在同一個 <w:t> 裡："(□計畫主持人 □協同主持人 □研究人員 □其他"）
  xml = replaceText(xml,
    '(□計畫主持人 □協同主持人 □研究人員 □其他',
    '({role_pi}計畫主持人 {role_co_pi}協同主持人 {role_researcher}研究人員 {role_other}其他');

  // 研究計畫名稱（"因執行研究計畫：" 後面是空白 run，然後 "所需"）
  // 在 "因執行研究計畫：" 的 </w:t> 後面的空 run 裡插入
  xml = xml.replace(
    /(因執行研究計畫：<\/w:t><\/w:r>[\s\S]*?<w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t[^>]*>)([\s\u3000]*)(<\/w:t>[\s\S]*?所需)/,
    '$1{project_title_zh}$3'
  );
  // 備用：如果上面沒 match，直接追加
  if (!xml.includes('{project_title_zh}')) {
    xml = replaceAfterLabel(xml, '因執行研究計畫：', '{project_title_zh}');
  }

  // 立同意書人簽名（"立同意書人簽名：" 後面是空白）
  xml = replaceAfterLabel(xml, '立同意書人簽名：', '{person_name_zh}');

  // 日期（拆成多個 run："日期：" + 空格 + "年" + 空格 + "月" + 空格 + "日"）
  // 替換 "日期：" 後面所有 run 直到 "</w:p>"，重新組合
  xml = xml.replace(
    /(日期：<\/w:t><\/w:r>)([\s\S]*?)(年<\/w:t>[\s\S]*?月<\/w:t>[\s\S]*?日<\/w:t><\/w:r>)/,
    '$1<w:r><w:rPr><w:rFonts w:ascii="DFKai-SB" w:eastAsia="DFKai-SB" w:hAnsi="DFKai-SB"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>{signing_date_roc}</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="DFKai-SB" w:eastAsia="DFKai-SB" w:hAnsi="DFKai-SB"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>日</w:t></w:r>'
  );
  // 如果以上 regex 沒 match，用簡單備用方案
  if (!xml.includes('{signing_date_roc}')) {
    xml = replaceText(xml, '日期：', '日期：{signing_date_roc}');
  }

  saveDoc(zip, xml, 'DOC-3.docx');
}

// ===== 執行 =====
console.log('🏗️  Injecting placeholders into original templates...\n');
processDOC1();
processDOC2();
processDOC3();
processDOC4();
processDOC5();
processDOC6();
console.log('\n✅ Done! All 6 templates saved to public/templates/');
