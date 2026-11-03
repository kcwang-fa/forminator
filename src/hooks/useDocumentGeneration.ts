// ===== 文件生成 Hook =====

import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useFormStore } from './useFormStore';
import { DOC_NAMES, type DocId } from '../data/defaults';
import { resolveActivePlan } from '../data/planConfigs';

const ALL_DOCS = Object.keys(DOC_NAMES) as DocId[];

export function useDocumentGeneration() {
  const { getValues, watch } = useFormStore();
  const reviewType = watch('review_type');
  const outputCategories = watch('output_categories') ?? [];
  // 預選文件 = review_type 全集 ∩ 勾選的成果類別
  const activeDocs = resolveActivePlan(reviewType, outputCategories).docs;

  const [selectedDocs, setSelectedDocs] = useState<DocId[]>(() => activeDocs);
  const [generating, setGenerating] = useState(false);

  // 切換審查類型或成果類別時，自動把預選文件重設成新的全集。
  // 用 join 後的字串當比較 key，避免 RHF watch 每次回傳新陣列導致誤判。
  // 採 React 官方「在 render 期間重設 state」模式（而非 useEffect + setState）：
  // 少一次多餘的 render，也不會觸發 react-hooks/set-state-in-effect。
  const activeDocsKey = activeDocs.join(',');
  const [prevActiveDocsKey, setPrevActiveDocsKey] = useState(activeDocsKey);
  if (prevActiveDocsKey !== activeDocsKey) {
    setPrevActiveDocsKey(activeDocsKey);
    setSelectedDocs(activeDocs);
  }

  const download = useCallback(async () => {
    if (selectedDocs.length === 0) {
      message.warning('請至少選擇一份文件');
      return;
    }
    setGenerating(true);
    try {
      // docgen 連帶 docxtemplater / pizzip / jszip 約佔整包 JS 的三成，
      // 但只有按下「下載」才會用到。用 dynamic import 讓 Vite 拆成獨立 chunk，
      // 首頁不必先載這些；第一次按下載時才抓（之後瀏覽器會快取）。
      const { generateAllDocuments } = await import('../utils/docgen');
      await generateAllDocuments(getValues(), selectedDocs);
      message.success(`已生成 ${selectedDocs.length} 份文件並下載 ZIP！`);
      if (selectedDocs.includes('DOC-2')) {
        message.info('提醒：署內研究計畫書（DOC-2）開啟後，請全選（Ctrl+A / ⌘+A）再右鍵「更新功能變數」以顯示目錄頁碼', 10);
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '文件生成失敗');
    } finally {
      setGenerating(false);
    }
  }, [selectedDocs, getValues]);

  return {
    selectedDocs,
    setSelectedDocs,
    generating,
    download,
    allDocs: ALL_DOCS,
  };
}
