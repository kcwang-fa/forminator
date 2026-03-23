// ===== 第 5 頁：資料庫申請 =====

import { Form, Input, DatePicker, Collapse, Tag } from 'antd';
import { Controller } from 'react-hook-form';
import { useFormStore } from '../../hooks/useFormStore';
import { addYears } from '../../utils/date';
import dayjs from 'dayjs';
export default function Step5Database() {
  const { control, setValue } = useFormStore();

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
                  // 自動計算保留期限 +3 年
                  if (dateStr) {
                    setValue('retention_deadline', addYears(dateStr, 3));
                  }
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
        <h4 style={{ margin: 0, marginBottom: 8 }}>申請使用之防疫資料庫</h4>
        <Tag color="blue">此區段將在生成文件後留空白表格，請於列印後手動填寫</Tag>
      </div>

      <Collapse
        ghost
        items={[{
          key: 'preset',
          label: '進階設定（MVP 預設值）',
          children: (
            <div style={{ opacity: 0.7 }}>
              <p>研究目的及用途：無需經費研究計畫</p>
              <p>資料交付方式：數位檔案</p>
              <p>資料使用地點：本署署內辦公場域 + 個人公務電腦</p>
              <p>研究成果處理類型：論文寫作 1 件</p>
              <p>計畫主持人：同申請人員</p>
              <p>資科中心勾稽：否</p>
            </div>
          ),
        }]}
      />
    </div>
  );
}
