// ===== 第 5 頁：資料庫申請 =====

import { useEffect, useState } from 'react';
import { App, Button, Card, Checkbox, Collapse, DatePicker, Form, Input, InputNumber, Popconfirm, Radio, Space, Tag, Typography } from 'antd';
import { PlusOutlined, RobotOutlined } from '@ant-design/icons';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import dayjs from 'dayjs';
import { useFormStore } from '../../hooks/useFormStore';
import { emptyDatabaseRequest } from '../../data/defaults';
import { addYears } from '../../utils/date';
import {
  areFieldPurposesEqual,
  buildDatabaseUsageScopePreview,
  getApplySystemText,
  getDataFieldNames,
  normalizeDoc8FieldPurposes,
  normalizeOtherFields,
} from '../../utils/databaseScope';
import type { DataFieldKey, DatabaseRequest, OutcomeType, ResearchPurposeType } from '../../types/form';
import { generateDbApplyPurpose } from '../../api/llm';

const { Text } = Typography;

const DATA_FIELD_OPTIONS: { value: DataFieldKey; label: string }[] = [
  { value: 'case_id', label: '傳染病報告單電腦編號' },
  { value: 'gender', label: '性別' },
  { value: 'residence', label: '居住縣市' },
  { value: 'onset_date', label: '發病日期(西元-yyyymmdd)' },
  { value: 'main_symptom', label: '主要症狀' },
  { value: 'is_dead', label: '是否死亡' },
  { value: 'death_date', label: '死亡日期(西元-yyyymmdd)' },
  { value: 'other', label: '其他（自填）' },
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

const twoColumnStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 16,
};

const denseChoiceGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 8,
};

const sectionStackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

function getRequestTitle(request: DatabaseRequest | undefined, index: number) {
  const systemName = request?.apply_system === 'warehouse'
    ? '倉儲系統'
    : request?.apply_system_other || '其他系統';
  const condition = request?.apply_condition?.trim();
  return condition ? `系統 ${index + 1}｜${systemName}｜${condition}` : `系統 ${index + 1}｜${systemName}`;
}

function EditableListFields({
  values,
  onChange,
  placeholderPrefix,
  addLabel,
}: {
  values: string[];
  onChange: (value: string[]) => void;
  placeholderPrefix: string;
  addLabel: string;
}) {
  const updateValue = (itemIndex: number, nextValue: string) => {
    const next = [...values];
    next[itemIndex] = nextValue;
    onChange(next);
  };

  const removeValue = (itemIndex: number) => {
    onChange(values.filter((_, idx) => idx !== itemIndex));
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      {values.map((item, itemIndex) => (
        <div
          key={itemIndex}
          style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}
        >
          <Input
            value={item}
            onChange={(event) => updateValue(itemIndex, event.target.value)}
            placeholder={`${placeholderPrefix} ${itemIndex + 1}`}
          />
          <Button
            type="text"
            danger
            onClick={() => removeValue(itemIndex)}
            disabled={values.length <= 1}
          >
            移除
          </Button>
        </div>
      ))}
      <Button type="dashed" onClick={() => onChange([...(values || []), ''])}>
        {addLabel}
      </Button>
    </Space>
  );
}

