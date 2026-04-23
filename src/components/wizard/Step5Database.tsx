// ===== 第 5 頁：資料庫申請 =====

import { Form, Input, DatePicker, Collapse, Tag, Radio, Checkbox, InputNumber } from 'antd';
import { Controller, useWatch } from 'react-hook-form';
import { useFormStore } from '../../hooks/useFormStore';
import { addYears } from '../../utils/date';
import { buildDatabaseUsageScope } from '../../utils/databaseScope';
import dayjs from 'dayjs';
import type { DataFieldKey, OutcomeType, ResearchPurposeType } from '../../types/form';

// 倉儲系統可選的中文欄位（DOC-8 第三區「中文欄位名稱」）
const DATA_FIELD_OPTIONS: { value: DataFieldKey; label: string }[] = [
  { value: 'case_id',      label: '傳染病報告單電腦編號' },
  { value: 'gender',       label: '性別' },
  { value: 'residence',    label: '居住縣市' },
  { value: 'onset_date',   label: '發病日期(西元-yyyymmdd)' },
  { value: 'main_symptom', label: '主要症狀' },
  { value: 'is_dead',      label: '是否死亡' },
  { value: 'death_date',   label: '死亡日期(西元-yyyymmdd)' },
  { value: 'other',        label: '其他（自填）' },
];

const RESEARCH_PURPOSE_OPTIONS: { value: ResearchPurposeType; label: string }[] = [
  { value: 'internal_research', label: '署內科技研究計畫' },
  { value: 'thesis', label: '碩、博士論文' },
  { value: 'no_fund_research', label: '無需經費研究計畫' },
  { value: 'other', label: '其他，請說明' },
];

const OUTCOME_TYPE_OPTIONS: { value: OutcomeType; label: string }[] = [
  { value: 'policy', label: '提供決策' },
  { value: 'report', label: '研究報告' },
  { value: 'paper_writing', label: '論文寫作' },
  { value: 'paper_publish', label: '論文發表' },
  { value: 'other', label: '其他' },
];

