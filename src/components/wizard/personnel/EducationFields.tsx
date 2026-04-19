import { Button, Card, Form, Input, Select } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import { useFormStore } from '../../../hooks/useFormStore';
import { emptyEducation } from '../../../data/defaults';

const DEGREE_OPTIONS = [
  { value: '博士', label: '博士' },
  { value: '碩士', label: '碩士' },
  { value: '學士', label: '學士' },
  { value: '其他', label: '其他' },
];

function EducationRow({ personIndex, rowIndex, onRemove }: { personIndex: number; rowIndex: number; onRemove: () => void }) {
  const { control } = useFormStore();
  const degreeVal = useWatch({ control, name: `personnel.${personIndex}.education.${rowIndex}.degree` });
  return (
    <Card
      size="small"
      style={{ marginBottom: 8, background: '#fafafa' }}
      extra={<Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={onRemove} />}
    >
      <div style={{ display: 'grid', gridTemplateColumns: degreeVal === '其他' ? '1fr 1fr 1fr 1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 8 }}>
        <Controller
          name={`personnel.${personIndex}.education.${rowIndex}.degree`}
          control={control}
          render={({ field: f }) => (
            <Form.Item label="學位" style={{ marginBottom: 0 }}>
              <Select {...f} options={DEGREE_OPTIONS} placeholder="請選擇" allowClear />
            </Form.Item>
          )}
        />
        {degreeVal === '其他' && (
          <Controller
            name={`personnel.${personIndex}.education.${rowIndex}.degree_other`}
            control={control}
            render={({ field: f }) => (
              <Form.Item label="學位（請填寫）" style={{ marginBottom: 0 }}>
                <Input {...f} placeholder="例：專科" />
              </Form.Item>
            )}
          />
        )}
        <Controller
          name={`personnel.${personIndex}.education.${rowIndex}.school`}
          control={control}
          render={({ field: f }) => (
            <Form.Item label="學校" style={{ marginBottom: 0 }}>
              <Input {...f} placeholder="例：國立臺灣大學" />
            </Form.Item>
          )}
        />
        <Controller
          name={`personnel.${personIndex}.education.${rowIndex}.department`}
          control={control}
          render={({ field: f }) => (
            <Form.Item label="系所" style={{ marginBottom: 0 }}>
              <Input {...f} placeholder="例：流行病學研究所" />
            </Form.Item>
          )}
        />
        <Controller
          name={`personnel.${personIndex}.education.${rowIndex}.grad_year`}
          control={control}
          render={({ field: f }) => (
            <Form.Item label="畢業年（民國）" style={{ marginBottom: 0 }}>
              <Input {...f} placeholder="例：100" />
            </Form.Item>
          )}
        />
      </div>
    </Card>
  );
}

export function EducationFields({ personIndex }: { personIndex: number }) {
  const { control } = useFormStore();
  const { fields, append, remove } = useFieldArray({ control, name: `personnel.${personIndex}.education` });

  return (
    <div>
      {fields.map((field, i) => (
        <EducationRow key={field.id} personIndex={personIndex} rowIndex={i} onRemove={() => remove(i)} />
      ))}
      <Button type="dashed" icon={<PlusOutlined />} size="small" onClick={() => append({ ...emptyEducation })} style={{ width: '100%' }}>
        新增學歷
      </Button>
    </div>
  );
}
