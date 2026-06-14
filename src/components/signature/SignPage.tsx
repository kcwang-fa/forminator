// ===== 手機簽名頁（/sign）=====
//
// QR 簽名流程的「手機端」：電腦的 QrSignModal 顯示 QR code，手機掃碼開到
// /sign?s=<session>&name=<簽名者>，簽完按送出 → POST /api/sign/submit →
// 電腦端輪詢取回。這一頁完全獨立於 wizard（main.tsx 依路徑分流渲染），
// 不載入表單，任何人拿到連結只能「送出一張簽名圖」，看不到計畫內容。
//
// session id 只存在 URL 裡、10 分鐘過期、取完即刪——詳見 api/_lib/signStore.js 的安全設計。

import { useState } from 'react';
import { ConfigProvider, Button, Typography, Alert, Space, App as AntApp } from 'antd';
import zhTW from 'antd/locale/zh_TW';
import { useSignaturePad } from './useSignaturePad';

const { Title, Text } = Typography;

function SignPageContent() {
  // 從網址讀 session 與簽名者姓名（QrSignModal 產 QR 時帶上的）
  const params = new URLSearchParams(window.location.search);
  const session = params.get('s') || '';
  const signerName = params.get('name') || '';

  const { setupCanvas, clear, isEmpty, exportPng } = useSignaturePad();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // 沒帶 session = 不是從 QR 掃進來的，直接擋下
  if (!session) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" title="連結無效" description="請回到電腦上的 Forminator，按「手機簽」重新產生 QR code。" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ padding: 24, textAlign: 'center', marginTop: 80 }}>
        <div style={{ fontSize: 64 }}>✅</div>
        <Title level={3}>簽好了！</Title>
        <Text type="secondary">請回到電腦上繼續，這個頁面可以關掉了。</Text>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (isEmpty()) {
      setError('還沒簽名喔，請先在框框裡簽名');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const resp = await fetch('/api/sign/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session, image: exportPng() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || `送出失敗（HTTP ${resp.status}）`);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '送出失敗，請再試一次');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <Title level={4} style={{ marginTop: 8 }}>
        ✍️ 請{signerName ? `「${signerName}」` : ''}在下方簽名
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        手機橫放簽起來比較順手。簽完按「送出簽名」，電腦那邊會自動收到。
      </Text>

      {/* 簽名框：手機上吃掉大部分高度，給手指足夠空間 */}
      <canvas
        ref={setupCanvas}
        style={{
          width: '100%',
          height: '45vh',
          border: '2px dashed #D9D4CC',
          borderRadius: 8,
          background: '#FDFCFA',
          touchAction: 'none',  // 簽名時不要讓頁面跟著捲動
        }}
      />

      {error && <Alert type="warning" title={error} style={{ marginTop: 12 }} />}

      <Space style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} size={12}>
        <Button size="large" onClick={clear}>清除重簽</Button>
        <Button size="large" type="primary" loading={submitting} onClick={handleSubmit}>
          送出簽名
        </Button>
      </Space>

      <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
        簽名只會傳給產生這個 QR code 的那台電腦，10 分鐘內沒送出連結就會失效。
      </Text>
    </div>
  );
}

// 獨立頁需要自己的 ConfigProvider（主題色與 App.tsx 一致）
export default function SignPage() {
  return (
    <ConfigProvider
      locale={zhTW}
      theme={{
        token: {
          colorPrimary: '#2C6FBF',
          fontFamily: '"LXGW WenKai TC", "Noto Sans TC", sans-serif',
          colorBgLayout: '#F7F5F0',
        },
      }}
    >
      <AntApp>
        <SignPageContent />
      </AntApp>
    </ConfigProvider>
  );
}
