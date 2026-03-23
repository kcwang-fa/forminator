// ===== 第 4 頁：IRB 審查 =====

import { Form, Input, Select, Collapse } from 'antd';
import { Controller } from 'react-hook-form';
import { useFormStore } from '../../hooks/useFormStore';

const REVIEW_TYPE_OPTIONS = [
  { value: 'exempt', label: '免審' },
  { value: 'expedited', label: '簡易審查' },
  { value: 'full', label: '一般審查' },
];

const EXEMPT_CATEGORY_OPTIONS = [
  { value: 'public_non_interactive', label: '公共場所觀察且無互動' },
  { value: 'public_info', label: '使用已公開資訊' },
  { value: 'public_policy', label: '公共政策研究' },
  { value: 'education', label: '一般教育研究' },
  { value: 'minimal_risk', label: '最小風險研究' },
];

export default function Step4IRB() {
  const { control, watch } = useFormStore();
  const reviewType = watch('review_type');

  return (
    <div>
      <h3>IRB 審查資訊</h3>

      <Controller
        name="review_type"
        control={control}
        render={({ field }) => (
          <Form.Item label="審查類型">
            <Select {...field} options={REVIEW_TYPE_OPTIONS} />
          </Form.Item>
        )}
      />

      {reviewType === 'exempt' && (
        <>
          <Controller
            name="exempt_category"
            control={control}
            render={({ field }) => (
              <Form.Item label="免審類別">
                <Select {...field} options={EXEMPT_CATEGORY_OPTIONS} />
              </Form.Item>
            )}
          />

          <Controller
            name="exempt_reason"
            control={control}
            render={({ field }) => (
              <Form.Item label="免審理由" tooltip="MVP 預設文字，可修改">
                <Input.TextArea {...field} rows={2} />
              </Form.Item>
            )}
          />
        </>
      )}

      <Controller
        name="data_source"
        control={control}
        render={({ field }) => (
          <Form.Item label="研究方法及工具描述" tooltip="DOC-2 第 5 題，MVP 預設防疫資料庫申請流程">
            <Input.TextArea {...field} rows={4} />
          </Form.Item>
        )}
      />

      <h4 style={{ marginTop: 24 }}>隱私保護措施</h4>
      <p style={{ color: '#666', fontSize: 13 }}>以下為預設標準文字，可依需求微調。</p>

      <Controller
        name="privacy_during"
        control={control}
        render={({ field }) => (
          <Form.Item label="研究中隱私保護">
            <Input.TextArea {...field} rows={3} />
          </Form.Item>
        )}
      />

      <Controller
        name="privacy_after"
        control={control}
        render={({ field }) => (
          <Form.Item label="研究結束後隱私保護">
            <Input.TextArea {...field} rows={3} />
          </Form.Item>
        )}
      />

      <Controller
        name="privacy_withdrawal"
        control={control}
        render={({ field }) => (
          <Form.Item label="中途退出者隱私保護">
            <Input.TextArea {...field} rows={2} />
          </Form.Item>
        )}
      />

      <Collapse
        ghost
        items={[{
          key: 'preset',
          label: '進階設定（MVP 預設值）',
          children: (
            <div style={{ opacity: 0.7 }}>
              <p>是否招募研究對象：否</p>
              <p>是否與研究對象有互動：否</p>
              <p>利益衝突 5 項：全部否</p>
              <p>利益衝突減緩措施：不適用</p>
            </div>
          ),
        }]}
      />
    </div>
  );
}
