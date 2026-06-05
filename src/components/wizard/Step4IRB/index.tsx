// ===== 第 4 頁：IRB 審查（對應 IRB-012 免審申請表 / DOC-5）=====
//
// 重做重點：主結構「貼齊 IRB-012 表單真實題目順序」。
//   題目順序＝研究類別 → 免審理由 → 研究方法及工具 → 納入/排除 → 招募/互動 → 隱私三段。
//   三顆「帶入草稿」link button 皆手動點擊、刻意覆寫：免審理由 ← 審查小幫手判斷理由、
//   研究方法 ← Step 3 methodology、隱私三段 ← buildPrivacyDraftFromScreening（審查小幫手＋罐頭預設）。
//
// 子元件（皆透過 React Hook Form path 對接，不傳 props）：
//   - ReviewConclusionCard：Step 1 判斷結果 + 手動覆寫
//   - ExemptDefaultsPanel：招募 / 互動（免審預設否）
//   - ExemptRewritePanel：AI 潤飾主畫面五欄位（選用，預設收合）
//
// 目前只支援免審（exempt）；簡審 / 一般審欄位待模板備妥後再於此擴充（已留條件渲染位置）。

import { useMemo } from 'react';
import { Alert, App, Button, Checkbox, Form, Input } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { Controller, useWatch } from 'react-hook-form';
import { useFormStore } from '../../../hooks/useFormStore';
import { classifyReviewType } from '../../../utils/reviewClassifier';
import { buildExemptReasonFromDecision, buildPrivacyDraftFromScreening } from '../../../utils/exemptIrbText';
import type { ExemptCategory } from '../../../types/form';
import { ReviewConclusionCard } from './ReviewConclusionCard';
import { ExemptDefaultsPanel } from './ExemptDefaultsPanel';
import { ExemptRewritePanel } from './ExemptRewritePanel';
import { twoColumnStyle } from './styles';

// 研究類別（IRB-012 表單「可複選」）——對應表單四個勾選 + 最低風險，共 5 項。
const EXEMPT_CATEGORY_OPTIONS: { value: ExemptCategory; label: string }[] = [
  { value: 'public_non_interactive', label: '於公開場合進行之非記名、非互動且非介入性研究' },
  { value: 'public_info', label: '使用已合法公開週知之資訊，且使用符合其公開目的' },
  { value: 'public_policy', label: '公務機關執行法定職務進行之公共政策成效評估研究' },
  { value: 'education', label: '一般教學環境中之教育評量、測試或教學技巧研究' },
  { value: 'minimal_risk', label: '研究計畫屬最低風險（風險不高於日常生活）' },
];

