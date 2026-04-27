// 單一申請系統卡片：申請系統 / 條件 / 中文欄位 / 欄位申請目的（AI 可生成）。
// 與外層 Step5Database 之間僅透過 React Hook Form 的 path（database_requests.${index}.*）
// 對接，不靠 props 傳資料。新增系統由外層 useFieldArray.append 處理。

import { useEffect, useState } from 'react';
import { App, Button, Card, Checkbox, Collapse, Form, Input, Popconfirm, Radio, Space, Tag, Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { Controller, useWatch } from 'react-hook-form';
import { useFormStore } from '../../../hooks/useFormStore';
import { emptyDatabaseRequest } from '../../../data/defaults';
import {
  areFieldPurposesEqual,
  getApplySystemText,
  getDataFieldNames,
  normalizeDoc8FieldPurposes,
  normalizeOtherFields,
} from '../../../utils/databaseScope';
import type { DataFieldKey, DatabaseRequest } from '../../../types/form';
import { generateDbApplyPurpose } from '../../../api/llm';
import { EditableListFields } from './EditableListFields';
import { denseChoiceGridStyle, sectionStackStyle, twoColumnStyle } from './styles';

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

function getRequestTitle(request: DatabaseRequest | undefined, index: number) {
  const systemName = request?.apply_system === 'warehouse'
    ? '倉儲系統'
    : request?.apply_system_other || '其他系統';
  const condition = request?.apply_condition?.trim();
  return condition ? `系統 ${index + 1}｜${systemName}｜${condition}` : `系統 ${index + 1}｜${systemName}`;
}

interface DatabaseRequestCardProps {
  index: number;
  canRemove: boolean;
  onRemove: () => void;
}

export function DatabaseRequestCard({ index, canRemove, onRemove }: DatabaseRequestCardProps) {
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
