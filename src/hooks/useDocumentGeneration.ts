// ===== 文件生成 Hook =====

import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useFormStore } from './useFormStore';
import { generateAllDocuments } from '../utils/docgen';
import { DOC_NAMES } from '../data/defaults';

const ALL_DOCS = Object.keys(DOC_NAMES);

export function useDocumentGeneration() {
  const { getValues } = useFormStore();
  const [selectedDocs, setSelectedDocs] = useState<string[]>(ALL_DOCS);
  const [generating, setGenerating] = useState(false);

  const download = useCallback(async () => {
    if (selectedDocs.length === 0) {
      message.warning('請至少選擇一份文件');
      return;
    }
    setGenerating(true);
    try {
      await generateAllDocuments(getValues(), selectedDocs);
      message.success(`已生成 ${selectedDocs.length} 份文件並下載 ZIP！`);
      if (selectedDocs.includes('DOC-4')) {
        message.info('提醒：署內研究計畫書（DOC-4）開啟後，請全選（Ctrl+A / ⌘+A）再右鍵「更新功能變數」以顯示目錄頁碼', 10);
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
