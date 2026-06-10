// ===== 自動存檔狀態小字 =====
//
// Google Docs 式的安靜回饋：放 header 角落，不打斷打字。
// 取代原本那條「內容會自動儲存」的藍色橫幅 —— 同樣告知使用者「有自動存檔」這件事，
// 但只佔一小行、而且會即時反映真正的存檔狀態。

import { Typography } from 'antd';
import { LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { SaveStatus } from '../../hooks/useAutoSave';

const { Text } = Typography;

interface Props {
  status: SaveStatus;
  lastSavedAt: number | null;
}

/** 把 timestamp 格式化成「時:分」（例：14:32） */
function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function SaveStatusIndicator({ status, lastSavedAt }: Props) {
  // 共用樣式：小字、低調、icon 與文字對齊
  const baseStyle: React.CSSProperties = {
    fontSize: 12,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
  };

  if (status === 'saving') {
    return (
      <Text type="secondary" style={baseStyle}>
        <LoadingOutlined />
        儲存中…
      </Text>
    );
  }

  if (status === 'saved' && lastSavedAt) {
    return (
      <Text type="secondary" style={baseStyle}>
        <CheckCircleOutlined style={{ color: '#52c41a' }} />
        已自動儲存 {formatTime(lastSavedAt)}
      </Text>
    );
  }

  // idle：尚未存過，順便告知使用者「有自動存檔」這件事（承接原橫幅的功能）
  return (
    <Text type="secondary" style={baseStyle}>
      編輯後會自動儲存
    </Text>
  );
}
