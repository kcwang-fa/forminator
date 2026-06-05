// 免審文案 AI 潤飾面板（從原「免審文案小幫手」抽出，預設收合）。
//
// 定位：潤飾的對象是主畫面五個文字欄位（免審理由 / 研究方法及工具 / 隱私三段），
//       不依賴任何素材輸入——直接讀目前畫面文字、送後端潤稿、預覽確認後才套用。
//       AI 只改語氣，不應改變審查類型、資料來源、保存期限或去識別化事實，故套用前以
//       validateExemptIrbRewrite 做本地把關，連同後端 cautions 一併提示。

import { useState } from 'react';
import { App, Alert, Button, Collapse, Input, Space, Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useFormStore } from '../../../hooks/useFormStore';
import { rewriteExemptIrbText } from '../../../api/llm';
import { buildExemptIrbRewriteGuardrails, validateExemptIrbRewrite } from '../../../utils/exemptIrbText';
import type { ExemptIrbDraftText } from '../../../types/form';
import { helperCardBorder } from './styles';

const { Text } = Typography;

export function ExemptRewritePanel() {
  const { setValue, getValues } = useFormStore();
  const { message } = App.useApp();
  const [rewriting, setRewriting] = useState(false);
  const [rewritePreview, setRewritePreview] = useState<ExemptIrbDraftText | null>(null);
  const [rewriteCautions, setRewriteCautions] = useState<string[]>([]);

  // 取目前主畫面五欄位作為待潤飾草稿
  const getCurrentExemptDraft = (): ExemptIrbDraftText => {
    const data = getValues();
    return {
      exempt_reason: data.exempt_reason,
      data_source: data.data_source,
      privacy_during: data.privacy_during,
      privacy_after: data.privacy_after,
      privacy_withdrawal: data.privacy_withdrawal,
    };
  };

  // 把潤飾後的草稿寫回主畫面五欄位
  const applyExemptDraft = (draft: ExemptIrbDraftText) => {
    setValue('exempt_reason', draft.exempt_reason, { shouldDirty: true });
    setValue('data_source', draft.data_source, { shouldDirty: true });
    setValue('privacy_during', draft.privacy_during, { shouldDirty: true });
    setValue('privacy_after', draft.privacy_after, { shouldDirty: true });
    setValue('privacy_withdrawal', draft.privacy_withdrawal, { shouldDirty: true });
  };

  const handleRewriteExemptDraft = async () => {
    const draft = getCurrentExemptDraft();
    const missing = Object.entries(draft).filter(([, value]) => !value.trim()).map(([key]) => key);
    if (missing.length > 0) {
      message.error('請先填寫完整免審文案（免審理由 / 研究方法 / 隱私三段），再使用 AI 潤飾。');
      return;
    }

    setRewriting(true);
    try {
      const data = getValues();
      const res = await rewriteExemptIrbText({
        draft,
        guardrails: buildExemptIrbRewriteGuardrails(data),
      });
      // 本地規則 + 後端回傳的提醒合併去重，套用前讓使用者確認語意有沒有被改壞
      const localCautions = validateExemptIrbRewrite(draft, res.rewritten);
      setRewritePreview(res.rewritten);
      setRewriteCautions(Array.from(new Set([...(res.cautions || []), ...localCautions])));
      message.success('AI 潤飾完成，請檢查預覽後再套用。');
    } catch (err) {
      message.error(`AI 潤飾失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    } finally {
      setRewriting(false);
    }
  };

  return (
    <Collapse
      style={{ marginTop: 24, borderColor: helperCardBorder }}
      items={[{
        key: 'rewrite',
        label: (
          <Space>
            <RobotOutlined />
            <Text strong>AI 潤飾免審文案（選用）</Text>
          </Space>
        ),
        children: (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="潤飾上方已填的免審理由 / 研究方法 / 隱私三段"
              description="AI 只改語氣與通順度，不應改變審查類型、資料來源、保存期限或去識別化事實。潤飾結果會先以預覽呈現，確認後再套用。"
            />

            <Button
              type="primary"
              ghost
              icon={<RobotOutlined />}
              onClick={handleRewriteExemptDraft}
              loading={rewriting}
            >
              AI 潤飾目前文案
            </Button>

            {rewritePreview && (
              <div style={{ marginTop: 16, padding: 16, background: '#fff', border: '1px solid #B7D7F0', borderRadius: 8 }}>
                <Text strong style={{ display: 'block', marginBottom: 12 }}>AI 潤飾預覽</Text>
                {rewriteCautions.length > 0 && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="套用前請確認"
                    description={(
                      <ul style={{ margin: 0, paddingLeft: 20 }}>
                        {rewriteCautions.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    )}
                  />
                )}
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <div>
                    <Text strong>免審理由</Text>
                    <Input.TextArea value={rewritePreview.exempt_reason} rows={3} readOnly />
                  </div>
                  <div>
                    <Text strong>研究方法及工具描述</Text>
                    <Input.TextArea value={rewritePreview.data_source} rows={4} readOnly />
                  </div>
                  <div>
                    <Text strong>研究中隱私保護</Text>
                    <Input.TextArea value={rewritePreview.privacy_during} rows={3} readOnly />
                  </div>
                  <div>
                    <Text strong>研究結束後隱私保護</Text>
                    <Input.TextArea value={rewritePreview.privacy_after} rows={3} readOnly />
                  </div>
                  <div>
                    <Text strong>中途退出者隱私保護</Text>
                    <Input.TextArea value={rewritePreview.privacy_withdrawal} rows={2} readOnly />
                  </div>
                  <Space>
                    <Button
                      type="primary"
                      onClick={() => {
                        applyExemptDraft(rewritePreview);
                        setRewritePreview(null);
                        setRewriteCautions([]);
                        message.success('已套用 AI 潤飾文案。');
                      }}
                    >
                      套用 AI 潤飾
                    </Button>
                    <Button onClick={() => setRewritePreview(null)}>保留原文</Button>
                  </Space>
                </Space>
              </div>
            )}
          </>
        ),
      }]}
    />
  );
}
