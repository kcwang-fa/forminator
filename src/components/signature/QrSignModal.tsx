// ===== QR 手機簽名 Modal（桌機端）=====
//
// QR 簽名流程的「電腦端」：
//   1. 元件掛載時產生一次性 session id（crypto.randomUUID，無法猜測）
//   2. 顯示 QR code，內容 = /sign?s=<session>&name=<簽名者> 的完整網址
//   3. 每 2 秒輪詢 /api/sign/poll，手機簽完送出後這裡就會拿到簽名圖
//   4. 拿到圖 → 回呼 onReceived → 父層卸載本元件，簽名直接進表單
//
// 使用方式是「條件掛載」：父層（SignaturePanel）用 {qrIndex !== null && <QrSignModal/>}
// 控制開關。這樣 session 在 useState 初始化器產生一次就好（每次開啟 = 重新掛載 = 新
// session，用過即丟），不需要在 effect 裡 setState（react-hooks 新規則也不允許）。
// 卸載時 useEffect cleanup 自動停輪詢；舊 QR code 掃了只會寫進沒人在聽的 session
//（5 分鐘後自動過期）。

import { useEffect, useState } from 'react';
import { Modal, Typography, Alert, Spin, Space } from 'antd';
import { QRCodeSVG } from 'qrcode.react';

const { Text } = Typography;

interface Props {
  signerName: string;                     // 簽名者姓名（顯示在手機簽名頁）
  onReceived: (dataUrl: string) => void;  // 收到手機簽名時回呼
  onCancel: () => void;
}

const POLL_INTERVAL_MS = 2000;

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.startsWith('127.');
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function originForHost(host: string): string {
  const port = window.location.port ? `:${window.location.port}` : '';
  return `${window.location.protocol}//${host}${port}`;
}

export default function QrSignModal({ signerName, onReceived, onCancel }: Props) {
  // 掛載時產生一次（lazy initializer），整個 Modal 生命週期共用這一個 session
  const [session] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const configuredOrigin = trimTrailingSlash(import.meta.env.VITE_SIGN_PUBLIC_ORIGIN?.trim() || '');
  const configuredHost = import.meta.env.VITE_SIGN_PUBLIC_HOST?.trim() || '';
  const [signOrigin, setSignOrigin] = useState(
    configuredOrigin || (configuredHost ? originForHost(configuredHost) : window.location.origin),
  );
  const [originError, setOriginError] = useState('');

  // 桌機用 localhost 開發時，手機掃到 localhost 只會連回手機自己。
  // npm run dev 會先把區網 IP 注入 VITE_SIGN_PUBLIC_HOST；直接執行 Vite 時，
  // 才向本機 API 取得區網 IP。兩種方式都保留 Vite 實際使用的 port。
  useEffect(() => {
    if (configuredOrigin || configuredHost || !isLoopbackHostname(window.location.hostname)) return;

    let stopped = false;
    fetch('/api/sign/network-info')
      .then(async (resp) => {
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok || !data.host) {
          throw new Error(data.error || '找不到電腦的區網 IP');
        }
        if (stopped) return;

        setSignOrigin(originForHost(data.host));
        setOriginError('');
      })
      .catch((err) => {
        if (stopped) return;
        setOriginError(err instanceof Error ? err.message : '無法建立手機可連線的網址');
      });

    return () => {
      stopped = true;
    };
  }, [configuredHost, configuredOrigin]);

  // 輪詢：掛載就開始，卸載（父層關 Modal）或拿到簽名就停
  useEffect(() => {
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const resp = await fetch(`/api/sign/poll?session=${session}`);
        const data = await resp.json().catch(() => ({}));
        if (stopped) return;
        if (resp.status === 503) {
          // 中繼服務沒設定（本地沒開 API server / Vercel 沒設 Upstash）→ 明講，引導改用上傳
          setError(data.error || '簽名中繼服務未設定');
          return;
        }
        if (data.status === 'done' && data.image) {
          onReceived(data.image);
        }
      } catch {
        // 網路抖一下不要嚇使用者，下一輪再試
      }
    }, POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [session, onReceived]);

  const signUrl = `${signOrigin}/sign?s=${session}&name=${encodeURIComponent(signerName)}`;

  return (
    <Modal
      title={`手機簽名：${signerName}`}
      open
      onCancel={onCancel}
      footer={null}
    >
      <Space orientation="vertical" size={16} style={{ width: '100%', textAlign: 'center' }}>
        <Text>用手機相機掃描 QR code，在手機上簽名後按「送出簽名」。</Text>

        <div style={{ background: '#FFF', padding: 16, display: 'inline-block', borderRadius: 8, border: '1px solid #D9D4CC' }}>
          <QRCodeSVG value={signUrl} size={220} />
        </div>

        {error ? (
          <Alert type="warning" title={error} description="可以改用每張人員卡上的「上傳圖檔」：手機簽好存圖、傳到電腦後上傳。" />
        ) : originError ? (
          <Alert
            type="warning"
            title={originError}
            description="請確認手機和電腦在同一個 Wi-Fi，或設定 VITE_SIGN_PUBLIC_ORIGIN 後重新啟動開發伺服器。"
          />
        ) : (
          <Space size={8}>
            <Spin size="small" />
            <Text type="secondary">等待手機簽名中…（簽完會自動帶入）</Text>
          </Space>
        )}

        <Text type="secondary" style={{ fontSize: 12, wordBreak: 'break-all' }}>
          手機簽名網址：{signUrl}
          <br />
          手機和電腦要在同一個 Wi-Fi；手機簽好後 5 分鐘內會自動收進來。
        </Text>
      </Space>
    </Modal>
  );
}
