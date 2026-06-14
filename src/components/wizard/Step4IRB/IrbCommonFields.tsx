// ===== IRB 共用欄位（免審 / 簡審 / 一般審分支共用）=====
//
// 免審（DOC-5 IRB-012）、簡審與一般審（DOC-12 IRB-002-1）都要填這幾格、語意相同，故抽成共用元件：
//   研究方法及工具描述（data_source）／研究對象納入・排除條件（inclusion/exclusion）／
//   是否招募研究對象／隱私保護三段（privacy_during/after/withdrawal）。
// 免審專用的互動預設面板可由 showExemptDefaults 控制；簡審與一般審不顯示這個面板。
// 欄位透過 React Hook Form path 對接；只有是否顯示免審預設面板由 prop 控制。
//
// 兩顆「帶入草稿」按鈕（依素材情境生成、刻意覆寫）與隱私「常用範例勾選」小幫手都放這裡，
// 三種審查都用得到（buildDataSourceDraftFromScreening / buildPrivacyDraftFromScreening 不分審查類型）。

import { useMemo, useState } from 'react';
import { Alert, App, Button, Checkbox, Collapse, Form, Input, Tag } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { Controller, useWatch } from 'react-hook-form';
import { useFormStore } from '../../../hooks/useFormStore';
import {
  assessPrivacyDraftInputs,
  buildDataSourceDraftFromScreening,
  buildPrivacyDraftFromScreening,
} from '../../../utils/exemptIrbText';
import { ExemptDefaultsPanel } from './ExemptDefaultsPanel';
import {
  assessPrivacyExample,
  findPrivacyExampleConflict,
  PRIVACY_EXAMPLES,
  PRIVACY_SECTION_META,
  type PrivacyExampleLevel,
  type PrivacySection,
} from './privacyExamples';
import { RecruitmentFields } from './RecruitmentFields';
import { twoColumnStyle } from './styles';

const PRIVACY_SECTIONS: PrivacySection[] = ['during', 'after', 'withdrawal'];

