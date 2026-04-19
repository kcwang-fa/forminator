import { Button, Card, Form, Input } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Controller, useFieldArray } from 'react-hook-form';
import { useFormStore } from '../../../hooks/useFormStore';
import { emptyWorkHistory } from '../../../data/defaults';

export function WorkHistoryFields({ personIndex }: { personIndex: number }) {
  const { control } = useFormStore();
  const { fields, append, remove } = useFieldArray({ control, name: `personnel.${personIndex}.work_history` });

  return (
    <div>
      {fields.map((field, i) => (
        <Card
          key={field.id}
          size="small"
          style={{ marginBottom: 8, background: '#fafafa' }}
          extra={<Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => remove(i)} />}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 8 }}>
            <Controller
              name={`personnel.${personIndex}.work_history.${i}.institution`}
              control={control}
              render={({ field: f }) => (
                <Form.Item label="服務機關及單位" style={{ marginBottom: 0 }}>
                  <Input {...f} placeholder="例：衛生福利部疾病管制署疫情中心" />
                </Form.Item>
              )}
            />
            <Controller
              name={`personnel.${personIndex}.work_history.${i}.title`}
              control={control}
              render={({ field: f }) => (
                <Form.Item label="職稱" style={{ marginBottom: 0 }}>
                  <Input {...f} placeholder="例：科長" />
                </Form.Item>
              )}
            />
            <Controller
              name={`personnel.${personIndex}.work_history.${i}.start_ym`}
              control={control}
              render={({ field: f }) => (
                <Form.Item label="起（年/月）" style={{ marginBottom: 0 }}>
                  <Input {...f} placeholder="例：110/07" />
                </Form.Item>
              )}
            />
            <Controller
              name={`personnel.${personIndex}.work_history.${i}.end_ym`}
              control={control}
              render={({ field: f }) => (
                <Form.Item label="訖（年/月）" style={{ marginBottom: 0 }}>
                  <Input {...f} placeholder="例：114/04 或迄今" />
                </Form.Item>
              )}
            />
          </div>
        </Card>
      ))}
      <Button type="dashed" icon={<PlusOutlined />} size="small" onClick={() => append({ ...emptyWorkHistory })}>
        新增服務經歷
      </Button>
    </div>
  );
}