function DatabaseRequestCard({
  index,
  canRemove,
  onRemove,
}: {
  index: number;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { control, getValues, setValue } = useFormStore();
  const { message } = App.useApp();
  const request = useWatch({ control, name: `database_requests.${index}` }) as DatabaseRequest | undefined;
  const purpose = useWatch({ control, name: 'purpose' }) || '';
  const methodology = useWatch({ control, name: 'methodology' }) || '';
  const applySystem = request?.apply_system;
  const selectedOtherFields = applySystem === 'other' || (request?.data_fields || []).includes('other');
  const fieldNames = getDataFieldNames(request || emptyDatabaseRequest);
  const normalizedFieldPurposes = normalizeDoc8FieldPurposes(fieldNames, request?.doc8_field_purposes);
  const filledPurposeCount = normalizedFieldPurposes.filter((item) => item.apply_purpose.trim()).length;
  const [generatingFieldPurposes, setGeneratingFieldPurposes] = useState(false);

  useEffect(() => {
    const current = normalizeOtherFields(getValues(`database_requests.${index}.data_fields_other`));

    if (selectedOtherFields) {
      if (current.length === 0) {
        setValue(`database_requests.${index}.data_fields_other`, [''], { shouldDirty: false });
      }
      return;
    }

    if (current.length > 0) {
      setValue(`database_requests.${index}.data_fields_other`, [], { shouldDirty: false });
    }
  }, [getValues, index, selectedOtherFields, setValue]);

  useEffect(() => {
    if (areFieldPurposesEqual(request?.doc8_field_purposes, normalizedFieldPurposes)) return;
    setValue(`database_requests.${index}.doc8_field_purposes`, normalizedFieldPurposes, { shouldDirty: false });
  }, [index, normalizedFieldPurposes, request?.doc8_field_purposes, setValue]);

  const handleGenerateFieldPurposes = async () => {
    if (!purpose.trim() || !methodology.trim() || fieldNames.length === 0) {
      message.error('請先填寫研究目的、研究方法，並至少指定一個中文欄位。');
      return;
    }

    setGeneratingFieldPurposes(true);
    try {
      const res = await generateDbApplyPurpose({
        purpose,
        methodology,
        apply_system_text: getApplySystemText(request || emptyDatabaseRequest),
        apply_condition: request?.apply_condition || '',
        field_names: fieldNames,
      });

      const generated = normalizeDoc8FieldPurposes(
        fieldNames,
        res.field_purposes.map((item) => ({
          field_name: item.field_name || '',
          apply_purpose: item.apply_purpose || '',
        })),
      );

      setValue(`database_requests.${index}.doc8_field_purposes`, generated, { shouldDirty: true, shouldValidate: true });
      message.success(`系統 ${index + 1} 的欄位申請目的已生成，可再手動修改。`);
    } catch (err) {
      message.error(`生成失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    } finally {
      setGeneratingFieldPurposes(false);
    }
  };

  return (
    <Card
      size="small"
      title={(
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span>{getRequestTitle(request, index)}</span>
          <Tag>{fieldNames.length} 欄位</Tag>
        </div>
      )}
      style={{ marginBottom: 12 }}
      extra={canRemove ? (
        <Popconfirm title="確定刪除此申請系統？" onConfirm={onRemove}>
          <Button type="text" danger>
            刪除
          </Button>
        </Popconfirm>
      ) : null}
    >
      <div style={sectionStackStyle}>
        <div style={twoColumnStyle}>
          <Controller
            name={`database_requests.${index}.apply_system`}
            control={control}
            rules={{ required: '請選擇申請系統' }}
            render={({ field, fieldState }) => (
              <Form.Item label="申請系統" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
                <Radio.Group
                  value={field.value}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    field.onChange(nextValue);
                    if (nextValue !== 'other') {
                      setValue(`database_requests.${index}.apply_system_other`, '', { shouldDirty: true });
                    }
                  }}
                >
                  <Radio value="warehouse">倉儲系統</Radio>
                  <Radio value="other">其他</Radio>
                </Radio.Group>
              </Form.Item>
            )}
          />

          <Controller
            name={`database_requests.${index}.apply_condition`}
            control={control}
            rules={{ required: '請填寫擷取資料條件' }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="擷取資料條件"
                tooltip="例：2018至2025年麻疹確定個案"
                required
                validateStatus={fieldState.error ? 'error' : ''}
                help={fieldState.error?.message}
              >
                <Input {...field} placeholder="例：2018至2025年麻疹確定個案" />
              </Form.Item>
            )}
          />
        </div>

        {applySystem === 'other' && (
          <Controller
            name={`database_requests.${index}.apply_system_other`}
            control={control}
            rules={{ required: '請輸入系統名稱' }}
            render={({ field, fieldState }) => (
              <Form.Item label="系統名稱" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message} style={{ marginBottom: 0 }}>
                <Input {...field} placeholder="例：結核病管理系統" />
              </Form.Item>
            )}
          />
        )}

        {applySystem === 'warehouse' && (
          <Controller
            name={`database_requests.${index}.data_fields`}
            control={control}
            rules={{ validate: (value) => (value && value.length > 0) || '請至少勾選一個中文欄位' }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="中文欄位"
                tooltip="DOC-8 目前仍以第一筆系統欄位展開；其餘系統會彙整進使用範圍與其他文件。"
                required
                validateStatus={fieldState.error ? 'error' : ''}
                help={fieldState.error?.message}
                style={{ marginBottom: 0 }}
              >
                <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 10, padding: 12 }}>
                  <Checkbox.Group
                    options={DATA_FIELD_OPTIONS}
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                    style={denseChoiceGridStyle}
                  />
                </div>
              </Form.Item>
            )}
          />
        )}

        {selectedOtherFields && (
          <Controller
            name={`database_requests.${index}.data_fields_other`}
            control={control}
            rules={{
              validate: (value) => normalizeOtherFields(value).some((item) => item.trim()) || `請至少填寫一個${applySystem === 'other' ? '中文欄位名稱' : '其他欄位名稱'}`,
            }}
            render={({ field, fieldState }) => {
              const values = normalizeOtherFields(field.value);

              return (
                <Form.Item
                  label={applySystem === 'other' ? '中文欄位名稱' : '其他欄位名稱'}
                  tooltip={applySystem === 'other' ? '其他系統請自行逐筆填寫欄位名稱。' : undefined}
                  required
                  validateStatus={fieldState.error ? 'error' : ''}
                  help={fieldState.error?.message}
                  style={{ marginBottom: 0 }}
                >
                  <EditableListFields
                    values={values}
                    onChange={field.onChange}
                    placeholderPrefix={applySystem === 'other' ? '中文欄位' : '其他欄位'}
                    addLabel={applySystem === 'other' ? '新增中文欄位' : '新增其他欄位'}
                  />
                </Form.Item>
              );
            }}
          />
        )}

        {fieldNames.length > 0 && (
          <Collapse
            size="small"
            items={[{
              key: 'doc8',
              label: (
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                  <span>欄位申請目的（點擊展開）</span>
                  <Text type="secondary">{filledPurposeCount}/{fieldNames.length} 已填</Text>
                </div>
              ),
              children: (
                <Controller
                  name={`database_requests.${index}.doc8_field_purposes`}
                  control={control}
                  render={({ field }) => {
                    const values = normalizeDoc8FieldPurposes(fieldNames, field.value);

                    return (
                      <Space direction="vertical" style={{ width: '100%' }} size={12}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <Text type="secondary">
                            僅在需要修正文案時展開；可先用 AI 生成後再微調。
                          </Text>
                          <Button
                            icon={<RobotOutlined />}
                            onClick={handleGenerateFieldPurposes}
                            loading={generatingFieldPurposes}
                          >
                            AI 生成
                          </Button>
                        </div>

                        {values.map((item, itemIndex) => (
                          <div
                            key={`${item.field_name}-${itemIndex}`}
                            style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 220px) 1fr', gap: 12, alignItems: 'start' }}
                          >
                            <div style={{ paddingTop: 6, fontWeight: 500 }}>{item.field_name}</div>
                            <Input.TextArea
                              value={item.apply_purpose}
                              rows={2}
                              placeholder={`請填寫「${item.field_name}」的申請目的`}
                              onChange={(event) => {
                                const next = values.map((value, valueIndex) => (
                                  valueIndex === itemIndex
                                    ? { ...value, apply_purpose: event.target.value }
                                    : value
                                ));
                                field.onChange(next);
                              }}
                            />
                          </div>
                        ))}

                        <Text type="secondary" style={{ fontSize: 12 }}>
                          將傳送研究目的、研究方法與本系統欄位資訊至 AI 服務生成欄位申請目的。機密研究請勿使用此功能。
                        </Text>
                      </Space>
                    );
                  }}
                />
              ),
            }]}
          />
        )}
      </div>
    </Card>
  );
}

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
