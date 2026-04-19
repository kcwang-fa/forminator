import { Button, Card, Form, Input } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Controller, useFieldArray } from 'react-hook-form';
import { Select } from 'antd';
import { useFormStore } from '../../../hooks/useFormStore';
import { emptyProject } from '../../../data/defaults';

const PROJECT_STATUS_OPTIONS = [
  { value: 'completed', label: '近三年已完成' },
  { value: 'ongoing',   label: '執行中' },
  { value: 'pending',   label: '申請中' },
];

export function ProjectFields({ personIndex }: { personIndex: number }) {
  const { control, watch } = useFormStore();
  const { fields, append, remove } = useFieldArray({ control, name: `personnel.${personIndex}.projects` });

  return (
    <div>
      {fields.map((field, i) => {
        const budget = watch(`personnel.${personIndex}.projects.${i}.budget`);
        const role   = watch(`personnel.${personIndex}.projects.${i}.role`);
        const showSummary = role === '主持人' && !!budget;

        return (
          <Card
            key={field.id}
            size="small"
            style={{ marginBottom: 8, background: '#fafafa' }}
            extra={<Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => remove(i)} />}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <Controller
                name={`personnel.${personIndex}.projects.${i}.status`}
                control={control}
                render={({ field: f }) => (
                  <Form.Item label="狀態" style={{ marginBottom: 8 }}>
                    <Select {...f} options={PROJECT_STATUS_OPTIONS} />
                  </Form.Item>
                )}
              />
              <Controller
                name={`personnel.${personIndex}.projects.${i}.role`}
                control={control}
                render={({ field: f }) => (
                  <Form.Item label="擔任角色" style={{ marginBottom: 8 }}>
                    <Input {...f} placeholder="例：主持人" />
                  </Form.Item>
                )}
              />
              <Controller
                name={`personnel.${personIndex}.projects.${i}.funder`}
                control={control}
                render={({ field: f }) => (
                  <Form.Item label="補助機關" style={{ marginBottom: 8 }}>
                    <Input {...f} placeholder="例：衛生福利部疾病管制署" />
                  </Form.Item>
                )}
              />
            </div>
            <Controller
              name={`personnel.${personIndex}.projects.${i}.project_name`}
              control={control}
              render={({ field: f }) => (
                <Form.Item label="計畫名稱" style={{ marginBottom: 8 }}>
                  <Input {...f} />
                </Form.Item>
              )}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <Controller
                name={`personnel.${personIndex}.projects.${i}.budget`}
                control={control}
                render={({ field: f }) => (
                  <Form.Item label="經費（元）" style={{ marginBottom: 8 }}>
                    <Input {...f} placeholder="無經費請留空" />
                  </Form.Item>
                )}
              />
              <Controller
                name={`personnel.${personIndex}.projects.${i}.start_ym`}
                control={control}
                render={({ field: f }) => (
                  <Form.Item label="起（年/月）" style={{ marginBottom: 8 }}>
                    <Input {...f} placeholder="例：113/01" />
                  </Form.Item>
                )}
              />
              <Controller
                name={`personnel.${personIndex}.projects.${i}.end_ym`}
                control={control}
                render={({ field: f }) => (
                  <Form.Item label="迄（年/月）" style={{ marginBottom: 8 }}>
                    <Input {...f} placeholder="例：114/12" />
                  </Form.Item>
                )}
              />
            </div>
            {showSummary && (
              <Controller
                name={`personnel.${personIndex}.projects.${i}.summary`}
                control={control}
                render={({ field: f }) => (
                  <Form.Item label="計畫摘要" tooltip="附表二：主持人且有經費時必填" style={{ marginBottom: 0 }}>
                    <Input.TextArea {...f} rows={2} />
                  </Form.Item>
                )}
              />
            )}
          </Card>
        );
      })}
      <Button type="dashed" icon={<PlusOutlined />} size="small" onClick={() => append({ ...emptyProject })}>
        新增計畫
      </Button>
    </div>
  );
}
