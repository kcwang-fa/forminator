// ===== 第 1 頁：基本資訊 =====

import { useCallback, useEffect, useState } from 'react';
import { Form, Input, DatePicker, Button, Select, Space, Tag, Checkbox, Alert, App } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { Controller } from 'react-hook-form';
import { useFormStore } from '../../hooks/useFormStore';
import { translateTitle } from '../../api/llm';
import { PLAN_CONFIGS, getPlanConfig, OUTPUT_CATEGORIES, OUTPUT_CATEGORY_CONFIGS } from '../../data/planConfigs';
import type { ReviewType } from '../../types/form';
import ReviewTypeScreening from './ReviewTypeScreening';
import dayjs from 'dayjs';
import { calcProjectYears } from '../../utils/date';

const REVIEW_TYPE_OPTIONS = (Object.values(PLAN_CONFIGS) as typeof PLAN_CONFIGS[ReviewType][]).map((cfg) => ({
  value: cfg.id,
  label: cfg.label,
  description: cfg.description,
  ready: cfg.ready,
}));

const REVIEW_TYPE_SOURCE_LABELS = {
  default: { label: '系統預設', color: 'default' },
  screening: { label: '由判斷器套用', color: 'processing' },
  manual: { label: '人工覆寫', color: 'orange' },
} as const;

const PROJECT_TYPE_OPTIONS = [
  { value: 'new_1yr', label: '新增型一年期計畫' },
  { value: 'new_multi', label: '新增型多年期計畫' },
  { value: 'continuing_multi', label: '延續型多年期計畫' },
];

