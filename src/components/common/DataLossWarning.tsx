// ===== 資料提醒：auto-save 通知 + 關閉分頁提醒 =====

import { useEffect, useState } from 'react';
import { Alert } from 'antd';

interface Props {
  onExport: () => void;
  hasData: boolean;
}

export default function DataLossWarning({ onExport: _onExport, hasData }: Props) {
  const [dismissed, setDismissed] = useState(false);

  // 關閉分頁時仍提醒（多一層保險）
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasData) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasData]);

  return (
    <>
      {!dismissed && (
        <Alert
          message="填寫內容會自動儲存於瀏覽器中"
          description="下次開啟網頁會自動還原。如需備份或搬到其他電腦，請使用「匯出 JSON」功能。"
          type="info"
          showIcon
          closable
          onClose={() => setDismissed(true)}
          style={{ marginBottom: 16 }}
        />
      )}
    </>
  );
}
