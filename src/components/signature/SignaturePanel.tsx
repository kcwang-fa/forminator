// ===== 簽名管理面板（結果頁）=====
//
// 放在結果頁「選擇要產生的文件」上方，動線：看總覽 → 補簽 → 勾文件 → 下載。
// 上半部「簽章文件總覽」：目前要產出的文件裡，哪些欄位要簽、誰簽、簽了沒。
// 下半部「研究團隊簽名」：每位人員一張卡，可以「現場簽」（簽名板）、
// 「上傳圖檔」、「匯出簽名」、「清除」。
//
// 簽名存在 personnel[i].signature_image（base64 PNG data URL），跟著表單草稿
// 一起自動儲存／匯出 JSON。生成文件時 docgen 自動把簽名圖嵌進對應簽章欄；
// 沒簽名的欄位留白，列印後仍可手簽。主管核章欄位（manual_only）一律留白。

import { useState } from 'react';
import { Alert, Card, Table, Tag, Button, Upload, Space, Typography, App } from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  QrcodeOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import fileSaver from 'file-saver';
import { useFormStore } from '../../hooks/useFormStore';
import { SIGNATURE_FIELDS, type SignatureFieldSpec } from '../../data/signatureRequirements';
import { resolveActivePlan } from '../../data/planConfigs';
import { DOC_NAMES } from '../../data/defaults';
import { ROLE_MAP } from '../../utils/docgenMaps';
import { normalizeSignatureImage, signatureDataUrlToBlob } from '../../utils/signatureImage';
import type { Personnel } from '../../types/form';
import SignaturePadModal from './SignaturePadModal';
import QrSignModal from './QrSignModal';
import { validatePersonnel } from '../../utils/personnelValidation';

const { Text } = Typography;
const { saveAs } = fileSaver;

// 附表一 loop 只涵蓋這三種角色（與 docgen/personnelAppendix.ts 的 filter 一致）
const APPENDIX_ROLES = ['pi', 'co_pi', 'researcher'];

function buildSignatureFilename(name: string, index: number): string {
  const fallbackName = `第${index + 1}位人員`;
  const safeName = (name.trim() || fallbackName)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  return `${safeName}_簽名.png`;
}

