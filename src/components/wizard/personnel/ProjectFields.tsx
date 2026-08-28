import { AutoComplete, Button, Card, Form, Input } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Controller, useFieldArray } from 'react-hook-form';
import { Select } from 'antd';
import { useFormStore } from '../../../hooks/useFormStore';
import { emptyProject, isSelfProjectPi, PROJECT_ROLE_OPTIONS, qualifiesForAppendix2 } from '../../../data/defaults';

const PROJECT_STATUS_OPTIONS = [
  { value: 'completed', label: '近三年已完成' },
  { value: 'ongoing',   label: '執行中' },
  { value: 'pending',   label: '申請中' },
];

// 「擔任角色」下拉選項。
// 用 AutoComplete 而不是 Select：選項給的是常見的三種角色，但這欄的值會原樣印進附表一的
// 計畫清單，遇到「專任助理」這種選項外的角色時使用者要能自己打，也才不會弄壞舊草稿的自由文字。
const ROLE_AUTOCOMPLETE_OPTIONS = PROJECT_ROLE_OPTIONS.map(r => ({ value: r }));

export function ProjectFields({ personIndex }: { personIndex: number }) {
  const { control, watch } = useFormStore();
  const { fields, append, remove } = useFieldArray({ control, name: `personnel.${personIndex}.projects` });

  return (
    <div>
      {fields.map((field, i) => {
        const budget = watch(`personnel.${personIndex}.projects.${i}.budget`);
        const role   = watch(`personnel.${personIndex}.projects.${i}.role`);
        // 計畫主持人／協同主持人／研究人員（含舊草稿的「主持人」）且該計畫有經費 → 要填附表二摘要
        const showSummary = qualifiesForAppendix2(role, budget);

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
                    <AutoComplete
                      {...f}
                      options={ROLE_AUTOCOMPLETE_OPTIONS}
                      placeholder="請選擇或輸入"
                      allowClear
                    />
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
              <>
                {/* 這個計畫的主持人是誰。本人就是主持人時不用填，附表二會自動帶本人姓名；
                    本人只是協同主持人／研究人員時一定要填，否則附表二那一欄會留白。 */}
                <Controller
                  name={`personnel.${personIndex}.projects.${i}.pi_name`}
                  control={control}
                  render={({ field: f }) => (
                    <Form.Item
                      label="這個計畫的計畫主持人"
                      tooltip="會列進附表二。你自己就是這個計畫的主持人時可以留空"
                      style={{ marginBottom: 8 }}
                    >
                      <Input
                        {...f}
                        value={f.value ?? ''}
                        placeholder={isSelfProjectPi(role) ? '留空＝本人' : '例：王大明'}
                      />
                    </Form.Item>
                  )}
                />
                <Controller
                  name={`personnel.${personIndex}.projects.${i}.summary`}
                  control={control}
                  render={({ field: f }) => (
                    <Form.Item
                      label="計畫摘要"
                      tooltip="擔任計畫主持人、協同主持人或研究人員，且該計畫有經費時要填；會列進附表二"
                      style={{ marginBottom: 0 }}
                    >
                      <Input.TextArea {...f} value={f.value ?? ''} rows={2} />
                    </Form.Item>
                  )}
                />
              </>
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
