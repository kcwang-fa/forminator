// ===== 第 1 頁：基本資訊 =====

import { useEffect, useCallback, useRef } from 'react';
import { Form, Input, DatePicker, Collapse } from 'antd';
import { Controller } from 'react-hook-form';
import { useFormStore } from '../../hooks/useFormStore';
import { translateTitle } from '../../api/llm';
import dayjs from 'dayjs';

export default function Step1BasicInfo() {
  const { control, watch, setValue } = useFormStore();
  const titleZh = watch('project_title_zh');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // §4.2.5 計畫名稱英文翻譯 — blur 後 debounce 500ms
  const handleTitleTranslate = useCallback(async (value: string) => {
    if (!value || value.length < 4) return;
    try {
      const res = await translateTitle(value);
      setValue('project_title_en', res.project_title_en);
    } catch {
      // 翻譯失敗時靜默，使用者可手動填寫
    }
  }, [setValue]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (titleZh) handleTitleTranslate(titleZh);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [titleZh, handleTitleTranslate]);

  return (
    <div>
      <h3>基本資訊</h3>

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
          <Form.Item label="計畫名稱（英文）" tooltip="由 LLM 自動翻譯，可手動修改">
            <Input.TextArea {...field} rows={2} placeholder="自動翻譯中..." />
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

      <Collapse
        ghost
        items={[{
          key: 'advanced',
          label: '進階設定（MVP 預設值）',
          children: (
            <div style={{ opacity: 0.7 }}>
              <p>計畫類別：新增型一年期計畫</p>
              <p>採用問卷：否</p>
              <p>經費需求：不需經費</p>
              <p>實驗類型：無</p>
              <p style={{ color: '#999', fontSize: 12 }}>以上為「署內無經費資料庫回溯性研究」場景預設值，未來可擴充其他場景。</p>
            </div>
          ),
        }]}
      />
    </div>
  );
}