export default function Step5Database() {
  const { control, setValue, getValues } = useFormStore();
  const applySystem = useWatch({ control, name: 'apply_system' });
  const researchPurposeType = useWatch({ control, name: 'research_purpose_type' });
  const outcomeTypes = useWatch({ control, name: 'outcome_type' }) || [];
  const outcomeTypeDetails = useWatch({ control, name: 'outcome_type_detail' }) || [];
  const dataFields = useWatch({ control, name: 'data_fields' }) || [];
  useWatch({ control, name: 'apply_system_other' });
  useWatch({ control, name: 'apply_condition' });
  useWatch({ control, name: 'analysis_location' });
  useWatch({ control, name: 'data_fields_other' });
  const selectedPurposeLabel = RESEARCH_PURPOSE_OPTIONS.find(option => option.value === researchPurposeType)?.label || '未選擇';
  const dbUsageScope = buildDatabaseUsageScope(getValues());
  const selectedOutcomeText = outcomeTypeDetails.length > 0
    ? outcomeTypeDetails
        .map(detail => {
          const label = OUTCOME_TYPE_OPTIONS.find(option => option.value === detail.type)?.label || detail.type;
          return `${label} ${detail.count || 1} 件`;
        })
        .join('、')
    : '未選擇';

  const updateOutcomeCount = (type: OutcomeType, count: number | null) => {
    setValue(
      'outcome_type_detail',
      outcomeTypeDetails.map(detail => detail.type === type ? { ...detail, count: count || 1 } : detail),
      { shouldDirty: true, shouldValidate: true }
    );
  };

  const updateOutcomeNote = (type: OutcomeType, note: string) => {
    setValue(
      'outcome_type_detail',
      outcomeTypeDetails.map(detail => detail.type === type ? { ...detail, note } : detail),
      { shouldDirty: true, shouldValidate: true }
    );
  };

  return (
    <div>
      <h3>資料庫申請</h3>

      <Controller
        name="apply_unit"
        control={control}
        rules={{ required: '請輸入申請單位' }}
        render={({ field, fieldState }) => (
          <Form.Item label="申請單位" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
            <Input {...field} placeholder="例：北區管制中心" />
          </Form.Item>
        )}
      />

      <Controller
        name="research_purpose_type"
        control={control}
        rules={{ required: '請選擇研究目的及用途' }}
        render={({ field, fieldState }) => (
          <Form.Item
            label="研究目的及用途"
            required
            validateStatus={fieldState.error ? 'error' : ''}
            help={fieldState.error?.message}
          >
            <Radio.Group
              {...field}
              options={RESEARCH_PURPOSE_OPTIONS}
              onChange={(event) => {
                field.onChange(event);
                if (event.target.value !== 'other') {
                  setValue('research_purpose_other_detail', '');
                }
              }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}
            />
          </Form.Item>
        )}
      />

      {researchPurposeType === 'other' && (
        <Controller
          name="research_purpose_other_detail"
          control={control}
          rules={{ required: '請填寫其他研究目的及用途' }}
          render={({ field, fieldState }) => (
            <Form.Item label="其他說明" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
              <Input {...field} value={field.value ?? ''} placeholder="請說明研究目的及用途" />
            </Form.Item>
          )}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Controller
          name="analysis_deadline"
          control={control}
          rules={{ required: '請選擇分析期限' }}
          render={({ field, fieldState }) => (
            <Form.Item label="分析期限" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
              <DatePicker
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => {
                  const dateStr = d?.format('YYYY-MM-DD') || '';
                  field.onChange(dateStr);
                  // 自動計算保留期限 +3 年；清除時一併清除保留期限
                  setValue('retention_deadline', dateStr ? addYears(dateStr, 3) : '');
                }}
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}
        />

        <Controller
          name="retention_deadline"
          control={control}
          render={({ field }) => (
            <Form.Item label="保留期限" tooltip="預設：分析期限 + 3 年，可手動修改">
              <DatePicker
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => field.onChange(d?.format('YYYY-MM-DD') || '')}
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}
        />
      </div>

      <div style={{ background: '#f6f8fa', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h4 style={{ margin: 0, marginBottom: 12 }}>申請使用之防疫資料庫</h4>
        <Tag color="blue" style={{ marginBottom: 12 }}>
          此區內容會帶入 DOC-8（使用申請單）、DOC-9（申請簽呈）、DOC-10（維護單）、DOC-11（個資利用申請表）
        </Tag>

        <Controller
          name="apply_system"
          control={control}
          rules={{ required: '請選擇申請系統' }}
          render={({ field, fieldState }) => (
            <Form.Item label="申請系統" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
              <Radio.Group {...field}>
                <Radio value="warehouse">倉儲系統</Radio>
                <Radio value="other">其他</Radio>
              </Radio.Group>
            </Form.Item>
          )}
        />

        {applySystem === 'other' && (
          <Controller
            name="apply_system_other"
            control={control}
            rules={{ required: '請輸入系統名稱' }}
            render={({ field, fieldState }) => (
              <Form.Item label="系統名稱" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
                <Input {...field} placeholder="例：結核病管理系統" />
              </Form.Item>
            )}
          />
        )}

        <Controller
          name="apply_condition"
          control={control}
          rules={{ required: '請填寫擷取資料條件' }}
          render={({ field, fieldState }) => (
            <Form.Item
              label="擷取資料條件"
              tooltip="填入申請簽呈主旨的「申請使用『XX』資料」及 DOC-8 擷取條件欄位。例：2018至2025年麻疹確定個案"
              required
              validateStatus={fieldState.error ? 'error' : ''}
              help={fieldState.error?.message}
            >
              <Input {...field} placeholder="例：2018至2025年麻疹確定個案" />
            </Form.Item>
          )}
        />

        <Controller
          name="apply_year"
          control={control}
          rules={{ required: '請選擇申請年度' }}
          render={({ field, fieldState }) => (
            <Form.Item label="申請年度" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
              <DatePicker
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => field.onChange(d?.format('YYYY-MM-DD') || '')}
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}
        />

        {applySystem === 'warehouse' && (
          <>
            <Controller
              name="data_fields"
              control={control}
              rules={{ validate: v => (v && v.length > 0) || '請至少勾選一個中文欄位' }}
              render={({ field, fieldState }) => (
                <Form.Item
                  label="中文欄位名稱"
                  tooltip="勾選本次申請需要取得的欄位（DOC-8 會一個欄位一列展開）"
                  required
                  validateStatus={fieldState.error ? 'error' : ''}
                  help={fieldState.error?.message}
                >
                  <Checkbox.Group
                    options={DATA_FIELD_OPTIONS}
                    value={field.value}
                    onChange={v => field.onChange(v)}
                    style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                  />
                </Form.Item>
              )}
            />

            {dataFields.includes('other') && (
              <Controller
                name="data_fields_other"
                control={control}
                rules={{ required: '請填寫其他欄位名稱' }}
                render={({ field, fieldState }) => (
                  <Form.Item label="其他欄位（自填）" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
                    <Input {...field} placeholder="多個欄位以頓號分隔" />
                  </Form.Item>
                )}
              />
            )}
          </>
        )}
      </div>

      <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h4 style={{ margin: 0, marginBottom: 8 }}>資料庫預定使用範圍（自動生成）</h4>
        <p style={{ margin: 0, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{dbUsageScope}</p>
      </div>

      <div style={{ background: '#f6f8fa', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h4 style={{ margin: 0, marginBottom: 12 }}>研究成果處理類型</h4>
        <Controller
          name="outcome_type"
          control={control}
          rules={{ validate: value => (value && value.length > 0) || '請至少選擇一種研究成果處理類型' }}
          render={({ field, fieldState }) => (
            <Form.Item
              required
              validateStatus={fieldState.error ? 'error' : ''}
              help={fieldState.error?.message}
              style={{ marginBottom: outcomeTypes.length > 0 ? 12 : 0 }}
            >
              <Checkbox.Group
                options={OUTCOME_TYPE_OPTIONS}
                value={field.value}
                onChange={(values) => {
                  const selected = values as OutcomeType[];
                  field.onChange(selected);
                  setValue(
                    'outcome_type_detail',
                    selected.map(type => {
                      const existing = outcomeTypeDetails.find(detail => detail.type === type);
                      return existing || { type, count: 1, note: '' };
                    }),
                    { shouldDirty: true, shouldValidate: true }
                  );
                }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}
              />
            </Form.Item>
          )}
        />

        {outcomeTypes.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {outcomeTypes.map(type => {
              const detail = outcomeTypeDetails.find(item => item.type === type);
              const label = OUTCOME_TYPE_OPTIONS.find(option => option.value === type)?.label || type;
              return (
                <div key={type}>
                  <Form.Item label={`${label}件數`} style={{ marginBottom: type === 'other' ? 8 : 0 }}>
                    <InputNumber
                      min={1}
                      precision={0}
                      value={detail?.count || 1}
                      onChange={value => updateOutcomeCount(type, value)}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  {type === 'other' && (
                    <Input
                      value={detail?.note || ''}
                      onChange={event => updateOutcomeNote(type, event.target.value)}
                      placeholder="請說明其他成果類型"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Collapse
        ghost
        items={[{
          key: 'preset',
          label: '進階設定（MVP 預設值）',
          children: (
            <div style={{ opacity: 0.7 }}>
              <p>研究目的及用途：{selectedPurposeLabel}</p>
              <p>資料交付方式：數位檔案</p>
              <p>資料使用地點：本署署內辦公場域 + 個人公務電腦</p>
              <p>研究成果處理類型：{selectedOutcomeText}</p>
              <p>計畫主持人：同申請人員</p>
              <p>資科中心勾稽：否</p>
            </div>
          ),
        }]}
      />
    </div>
  );
}
