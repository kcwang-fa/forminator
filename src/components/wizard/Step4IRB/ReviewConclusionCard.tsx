// 審查結論卡片：顯示 Step 1 判斷器建議的審查類型，並允許手動覆寫。
//
// 設計重點：
//   - 判斷邏輯不在這裡，只呼叫 classifyReviewType 讀結果（規則全在 reviewClassifier.ts）。
//   - 手動改「審查類型」會把 review_type_source 標記成 'manual'，並在與判斷不一致時跳橘色警告，
//     提醒使用者確認是刻意覆寫還是 Step 1 條件還沒更新。

import { useMemo } from 'react';
import { Alert, Form, Select, Space, Tag } from 'antd';
import { Controller, useWatch } from 'react-hook-form';
import { useFormStore } from '../../../hooks/useFormStore';
import { classifyReviewType, REVIEW_TYPE_LABELS } from '../../../utils/reviewClassifier';

// 三種審查類型（與 ReviewType union 對齊）
const REVIEW_TYPE_OPTIONS = [
  { value: 'exempt', label: '免審' },
  { value: 'expedited', label: '簡易審查' },
  { value: 'full', label: '一般審查' },
];

export function ReviewConclusionCard() {
  const { control, watch, setValue } = useFormStore();
  const reviewType = watch('review_type');
  const reviewTypeSource = watch('review_type_source');
  const screening = useWatch({ control, name: 'review_screening' });
  // screening 變動時才重算，避免每次 render 都跑判斷器
  const decision = useMemo(() => classifyReviewType(screening), [screening]);

  // 判斷器有結論、且與目前套用的審查類型不同 → 視為需要使用者注意
  const isMismatch = !!decision.review_type && decision.review_type !== reviewType;

  return (
    <>
      <Alert
        type={isMismatch ? 'warning' : 'info'}
        showIcon
        style={{ marginBottom: 16 }}
        message={(
          <Space wrap>
            <span>Step 1 判斷結果</span>
            {decision.review_type ? (
              <Tag color={decision.review_type === 'exempt' ? 'green' : decision.review_type === 'expedited' ? 'blue' : 'volcano'}>
                {REVIEW_TYPE_LABELS[decision.review_type]}
              </Tag>
            ) : (
              <Tag color="default">尚未完成判斷</Tag>
            )}
            {reviewTypeSource === 'manual' && <Tag color="orange">目前為人工覆寫</Tag>}
          </Space>
        )}
        description={isMismatch
          ? '目前套用的審查類型與判斷器建議不同，請確認是否有人工覆寫或條件尚未更新。'
          : decision.reasons.join('；') || '可回到 Step 1 補齊審查類型判斷。'}
      />

      <Controller
        name="review_type"
        control={control}
        render={({ field }) => (
          <Form.Item label="審查類型">
            <Select
              {...field}
              options={REVIEW_TYPE_OPTIONS}
              onChange={(value) => {
                field.onChange(value);
                // 手動改值即視為人工覆寫，之後 Alert 會據此顯示「人工覆寫」標籤
                setValue('review_type_source', 'manual', { shouldDirty: true });
              }}
            />
          </Form.Item>
        )}
      />
    </>
  );
}