export default function Step4IRB() {
  const { control, setValue, getValues } = useFormStore();
  const { message } = App.useApp();
  const reviewType = useWatch({ control, name: 'review_type' });

  // 讀審查類型小幫手的判斷結果（screening 變動才重算）。判斷邏輯全在 reviewClassifier，
  // 這裡只用 decision.reasons 來做「一鍵帶入免審理由」，與 ReviewConclusionCard 各算一份
  // （pure、cheap，維持子元件靠 RHF path 對接、不互傳 props 的慣例）。
  const screening = useWatch({ control, name: 'review_screening' });
  const decision = useMemo(() => classifyReviewType(screening), [screening]);
  // 只有小幫手判出免審、且有理由時才提供帶入按鈕（避免帶入「請先選擇…」之類提示語）
  const canApplyScreeningReason = decision.review_type === 'exempt' && decision.reasons.length > 0;

  const handleApplyScreeningReason = () => {
    setValue('exempt_reason', buildExemptReasonFromDecision(decision.reasons), { shouldDirty: true });
    message.success('已帶入審查小幫手的判斷理由，可再手動修改。');
  };

  // 「研究方法及工具描述」直接帶入 Step 3 寫的「研究方法」(methodology)——使用者自己寫的，最精準
  const methodology = useWatch({ control, name: 'methodology' });
  const canDraftDataSource = !!methodology?.trim();

  const handleDraftDataSource = () => {
    setValue('data_source', methodology, { shouldDirty: true });
    message.success('已帶入 Step 3 的研究方法，可再手動補充。');
  };

  // 隱私三段：用審查類型小幫手已填的「可識別性 / 是否接觸個案」＋ 罐頭預設句生成草稿，再手動改具體值。
  // 同樣是手動點擊、刻意覆寫（與上面兩顆帶入按鈕一致）。
  const handleDraftPrivacy = () => {
    const draft = buildPrivacyDraftFromScreening(getValues());
    setValue('privacy_during', draft.privacy_during, { shouldDirty: true });
    setValue('privacy_after', draft.privacy_after, { shouldDirty: true });
    setValue('privacy_withdrawal', draft.privacy_withdrawal, { shouldDirty: true });
    message.success('已依審查小幫手內容帶入隱私保護草稿，可再手動修改。');
  };

  return (
    <div>
      <h3>IRB 審查資訊</h3>

      {/* 審查結論（所有審查類型都顯示）*/}
      <ReviewConclusionCard />

      {reviewType === 'exempt' ? (
        <>
          {/* 研究類別（可複選）— IRB-012 表單第 3 題 */}
          <Controller
            name="exempt_category"
            control={control}
            render={({ field }) => (
              <Form.Item label="研究類別（可複選）" tooltip="對應 IRB-012 免審申請表「研究類別」，可勾選多項。">
                <Checkbox.Group
                  value={field.value}
                  onChange={field.onChange}
                  options={EXEMPT_CATEGORY_OPTIONS}
                  // 每項獨立一行，長句不擠在一起
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                />
              </Form.Item>
            )}
          />

          {/* 免審理由 + 研究方法及工具（DOC-5 真正注入的兩欄，放主位）*/}
          <Controller
            name="exempt_reason"
            control={control}
            render={({ field }) => (
              <Form.Item label="免審理由">
                {canApplyScreeningReason && (
                  <Button
                    type="link"
                    size="small"
                    icon={<BulbOutlined />}
                    onClick={handleApplyScreeningReason}
                    style={{ padding: 0, height: 'auto', marginBottom: 6 }}
                  >
                    帶入審查小幫手判斷理由
                  </Button>
                )}
                <Input.TextArea {...field} rows={3} placeholder="可手動填寫，或用下方『免審文案小幫手』一鍵產生草稿" />
              </Form.Item>
            )}
          />

          <Controller
            name="data_source"
            control={control}
            render={({ field }) => (
              <Form.Item label="研究方法及工具描述" tooltip="如：防疫用剩餘檢體、問卷、資料庫，並說明來源、數量及蒐集範圍">
                {canDraftDataSource && (
                  <Button
                    type="link"
                    size="small"
                    icon={<BulbOutlined />}
                    onClick={handleDraftDataSource}
                    style={{ padding: 0, height: 'auto', marginBottom: 6 }}
                  >
                    帶入 Step 3 研究方法
                  </Button>
                )}
                <Input.TextArea {...field} rows={4} />
              </Form.Item>
            )}
          />

          {/* 研究對象納入及排除條件（IRB-012 表單第 6 題，注入 DOC-5）*/}
          <div style={twoColumnStyle}>
            <Controller
              name="inclusion_criteria"
              control={control}
              render={({ field }) => (
                <Form.Item label="研究對象納入條件">
                  <Input.TextArea {...field} rows={3} placeholder="例：2018 至 2025 年通報之確定病例" />
                </Form.Item>
              )}
            />
            <Controller
              name="exclusion_criteria"
              control={control}
              render={({ field }) => (
                <Form.Item label="研究對象排除條件">
                  <Input.TextArea {...field} rows={3} placeholder="例：通報資料關鍵欄位缺漏無法分析者" />
                </Form.Item>
              )}
            />
          </div>

          {/* 招募 / 互動（免審預設否）*/}
          <ExemptDefaultsPanel />

          {/* 隱私保護三段（IRB-012 表單第 9 題）*/}
          <h4 style={{ marginTop: 8 }}>隱私保護措施</h4>
          <p style={{ color: '#666', fontSize: 13 }}>可先留白；送件前手動填寫，或用下方按鈕依審查小幫手內容帶入草稿。</p>

          <Button
            type="link"
            size="small"
            icon={<BulbOutlined />}
            onClick={handleDraftPrivacy}
            style={{ padding: 0, height: 'auto', marginBottom: 6 }}
          >
            帶入隱私保護草稿
          </Button>

          <Controller
            name="privacy_during"
            control={control}
            render={({ field }) => (
              <Form.Item label="研究中參與者之隱私保護">
                <Input.TextArea {...field} rows={3} placeholder="可先留白" />
              </Form.Item>
            )}
          />
          <Controller
            name="privacy_after"
            control={control}
            render={({ field }) => (
              <Form.Item label="研究結束後參與者之隱私保護">
                <Input.TextArea {...field} rows={3} placeholder="可先留白" />
              </Form.Item>
            )}
          />
          <Controller
            name="privacy_withdrawal"
            control={control}
            render={({ field }) => (
              <Form.Item label="研究中途退出者之隱私保護">
                <Input.TextArea {...field} rows={2} placeholder="可先留白" />
              </Form.Item>
            )}
          />

          {/* AI 潤飾面板（選用，預設收合）*/}
          <ExemptRewritePanel />
        </>
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16 }}
          message="目前僅支援免審（exempt）的表單欄位"
          description="簡易審查 / 一般審查的專屬欄位待模板備妥後再開放。若需改回免審，可在上方「審查類型」調整。"
        />
      )}
    </div>
  );
}
