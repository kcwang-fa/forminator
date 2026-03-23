// ===== 第 2 頁：研究團隊 =====

import { Button, Card, Form, Input, Select, Space, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Controller, useFieldArray } from 'react-hook-form';
import { useFormStore } from '../../hooks/useFormStore';
import { emptyPersonnel } from '../../data/defaults';
import type { PersonnelRole } from '../../types/form';

const ROLE_OPTIONS: { value: PersonnelRole; label: string }[] = [
  { value: 'pi', label: '計畫主持人' },
  { value: 'co_pi', label: '協同主持人' },
  { value: 'researcher', label: '研究人員' },
  { value: 'contact', label: '聯絡人' },
  { value: 'assistant', label: '研究助理' },
];

export default function Step2Personnel() {
  const { control } = useFormStore();
  const { fields, append, remove } = useFieldArray({ control, name: 'personnel' });

  return (
    <div>
      <h3>研究團隊</h3>
      <p style={{ color: '#666', marginBottom: 16 }}>至少需要一位計畫主持人（PI）和一位聯絡人。</p>

      {fields.map((field, index) => (
        <Card
          key={field.id}
          size="small"
          title={`成員 ${index + 1}`}
          style={{ marginBottom: 12 }}
          extra={
            fields.length > 1 && (
              <Popconfirm title="確定刪除此成員？" onConfirm={() => remove(index)}>
                <Button type="text" danger icon={<DeleteOutlined />} size="small" />
              </Popconfirm>
            )
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Controller
              name={`personnel.${index}.role`}
              control={control}
              render={({ field: f }) => (
                <Form.Item label="角色" required>
                  <Select {...f} options={ROLE_OPTIONS} />
                </Form.Item>
              )}
            />
            <Controller
              name={`personnel.${index}.name_zh`}
              control={control}
              rules={{ required: '請輸入姓名' }}
              render={({ field: f, fieldState }) => (
                <Form.Item label="中文姓名" required validateStatus={fieldState.error ? 'error' : ''}>
                  <Input {...f} />
                </Form.Item>
              )}
            />
            <Controller
              name={`personnel.${index}.name_en`}
              control={control}
              render={({ field: f }) => (
                <Form.Item label="英文姓名" tooltip="主持人必填">
                  <Input {...f} />
                </Form.Item>
              )}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Controller
              name={`personnel.${index}.title`}
              control={control}
              rules={{ required: '請輸入職稱' }}
              render={({ field: f, fieldState }) => (
                <Form.Item label="職稱" required validateStatus={fieldState.error ? 'error' : ''}>
                  <Input {...f} placeholder="例：醫師" />
                </Form.Item>
              )}
            />
            <Controller
              name={`personnel.${index}.unit`}
              control={control}
              rules={{ required: '請輸入服務單位' }}
              render={({ field: f, fieldState }) => (
                <Form.Item label="服務單位" required validateStatus={fieldState.error ? 'error' : ''}>
                  <Input {...f} />
                </Form.Item>
              )}
            />
            <Controller
              name={`personnel.${index}.email`}
              control={control}
              rules={{ required: '請輸入 Email', pattern: { value: /^[^\s@]+@[^\s@]+$/, message: '格式不正確' } }}
              render={({ field: f, fieldState }) => (
                <Form.Item label="電子信箱" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
                  <Input {...f} />
                </Form.Item>
              )}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Controller
              name={`personnel.${index}.phone`}
              control={control}
              rules={{ required: '請輸入電話' }}
              render={({ field: f, fieldState }) => (
                <Form.Item label="聯絡電話" required validateStatus={fieldState.error ? 'error' : ''}>
                  <Input {...f} />
                </Form.Item>
              )}
            />
            <Controller
              name={`personnel.${index}.official_phone`}
              control={control}
              render={({ field: f }) => (
                <Form.Item label="公務電話" tooltip="資料庫申請單使用">
                  <Input {...f} />
                </Form.Item>
              )}
            />
            <Controller
              name={`personnel.${index}.id_number`}
              control={control}
              render={({ field: f }) => (
                <Form.Item label="身分證字號" tooltip="保密切結書使用，僅顯示後 4 碼">
                  <Input.Password {...f} placeholder="僅保密切結書需要" />
                </Form.Item>
              )}
            />
          </div>

          <Controller
            name={`personnel.${index}.work_description`}
            control={control}
            render={({ field: f }) => (
              <Form.Item label="在本計畫內擔任之具體工作">
                <Input.TextArea {...f} rows={1} placeholder="例：統計分析、文獻整理" />
              </Form.Item>
            )}
          />
        </Card>
      ))}

      <Space>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => append({ ...emptyPersonnel, role: 'researcher' })}
        >
          新增研究人員
        </Button>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => append({ ...emptyPersonnel, role: 'contact' })}
        >
          新增聯絡人
        </Button>
      </Space>
    </div>
  );
}
