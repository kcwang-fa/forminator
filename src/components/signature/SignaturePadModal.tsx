// ===== 簽名板 Modal（桌機現場簽）=====
//
// 用 signature_pad 套件（零依賴、貝茲曲線平滑、滑鼠/觸控/手寫筆都支援）在 canvas 上簽名。
// 初始化的兩個地雷（portal 掛載時機、Modal 動畫期間量不到尺寸）封裝在 useSignaturePad，
// 手機簽名頁（SignPage）也共用同一個 hook。
//
// 輸出：透明背景的 PNG data URL（透明底讓簽名圖疊在文件底線上時不會出現白色方塊）。

import { Modal, Button, Space, App } from 'antd';
import { useSignaturePad } from './useSignaturePad';

interface Props {
  open: boolean;
  signerName: string;                    // 顯示「請 ○○○ 簽名」
  onConfirm: (dataUrl: string) => void;  // 按「確認」回傳簽名 PNG data URL
  onCancel: () => void;
}

export default function SignaturePadModal({ open, signerName, onConfirm, onCancel }: Props) {
  const { message } = App.useApp();
  const { setupCanvas, clear, isEmpty, exportPng } = useSignaturePad();

  const handleConfirm = () => {
    if (isEmpty()) {
      message.warning('還沒簽名喔，請先在框框裡簽名');
      return;
    }
    onConfirm(exportPng());
  };

  return (
    <Modal
      title={`請「${signerName}」簽名`}
      open={open}
      onCancel={onCancel}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={clear}>清除重簽</Button>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" onClick={handleConfirm}>確認</Button>
        </Space>
      }
    >
      {/* 簽名框：虛線邊框 + 淺色底，提示「在這裡簽」。高度固定 200px，寬度隨 Modal */}
      <canvas
        ref={setupCanvas}
        style={{
          width: '100%',
          height: 200,
          border: '2px dashed #D9D4CC',
          borderRadius: 8,
          background: '#FDFCFA',
          touchAction: 'none',  // 觸控簽名時不要讓頁面跟著捲動
          cursor: 'crosshair',
        }}
      />
      <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
        用滑鼠、觸控板或手指在框內簽名；簽錯可按「清除重簽」。
      </div>
    </Modal>
  );
}
