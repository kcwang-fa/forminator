// ===== §7.5.2 資料遺失提醒 =====

import { useEffect, useState } from 'react';
import { Alert, Button } from 'antd';
import { ExportOutlined } from '@ant-design/icons';

interface Props {
  onExport: () => void;
  hasData: boolean;
}

export default function DataLossWarning({ onExport, hasData }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [showTimerReminder, setShowTimerReminder] = useState(false);

  // beforeunload 提醒
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasData) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasData]);

  // 10 分鐘提醒
  useEffect(() => {
    if (!hasData) return;
    const timer = setTimeout(() => {
      setShowTimerReminder(true);
    }, 10 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [hasData]);

  return (
    <>
      {!dismissed && (
        <Alert
          message="本系統不會儲存您的填寫資料"
          description="關閉瀏覽器後資料將遺失。請記得匯出 JSON 檔保存進度。"
          type="warning"
          showIcon
          closable
          onClose={() => setDismissed(true)}
          action={
            <Button size="small" icon={<ExportOutlined />} onClick={onExport}>
              匯出 JSON
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}
      {showTimerReminder && (
        <Alert
          message="已填寫一段時間，建議匯出 JSON 檔保存進度"
          type="info"
          showIcon
          closable
          onClose={() => setShowTimerReminder(false)}
          action={
            <Button size="small" icon={<ExportOutlined />} onClick={onExport}>
              匯出
            </Button>
          }
          style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
        />
      )}
    </>
  );
}
