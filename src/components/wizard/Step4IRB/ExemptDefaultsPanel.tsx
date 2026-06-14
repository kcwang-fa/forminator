// 免審預設選項面板：對應 IRB-012 表單「是否與研究對象有互動」。
//
// 設計理念（回應「免審不會有招募跟互動」）：
//   免審多為次級資料／資料庫回溯研究，互動幾乎都是「否」，所以預設否、收進可展開面板，
//   不逼使用者每次都手動點否；真的有互動時才展開切「是」並補說明。
//   招募主問已移至 RecruitmentFields，讓免審與簡審共用且保持在畫面上可見。
//   另外「利益衝突」在 docgen 已寫死為「無利益衝突／不適用」常數，這裡只做資訊性提示，不需輸入。

import { Alert, Collapse, Form, Input, Radio, Space, Typography } from 'antd';
import { Controller, useWatch } from 'react-hook-form';
import { useFormStore } from '../../../hooks/useFormStore';

const { Text } = Typography;

export function ExemptDefaultsPanel() {
  const { control } = useFormStore();
  const interactSubjects = useWatch({ control, name: 'interact_subjects' });

  // 有互動時自動展開面板，避免舊草稿的說明欄被收合藏住。
  const defaultActiveKey = interactSubjects ? ['defaults'] : [];

  return (
    <Collapse
      defaultActiveKey={defaultActiveKey}
      style={{ marginBottom: 16 }}
      items={[{
        key: 'defaults',
        label: (
          <Space>
            <Text strong>免審預設選項</Text>
            <Text type="secondary">互動：{interactSubjects ? '是' : '否'}</Text>
          </Space>
        ),
        children: (
          <Space orientation="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              title="免審（次級資料研究）通常不與研究對象互動，已預設為「否」；如有需要才改「是」並說明。"
            />

            {/* 是否與研究對象有互動 */}
            <Controller
              name="interact_subjects"
              control={control}
              render={({ field }) => (
                <Form.Item label="是否與研究對象有互動過程" style={{ marginBottom: 0 }}>
                  <Radio.Group
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                  >
                    <Radio value={false}>否</Radio>
                    <Radio value={true}>是</Radio>
                  </Radio.Group>
                </Form.Item>
              )}
            />
            {interactSubjects && (
              <Controller
                name="interact_detail"
                control={control}
                render={({ field }) => (
                  <Form.Item label="告知研究對象之資訊及取得同意之程序">
                    <Input.TextArea {...field} rows={3} placeholder="請說明將告知研究對象之資訊及取得同意之程序" />
                  </Form.Item>
                )}
              />
            )}

            {/* 利益衝突：docgen 已寫死常數，這裡只做資訊性顯示 */}
            <Text type="secondary">
              利益衝突聲明：本計畫主持人及所有研究人員聲明與本研究無利益衝突，減緩措施不適用（文件自動帶入）。
            </Text>
          </Space>
        ),
      }]}
    />
  );
}