// showExemptDefaults：免審專用互動預設面板（簡審不顯示）。
// showRosterMethods：簡審／一般審 DOC-12 的「研究對象名單取得方式」（免審 DOC-5 無此格）。
export function IrbCommonFields({
  showExemptDefaults = true,
  showRosterMethods = false,
  section = 'all',
}: {
  showExemptDefaults?: boolean;
  showRosterMethods?: boolean;
  section?: 'all' | 'main' | 'privacy';
}) {
  const { control, setValue, getValues } = useFormStore();
  const { message, modal } = App.useApp();
  const screening = useWatch({ control, name: 'review_screening' });
  const recruitSubjects = useWatch({ control, name: 'recruit_subjects' });
  const privacyContext = useMemo(() => ({
    review_screening: screening,
    recruit_subjects: Boolean(recruitSubjects),
  }), [screening, recruitSubjects]);
  const privacyAssessment = useMemo(
    () => assessPrivacyDraftInputs(privacyContext),
    [privacyContext],
  );

  // 隱私「常用範例」勾選狀態：純 UI 暫態（不進 FormData），記錄使用者勾了哪幾條範例（用陣列索引）。
  const [pickedExamples, setPickedExamples] = useState<Set<number>>(new Set());
  const toggleExample = (idx: number) => {
    const next = new Set(pickedExamples);
    if (next.has(idx)) {
      next.delete(idx);
      setPickedExamples(next);
      return;
    }

    const conflict = findPrivacyExampleConflict(pickedExamples, idx);
    if (conflict) {
      message.warning('這兩個中途退出處理方式互相衝突，請先取消原本的選項再改選。');
      return;
    }

    const assessment = assessPrivacyExample(PRIVACY_EXAMPLES[idx], privacyContext);
    if (assessment.level === 'incompatible') {
      message.warning(`這個範例可能不適用：${assessment.message}`);
    }
    next.add(idx);
    setPickedExamples(next);
  };

  const hasPrivacyText = () => {
    const values = getValues();
    return Boolean(
      values.privacy_during.trim()
      || values.privacy_after.trim()
      || values.privacy_withdrawal.trim(),
    );
  };

  const applyWithOverwriteConfirmation = (apply: () => void) => {
    if (!hasPrivacyText()) {
      apply();
      return;
    }
    modal.confirm({
      title: '覆寫現有隱私保護內容？',
      content: '帶入草稿或範例會覆寫對應欄位目前的文字。若已有人工修訂內容，請先確認再繼續。',
      okText: '覆寫並帶入',
      cancelText: '取消',
      onOk: apply,
    });
  };

  const handleDraftDataSource = () => {
    setValue('data_source', buildDataSourceDraftFromScreening(getValues()), { shouldDirty: true });
    message.success('已依素材類型帶入研究方法及工具草稿，請補上數量與蒐集範圍。');
  };

  const handleDraftPrivacy = () => {
    applyWithOverwriteConfirmation(() => {
      const current = getValues();
      const draft = buildPrivacyDraftFromScreening(current);
      setValue('privacy_during', draft.privacy_during, { shouldDirty: true });
      setValue('privacy_after', draft.privacy_after, { shouldDirty: true });
      setValue('privacy_withdrawal', draft.privacy_withdrawal, { shouldDirty: true });
      const assessment = assessPrivacyDraftInputs(current);
      if (assessment.identifiabilityConfirmed) {
        message.success('已依審查小幫手內容帶入隱私保護草稿，可再手動修改。');
      } else {
        message.warning('已帶入中性草稿；資料可識別性尚未確認，正式送件前請補齊並重新檢查。');
      }
    });
  };

  // 把勾選的範例（依三段分組）以換行串接，覆寫對應 privacy_* 欄位（刻意覆寫，使用者再手動調整）。
  const handleApplyExamples = () => {
    if (pickedExamples.size === 0) {
      message.info('尚未勾選任何範例。');
      return;
    }
    applyWithOverwriteConfirmation(() => {
      let applied = 0;
      PRIVACY_SECTIONS.forEach((section) => {
        const texts = PRIVACY_EXAMPLES
          .map((ex, i) => ({ ex, i }))
          .filter(({ ex, i }) => ex.section === section && pickedExamples.has(i))
          .map(({ ex }) => ex.text);
        if (texts.length) {
          setValue(PRIVACY_SECTION_META[section].field, texts.join('\n'), { shouldDirty: true });
          applied += 1;
        }
      });
      if (applied) message.success('已帶入勾選的範例到對應段落，可再手動調整。');
    });
  };

  const levelMeta: Record<PrivacyExampleLevel, { color: string; label: string }> = {
    recommended: { color: 'green', label: '目前適用' },
    caution: { color: 'orange', label: '請確認' },
    incompatible: { color: 'red', label: '可能不適用' },
  };

  // 隱私「常用範例勾選」面板（預設收合的 Collapse），三段分組列出範本舉例供勾選。
  const examplesPanel = (
    <Collapse
      ghost
      items={[{
        key: 'privacy-examples',
        label: '常用範例（勾選後一鍵帶入，可再修改）',
        children: (
          <div>
            {PRIVACY_SECTIONS.map((section) => (
              <div key={section} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{PRIVACY_SECTION_META[section].title}</div>
                {PRIVACY_EXAMPLES.map((ex, i) => {
                  if (ex.section !== section) return null;
                  const assessment = assessPrivacyExample(ex, privacyContext);
                  const meta = levelMeta[assessment.level];
                  return (
                    <div key={i} style={{ marginBottom: 6 }}>
                      <Checkbox checked={pickedExamples.has(i)} onChange={() => toggleExample(i)}>
                        <span style={{ fontSize: 13, color: assessment.level === 'incompatible' ? '#a8071a' : '#555' }}>
                          {ex.text}
                        </span>
                      </Checkbox>
                      <div style={{ marginLeft: 24, marginTop: 3 }}>
                        <Tag color={meta.color}>{meta.label}</Tag>
                        {ex.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                        <span style={{ color: '#777', fontSize: 12 }}>{assessment.message}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <Button type="primary" size="small" onClick={handleApplyExamples}>帶入勾選範例</Button>
          </div>
        ),
      }]}
    />
  );

  return (
    <>
      {section !== 'privacy' && (
        <>
          {/* 研究方法及工具描述（免審注入 DOC-5；簡審對應 DOC-12 自由文字，現階段供撰寫與其他文件參考）*/}
          <Controller
            name="data_source"
            control={control}
            render={({ field }) => (
              <Form.Item label="研究方法及工具描述" tooltip="如：防疫用剩餘檢體、問卷、資料庫，並說明來源、數量及蒐集範圍">
                <Button
                  type="link"
                  size="small"
                  icon={<BulbOutlined />}
                  onClick={handleDraftDataSource}
                  style={{ padding: 0, height: 'auto', marginBottom: 6 }}
                >
                  帶入研究方法及工具草稿
                </Button>
                <Input.TextArea {...field} rows={4} placeholder="可手動填寫，或用上方按鈕依素材帶入草稿，再把句中的 ______ 換成實際數量與範圍" />
              </Form.Item>
            )}
          />

          {/* 研究對象納入及排除條件 */}
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

          {/* 招募主問為三種審查共用；選「是」才顯示招募方式及退出機制。
              名單取得方式（showRosterMethods）在簡審／一般審顯示——對應 DOC-12 第 8 點（3）。 */}
          <RecruitmentFields showRosterMethods={showRosterMethods} />

          {/* 互動為免審專用預設面板；簡審不顯示。 */}
          {showExemptDefaults && <ExemptDefaultsPanel />}
        </>
      )}

      {section !== 'main' && (
        <>
          {/* 隱私保護三段 */}
          <h4 style={{ marginTop: 8 }}>隱私保護措施</h4>
          <p style={{ color: '#666', fontSize: 13 }}>可先留白；送件前手動填寫，或用下方按鈕依審查小幫手帶入草稿，亦可勾選常用範例帶入後再調整。</p>

          {privacyAssessment.cautions.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 8 }}
              title="帶入前請確認"
              description={privacyAssessment.cautions.join('；')}
            />
          )}

          <Button
            type="link"
            size="small"
            icon={<BulbOutlined />}
            onClick={handleDraftPrivacy}
            style={{ padding: 0, height: 'auto', marginBottom: 6 }}
          >
            帶入隱私保護草稿
          </Button>

          {examplesPanel}

          <Controller
            name="privacy_during"
            control={control}
            render={({ field }) => (
              <Form.Item label="研究中參與者之隱私保護" style={{ marginTop: 8 }}>
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
        </>
      )}
    </>
  );
}
