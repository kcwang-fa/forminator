// ===== JSON 匯入匯出 Hook =====

import { useCallback } from 'react';
import { message, Modal } from 'antd';
import { useFormStore } from './useFormStore';
import { exportToJson, importFromJson } from '../utils/exportImport';
import { SDD_VERSION } from '../data/defaults';

interface UseImportExportOptions {
  /** 匯出完成後呼叫，傳入序列化後的草稿字串（給匯出提醒重設 baseline 用） */
  onExported?: (serialized: string) => void;
}

export function useImportExport({ onExported }: UseImportExportOptions = {}) {
  const { getValues, reset } = useFormStore();

  const handleExport = useCallback(() => {
    const values = getValues();
    exportToJson(values);
    message.success('JSON 已匯出！');
    onExported?.(JSON.stringify(values));
  }, [getValues, onExported]);

  const handleImport = useCallback(async (file: File) => {
    const result = await importFromJson(file);
    if (!result) {
      message.error('JSON 檔案格式不正確');
      return;
    }
    if (result.version !== SDD_VERSION) {
      Modal.confirm({
        title: '版本不一致',
        content: `匯入檔案版本為 v${result.version}，目前系統版本為 v${SDD_VERSION}。部分欄位可能不相容，是否繼續匯入？`,
        onOk: () => {
          reset(result.data);
          message.success('匯入成功！');
        },
      });
    } else {
      reset(result.data);
      message.success('匯入成功！');
    }
  }, [reset]);

  return { handleExport, handleImport };
}