export default function Step1BasicInfo() {
  const { control, watch, setValue } = useFormStore();
  const { message } = App.useApp();
  const titleZh = watch('project_title_zh');
  const outputCategories = watch('output_categories') ?? [];
  const irbSelected = outputCategories.includes('irb');
  const reviewType = watch('review_type');
  const reviewTypeSource = watch('review_type_source');
  const projectType = watch('project_type');
  const executionStart = watch('execution_start');
  const executionEnd = watch('execution_end');
  const fullExecutionStart = watch('full_execution_start');
  const fullExecutionEnd = watch('full_execution_end');
  const projectYears = watch('project_years');
  const planConfig = getPlanConfig(reviewType);
  const [translating, setTranslating] = useState(false);
  const reviewTypeSourceLabel = REVIEW_TYPE_SOURCE_LABELS[reviewTypeSource] || REVIEW_TYPE_SOURCE_LABELS.default;
  const isMultiYear = projectType !== 'new_1yr';

  useEffect(() => {
    if (!isMultiYear) {
      if (fullExecutionStart !== executionStart) {
        setValue('full_execution_start', executionStart || '');
      }
      if (fullExecutionEnd !== executionEnd) {
        setValue('full_execution_end', executionEnd || '');
      }
      if (projectYears !== '1') {
        setValue('project_years', '1');
      }
      return;
    }

    if (!fullExecutionStart && executionStart) {
      setValue('full_execution_start', executionStart);
    }
    if (!fullExecutionEnd && executionEnd) {
      setValue('full_execution_end', executionEnd);
    }

    const years = calcProjectYears(fullExecutionStart || executionStart, fullExecutionEnd || executionEnd);
    if (years > 0 && projectYears !== String(years)) {
      setValue('project_years', String(years));
    }
  }, [
    executionEnd,
    executionStart,
    fullExecutionEnd,
    fullExecutionStart,
    isMultiYear,
    projectYears,
    setValue,
  ]);

  const handleTitleTranslate = useCallback(async () => {
    if (!titleZh || titleZh.length < 4) return;
    setTranslating(true);
    try {
      const res = await translateTitle(titleZh);
      setValue('project_title_en', res.project_title_en);
    } catch (err) {
      message.error(`英文翻譯失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    } finally {
      setTranslating(false);
    }
  }, [titleZh, setValue, message]);

  return (
    <div>
      <h3>基本資訊</h3>

      {/* 成果類別（整個流程的入口）：先選這次要產出哪幾類成果，後續步驟與文件會跟著收斂。
          可複選；預設三項全勾。審查類型只跟 IRB 這包有關，故只在勾了 IRB 時才顯示。 */}
      <Controller
        name="output_categories"
        control={control}
        render={({ field }) => (
          <Form.Item
            label="要產出哪些成果"
            tooltip="可複選。決定後續要填的步驟與最後產出的文件"
            required
          >
            <Checkbox.Group
              value={field.value}
              onChange={(vals) => field.onChange(vals)}
            >
              <Space direction="vertical" size={4}>
                {OUTPUT_CATEGORIES.map((key) => (
                  <Checkbox key={key} value={key}>
                    {OUTPUT_CATEGORY_CONFIGS[key].label}
                    <span style={{ fontSize: 12, color: '#888', marginLeft: 8 }}>
                      {OUTPUT_CATEGORY_CONFIGS[key].description}
                    </span>
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
            {outputCategories.length === 0 && (
              <Alert
                type="warning"
                showIcon
                message="請至少選擇一項成果類別，才能決定後續步驟與文件。"
                style={{ marginTop: 8 }}
              />
            )}
          </Form.Item>
        )}
      />

      {/* 審查類型（IRB 那一包的設定入口）：先讓使用者直接選——知道要選哪種的人一步到位。
          不確定的人再用下方「審查類型小幫手」逐項勾選由系統建議。
          只在勾了「IRB 審查」時才顯示，因為審查類型只決定 IRB 文件。 */}
      {irbSelected && (
        <>
          <Controller
            name="review_type"
            control={control}
            render={({ field }) => (
              <Form.Item
                label="審查類型"
                tooltip="決定 IRB 送審流程與所需的 IRB 文件"
              >
                <Select
                  {...field}
                  onChange={(value) => {
                    field.onChange(value);
                    setValue('review_type_source', 'manual', { shouldDirty: true });
                  }}
                  options={REVIEW_TYPE_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: (
                      <Space>
                        {opt.label}
                        {opt.ready
                          ? <Tag color="blue" style={{ marginLeft: 4 }}>支援</Tag>
                          : <Tag color="default" style={{ marginLeft: 4 }}>模板準備中</Tag>}
                      </Space>
                    ),
                  }))}
                  style={{ width: 320 }}
                />
                <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                  {planConfig.description}
                  <Tag color={reviewTypeSourceLabel.color} style={{ marginLeft: 8 }}>
                    {reviewTypeSourceLabel.label}
                  </Tag>
                  {!planConfig.ready && (
                    <Tag color="warning" style={{ marginLeft: 4 }}>文件模板尚未完整支援</Tag>
                  )}
                </div>
              </Form.Item>
            )}
          />

          {/* 審查類型小幫手：不確定要選哪種審查時，逐項勾選由系統建議（預設收合，不干擾） */}
          <ReviewTypeScreening />
        </>
      )}

      <Controller
        name="project_title_zh"
        control={control}
        rules={{ required: '請輸入計畫名稱（中文）' }}
        render={({ field, fieldState }) => (
          <Form.Item
            label="計畫名稱（中文）"
            required
            validateStatus={fieldState.error ? 'error' : ''}
            help={fieldState.error?.message}
          >
            <Input.TextArea {...field} rows={2} placeholder="例：分析 2018-2020 年北台灣流感群聚事件以評估流感疫苗效益" />
          </Form.Item>
        )}
      />

      <Controller
        name="project_title_en"
        control={control}
        render={({ field }) => (
          <Form.Item label="計畫名稱（英文）" tooltip="點擊生成按鈕由 AI 翻譯，可手動修改">
            <Space.Compact style={{ width: '100%' }}>
              <Input.TextArea {...field} rows={2} placeholder="點擊右側按鈕生成，或手動填寫" style={{ flex: 1 }} />
              <Button
                icon={<RobotOutlined />}
                onClick={handleTitleTranslate}
                loading={translating}
                disabled={!titleZh || titleZh.length < 4}
                style={{ height: 'auto' }}
              >
                生成
              </Button>
            </Space.Compact>
          </Form.Item>
        )}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Controller
          name="project_year"
          control={control}
          rules={{ required: '請輸入年度' }}
          render={({ field, fieldState }) => (
            <Form.Item label="年度（民國）" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
              <Input {...field} placeholder="例：115" />
            </Form.Item>
          )}
        />

        <Controller
          name="project_type"
          control={control}
          rules={{ required: '請選擇計畫類別' }}
          render={({ field, fieldState }) => (
            <Form.Item label="計畫類別" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
              <Select
                {...field}
                options={PROJECT_TYPE_OPTIONS}
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Controller
          name="responsible_unit"
          control={control}
          rules={{ required: '請輸入負責單位' }}
          render={({ field, fieldState }) => (
            <Form.Item label="負責單位" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
              <Input {...field} placeholder="例：北區管制中心" />
            </Form.Item>
          )}
        />

        {isMultiYear && (
          <Controller
            name="project_years"
            control={control}
            rules={{
              required: '請輸入多年期計畫年數',
              validate: (value) => {
                const years = Number(value);
                return Number.isFinite(years) && years >= 2 ? true : '多年期計畫年數至少為 2';
              },
            }}
            render={({ field, fieldState }) => (
              <Form.Item label="全程年數" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
                <Input {...field} suffix="年" placeholder="例：3" />
              </Form.Item>
            )}
          />
        )}
      </div>

      {isMultiYear && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Controller
            name="full_execution_start"
            control={control}
            rules={{
              validate: (value) => value || '請選擇全程計畫起始日',
            }}
            render={({ field, fieldState }) => (
              <Form.Item label="全程計畫起始日" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
                <DatePicker
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d?.format('YYYY-MM-DD') || '')}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            )}
          />

          <Controller
            name="full_execution_end"
            control={control}
            rules={{
              validate: (value) => value || '請選擇全程計畫截止日',
            }}
            render={({ field, fieldState }) => (
              <Form.Item label="全程計畫截止日" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
                <DatePicker
                  value={field.value ? dayjs(field.value) : null}
                  onChange={(d) => field.onChange(d?.format('YYYY-MM-DD') || '')}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            )}
          />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Controller
          name="execution_start"
          control={control}
          rules={{ required: '請選擇執行起始日' }}
          render={({ field, fieldState }) => (
            <Form.Item label={isMultiYear ? '本年度執行起始日' : '執行起始日'} required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
              <DatePicker
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => field.onChange(d?.format('YYYY-MM-DD') || '')}
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}
        />

        <Controller
          name="execution_end"
          control={control}
          rules={{ required: '請選擇執行截止日' }}
          render={({ field, fieldState }) => (
            <Form.Item label={isMultiYear ? '本年度執行截止日' : '執行截止日'} required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
              <DatePicker
                value={field.value ? dayjs(field.value) : null}
                onChange={(d) => field.onChange(d?.format('YYYY-MM-DD') || '')}
                style={{ width: '100%' }}
              />
            </Form.Item>
          )}
        />
      </div>

      <Controller
        name="filing_date"
        control={control}
        rules={{ required: '請選擇填報日期' }}
        render={({ field, fieldState }) => (
          <Form.Item label="填報日期" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
            <DatePicker
              value={field.value ? dayjs(field.value) : null}
              onChange={(d) => field.onChange(d?.format('YYYY-MM-DD') || '')}
              style={{ width: '100%' }}
            />
          </Form.Item>
        )}
      />
    </div>
  );
}
