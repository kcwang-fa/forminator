// ===== 第 5 頁：資料庫申請 =====
//
// 此頁分三大區：
//   1. 基本資料（申請單位 / IRB / 期限 / 擷取期間）
//   2. 申請系統清單（每張卡是一個 DatabaseRequestCard）
//   3. 研究成果處理類型
// 子元件 / 共用樣式 / 通用小元件已抽到 ./Step5Database/ 子資料夾。

import { useEffect, useState } from 'react';
import { Button, Card, Checkbox, Collapse, DatePicker, Form, Input, InputNumber, Radio, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import dayjs from 'dayjs';
import { useFormStore } from '../../hooks/useFormStore';
import { emptyDatabaseRequest } from '../../data/defaults';
import { addYears } from '../../utils/date';
import { buildDatabaseUsageScopePreview } from '../../utils/databaseScope';
import type { DatabaseRequest, OutcomeType, ResearchPurposeType } from '../../types/form';
import { DatabaseRequestCard } from './Step5Database/DatabaseRequestCard';
import { denseChoiceGridStyle, sectionStackStyle, twoColumnStyle } from './Step5Database/styles';

const { Text } = Typography;

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
  const { control, setValue } = useFormStore();
  const { fields, append, remove } = useFieldArray({ control, name: 'database_requests' });
  const researchPurposeType = useWatch({ control, name: 'research_purpose_type' });
  const outcomeTypes = useWatch({ control, name: 'outcome_type' }) || [];
  const outcomeTypeDetails = useWatch({ control, name: 'outcome_type_detail' }) || [];
  const databaseRequests = useWatch({ control, name: 'database_requests', defaultValue: [] as DatabaseRequest[] });
  const [scopePreviewText, setScopePreviewText] = useState('');

  useEffect(() => {
    setScopePreviewText(buildDatabaseUsageScopePreview(databaseRequests));
  }, [databaseRequests]);

  const updateOutcomeCount = (type: OutcomeType, count: number | null) => {
    setValue(
      'outcome_type_detail',
      outcomeTypeDetails.map((detail) => (detail.type === type ? { ...detail, count: count || 1 } : detail)),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const updateOutcomeNote = (type: OutcomeType, note: string) => {
    setValue(
      'outcome_type_detail',
      outcomeTypeDetails.map((detail) => (detail.type === type ? { ...detail, note } : detail)),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const updateOutcomePublishDate = (type: OutcomeType, publishDate: string) => {
    setValue(
      'outcome_type_detail',
      outcomeTypeDetails.map((detail) => (detail.type === type ? { ...detail, publish_date: publishDate } : detail)),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  return (
    <div style={sectionStackStyle}>
      <div>
        <h3 style={{ marginBottom: 8 }}>資料庫申請</h3>
        <Text type="secondary">
          先填基本資訊，再填寫申請系統。下方彙整預覽會隨系統內容自動更新。
        </Text>
      </div>

      <Card
        size="small"
        title="基本資料"
        extra={<Tag>{fields.length} 個申請系統</Tag>}
      >
        <div style={sectionStackStyle}>
          <div style={twoColumnStyle}>
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
              name="irb_number"
              control={control}
              rules={{ required: '請輸入 IRB 編號' }}
              render={({ field, fieldState }) => (
                <Form.Item label="IRB 編號" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
                  <Input {...field} placeholder="例：115111" />
                </Form.Item>
              )}
            />
          </div>

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
                style={{ marginBottom: researchPurposeType === 'other' ? 12 : 0 }}
              >
                <Radio.Group
                  value={field.value}
                  options={RESEARCH_PURPOSE_OPTIONS}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    field.onChange(nextValue);
                    if (nextValue !== 'other') {
                      setValue('research_purpose_other_detail', '');
                    }
                  }}
                  style={denseChoiceGridStyle}
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
                <Form.Item label="其他說明" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message} style={{ marginBottom: 0 }}>
                  <Input {...field} value={field.value ?? ''} placeholder="請說明研究目的及用途" />
                </Form.Item>
              )}
            />
          )}

          <div style={twoColumnStyle}>
            <Controller
              name="apply_date"
              control={control}
              rules={{ required: '請選擇申請日期' }}
              render={({ field, fieldState }) => (
                <Form.Item label="申請日期" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
                  <DatePicker
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(d) => field.onChange(d?.format('YYYY-MM-DD') || '')}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              )}
            />

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
                      setValue('retention_deadline', dateStr ? addYears(dateStr, 3) : '');
                    }}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              )}
            />
          </div>

          <div style={twoColumnStyle}>
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

            <div />
          </div>

          <div style={twoColumnStyle}>
            <Controller
              name="apply_year_start"
              control={control}
              rules={{ required: '請選擇資料擷取期間起日' }}
              render={({ field, fieldState }) => (
                <Form.Item label="資料擷取期間（起）" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
                  <DatePicker
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(d) => field.onChange(d?.format('YYYY-MM-DD') || '')}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              )}
            />

            <Controller
              name="apply_year_end"
              control={control}
              rules={{ required: '請選擇資料擷取期間迄日' }}
              render={({ field, fieldState }) => (
                <Form.Item label="資料擷取期間（迄）" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message} style={{ marginBottom: 0 }}>
                  <DatePicker
                    value={field.value ? dayjs(field.value) : null}
                    onChange={(d) => field.onChange(d?.format('YYYY-MM-DD') || '')}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              )}
            />
          </div>
        </div>
      </Card>

      <Card
        size="small"
        title="申請系統"
        extra={(
          <Button icon={<PlusOutlined />} onClick={() => append({ ...emptyDatabaseRequest })}>
            新增系統
          </Button>
        )}
      >
        <div style={sectionStackStyle}>
          <Text type="secondary">
            每張卡代表一個申請系統。先填系統與擷取條件，再補欄位；DOC-8 欄位目的有需要再展開。
          </Text>

          <div>
            {fields.map((field, index) => (
              <DatabaseRequestCard
                key={field.id}
                index={index}
                canRemove={fields.length > 1}
                onRemove={() => remove(index)}
              />
            ))}
          </div>

          <Form.Item
            label="資料庫預定使用範圍彙整預覽"
            tooltip="系統會依各申請系統的明細自動整理預覽文字。"
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea
              value={scopePreviewText}
              rows={Math.max(4, databaseRequests.length + 1)}
              readOnly
            />
          </Form.Item>
        </div>
      </Card>

      <Card size="small" title="研究成果處理類型">
        <div style={sectionStackStyle}>
          <Controller
            name="outcome_type"
            control={control}
            rules={{
              validate: (value) => {
                if (!value || value.length === 0) return '請至少選擇一種研究成果處理類型';
                if (value.includes('paper_publish')) {
                  const publishDetail = outcomeTypeDetails.find((detail) => detail.type === 'paper_publish');
                  if (!publishDetail?.publish_date) return '選擇論文發表時，請填寫預計發表日期';
                }
                return true;
              },
            }}
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
                      selected.map((type) => {
                        const existing = outcomeTypeDetails.find((detail) => detail.type === type);
                        return existing || { type, count: 1, note: '', publish_date: '' };
                      }),
                      { shouldDirty: true, shouldValidate: true },
                    );
                  }}
                  style={{ ...denseChoiceGridStyle, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
                />
              </Form.Item>
            )}
          />

          {outcomeTypes.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {outcomeTypes.map((type) => {
                const detail = outcomeTypeDetails.find((item) => item.type === type);
                const label = OUTCOME_TYPE_OPTIONS.find((option) => option.value === type)?.label || type;

                return (
                  <div
                    key={type}
                    style={{ padding: 12, border: '1px solid #f0f0f0', borderRadius: 10, background: '#fafafa' }}
                  >
                    <Form.Item
                      label={`${label}件數`}
                      style={{ marginBottom: (type === 'other' || type === 'paper_publish') ? 8 : 0 }}
                    >
                      <InputNumber
                        min={1}
                        precision={0}
                        value={detail?.count || 1}
                        onChange={(value) => updateOutcomeCount(type, value)}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>

                    {type === 'other' && (
                      <Input
                        value={detail?.note || ''}
                        onChange={(event) => updateOutcomeNote(type, event.target.value)}
                        placeholder="請說明其他成果類型"
                      />
                    )}

                    {type === 'paper_publish' && (
                      <Form.Item
                        label="預計發表日期"
                        required
                        validateStatus={!detail?.publish_date ? 'error' : ''}
                        help={!detail?.publish_date ? '請填寫預計發表日期' : ''}
                        style={{ marginBottom: 0 }}
                      >
                        <DatePicker
                          value={detail?.publish_date ? dayjs(detail.publish_date) : null}
                          onChange={(d) => updateOutcomePublishDate(type, d?.format('YYYY-MM-DD') || '')}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Collapse
        ghost
        items={[{
          key: 'preset',
          label: '進階設定（MVP 預設值）',
          children: (
            <div style={{ opacity: 0.7 }}>
              <p>資料交付方式：數位檔案</p>
              <p>資料使用地點：本署署內辦公場域 + 個人公務電腦</p>
              <p>資科中心勾稽：否</p>
            </div>
          ),
        }]}
      />
    </div>
  );
}