export default function SignaturePanel() {
  const { watch, setValue } = useFormStore();
  const { message } = App.useApp();

  const personnel: Personnel[] = watch('personnel') ?? [];
  const reviewType = watch('review_type');
  const outputCategories = watch('output_categories') ?? [];
  const activeDocs = resolveActivePlan(reviewType, outputCategories).docs;
  const { piCandidates, duplicateNames } = validatePersonnel(personnel);

  // 簽名板 Modal 目前在幫第幾位人員簽（null = 關閉）
  const [signingIndex, setSigningIndex] = useState<number | null>(null);
  // QR 手機簽 Modal 目前在幫第幾位人員簽（null = 關閉）
  const [qrIndex, setQrIndex] = useState<number | null>(null);

  // PI 的認定與 docgen 一致：role === 'pi'，找不到就退回第一位
  const pi = piCandidates[0] ?? personnel[0];

  // 只顯示「目前會產出的文件」的簽章欄位，其他文件的欄位列出來只會干擾
  const visibleFields = SIGNATURE_FIELDS.filter((spec) => activeDocs.includes(spec.docId));

  // 寫簽名（shouldDirty 讓 useAutoSave 的 watch 連動存進 localStorage）
  const writeSignature = (index: number, dataUrl: string) => {
    setValue(`personnel.${index}.signature_image`, dataUrl, { shouldDirty: true });
  };

  // 每位人員的上傳處理：normalizeSignatureImage 會把大圖縮到統一尺寸的 PNG
  const handleUpload = (index: number, file: File) => {
    normalizeSignatureImage(file)
      .then((dataUrl) => {
        writeSignature(index, dataUrl);
        message.success('簽名圖已上傳');
      })
      .catch((err) => message.error(err instanceof Error ? err.message : '圖檔處理失敗'));
    return false;  // 擋掉 antd Upload 的自動上傳（我們只在本機處理）
  };

  const handleExport = (person: Personnel, index: number) => {
    if (!person.signature_image) {
      message.warning('這位人員尚未簽名');
      return;
    }
    try {
      const filename = buildSignatureFilename(person.name_zh, index);
      saveAs(signatureDataUrlToBlob(person.signature_image), filename);
      message.success(`已匯出 ${filename}`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '簽名匯出失敗');
    }
  };

  // 總覽表的「狀態」欄：依誰簽（pi / 每人 / 留白手簽）算出對應的 Tag
  const renderStatus = (spec: SignatureFieldSpec) => {
    if (spec.signer === 'manual_only') return <Tag>列印後手簽／核章</Tag>;
    if (spec.signer === 'pi') {
      return pi?.signature_image
        ? <Tag color="green">已簽</Tag>
        : <Tag color="orange">未簽</Tag>;
    }
    // each_member：算「該範圍內」簽了幾位
    const members = spec.memberScope === 'appendix'
      ? personnel.filter((p) => APPENDIX_ROLES.includes(p.role))
      : personnel;
    const signed = members.filter((p) => p.signature_image).length;
    if (members.length === 0) return <Tag>無人員</Tag>;
    return signed === members.length
      ? <Tag color="green">{signed}/{members.length} 已簽</Tag>
      : <Tag color="orange">{signed}/{members.length} 已簽</Tag>;
  };

  return (
    <Card
      title="✍️ 簽名（可先簽好再下載，留白的欄位列印後仍可手簽）"
      style={{ marginBottom: 24, borderColor: '#D9D4CC' }}
    >
      {piCandidates.length !== 1 && (
        <Alert
          type="error"
          showIcon
          title={piCandidates.length === 0 ? '沒有計畫主持人' : `偵測到 ${piCandidates.length} 位計畫主持人`}
          description="請返回「研究團隊」修正為一位計畫主持人。否則同一人可能出現多張簽名卡與重複逐人文件，系統也會停止產檔。"
          style={{ marginBottom: 16 }}
        />
      )}
      {duplicateNames.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title={`可能重複的人員：${duplicateNames.join('、')}`}
          description="同名資料不會自動合併，請回到「研究團隊」確認是否為同一人。"
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ── 上半：簽章文件總覽 ── */}
      <Table<SignatureFieldSpec>
        size="small"
        pagination={false}
        rowKey={(spec) => `${spec.docId}-${spec.field}`}
        dataSource={visibleFields}
        style={{ marginBottom: 20 }}
        columns={[
          {
            title: '文件',
            dataIndex: 'docId',
            width: 280,
            render: (docId: SignatureFieldSpec['docId']) => <Text>{docId} {DOC_NAMES[docId]}</Text>,
          },
          { title: '簽章欄位', dataIndex: 'field' },
          {
            title: '狀態',
            width: 140,
            render: (_, spec) => renderStatus(spec),
          },
          {
            title: '說明',
            dataIndex: 'note',
            render: (note?: string) => note ? <Text type="secondary" style={{ fontSize: 12 }}>{note}</Text> : null,
          },
        ]}
      />

      {/* ── 下半：研究團隊簽名（每人一卡）── */}
      <Text strong style={{ display: 'block', marginBottom: 12 }}>研究團隊簽名</Text>
      {personnel.length === 0 ? (
        <Text type="secondary">尚未新增任何人員（回到「研究團隊」步驟新增）。</Text>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {personnel.map((person, index) => (
            <Card key={index} size="small" style={{ background: '#FDFCFA' }}>
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                <Space size={8}>
                  <Text strong>{person.name_zh || `（第 ${index + 1} 位，未填姓名）`}</Text>
                  <Tag color="blue">{ROLE_MAP[person.role] || person.role}</Tag>
                </Space>

                {/* 簽名縮圖：白底框，沒簽時顯示提示文字 */}
                <div style={{
                  height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px dashed #D9D4CC', borderRadius: 6, background: '#FFF',
                }}>
                  {person.signature_image
                    ? <img src={person.signature_image} alt={`${person.name_zh} 的簽名`} style={{ maxHeight: 48, maxWidth: '90%' }} />
                    : <Text type="secondary" style={{ fontSize: 12 }}>尚未簽名</Text>}
                </div>

                <Space wrap size={8}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => setSigningIndex(index)}>
                    現場簽
                  </Button>
                  <Button size="small" icon={<QrcodeOutlined />} onClick={() => setQrIndex(index)}>
                    手機簽
                  </Button>
                  <Upload
                    accept="image/png,image/jpeg"
                    showUploadList={false}
                    beforeUpload={(file) => handleUpload(index, file)}
                  >
                    <Button size="small" icon={<UploadOutlined />}>上傳圖檔</Button>
                  </Upload>
                  {person.signature_image && (
                    <>
                      <Button
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => handleExport(person, index)}
                      >
                        匯出簽名
                      </Button>
                      <Button size="small" danger icon={<DeleteOutlined />}
                        onClick={() => writeSignature(index, '')}>
                        清除
                      </Button>
                    </>
                  )}
                </Space>
              </Space>
            </Card>
          ))}
        </div>
      )}

      {/* 簽名板 Modal：signingIndex 指到誰就幫誰簽 */}
      <SignaturePadModal
        open={signingIndex !== null}
        signerName={signingIndex !== null ? (personnel[signingIndex]?.name_zh || '未命名人員') : ''}
        onConfirm={(dataUrl) => {
          if (signingIndex !== null) writeSignature(signingIndex, dataUrl);
          setSigningIndex(null);
        }}
        onCancel={() => setSigningIndex(null)}
      />

      {/* QR 手機簽 Modal：手機掃碼簽完，簽名自動回傳帶入。
          條件掛載（不是傳 open prop）：每次開啟都重新掛載 → 產生全新的一次性 session */}
      {qrIndex !== null && (
        <QrSignModal
          signerName={personnel[qrIndex]?.name_zh || '未命名人員'}
          onReceived={(dataUrl) => {
            writeSignature(qrIndex, dataUrl);
            message.success('已收到手機簽名');
            setQrIndex(null);
          }}
          onCancel={() => setQrIndex(null)}
        />
      )}

      <Text type="secondary" style={{ display: 'block', marginTop: 12, fontSize: 12 }}>
        簽名只存在你的瀏覽器（草稿）裡，生成文件時自動嵌入簽章欄。
        單位主管／權責單位的核章欄位一律留白，列印後依公文流程辦理。
      </Text>
    </Card>
  );
}
