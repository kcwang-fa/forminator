// ===== 第 1 頁：基本資訊 =====

import { useCallback, useState } from 'react';
import { Form, Input, DatePicker, Button, Select, Space, Tag, App } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { Controller } from 'react-hook-form';
import { useFormStore } from '../../hooks/useFormStore';
import { translateTitle } from '../../api/llm';
import { PLAN_CONFIGS, getPlanConfig } from '../../data/planConfigs';
import type { ReviewType } from '../../types/form';
import dayjs from 'dayjs';

const REVIEW_TYPE_OPTIONS = (Object.values(PLAN_CONFIGS) as typeof PLAN_CONFIGS[ReviewType][]).map((cfg) => ({
  value: cfg.id,
  label: cfg.label,
  description: cfg.description,
  disabled: !cfg.ready,
}));

export default function Step1BasicInfo() {
  const { control, watch, setValue } = useFormStore();
  const { message } = App.useApp();
  const titleZh = watch('project_title_zh');
  const reviewType = watch('review_type');
  const planConfig = getPlanConfig(reviewType);
  const [translating, setTranslating] = useState(false);

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

      {/* 審查類型（計畫類型配置的入口） */}
      <Controller
        name="review_type"
        control={control}
        render={({ field }) => (
          <Form.Item
            label="審查類型"
            tooltip="決定申請流程、所需文件與表單步驟"
          >
            <Select
              {...field}
              options={REVIEW_TYPE_OPTIONS.map((opt) => ({
                value: opt.value,
                label: (
                  <Space>
                    {opt.label}
                    {!opt.disabled
                      ? <Tag color="blue" style={{ marginLeft: 4 }}>支援</Tag>
                      : <Tag color="default" style={{ marginLeft: 4 }}>模板準備中</Tag>}
                  </Space>
                ),
                disabled: opt.disabled,
              }))}
              style={{ width: 320 }}
            />
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {planConfig.description}
            </div>
          </Form.Item>
        )}
      />

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
          name="responsible_unit"
          control={control}
          rules={{ required: '請輸入負責單位' }}
          render={({ field, fieldState }) => (
            <Form.Item label="負責單位" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
              <Input {...field} placeholder="例：北區管制中心" />
            </Form.Item>
          )}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Controller
          name="execution_start"
          control={control}
          rules={{ required: '請選擇執行起始日' }}
          render={({ field, fieldState }) => (
            <Form.Item label="執行起始日" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
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
            <Form.Item label="執行截止日" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
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
