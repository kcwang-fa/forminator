// ===== 第 2 頁：研究團隊 =====

import { Button, Card, Form, Input, Select, Space, Popconfirm, Collapse, Divider, InputNumber, Tooltip, message } from 'antd';
import { PlusOutlined, DeleteOutlined, ExportOutlined, ImportOutlined, CopyOutlined } from '@ant-design/icons';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import { useFormStore } from '../../hooks/useFormStore';
import { usePersonnelProfile } from '../../hooks/usePersonnelProfile';
import { emptyPersonnel, emptyEducation, emptyWorkHistory, emptyProject } from '../../data/defaults';
import type { PersonnelRole } from '../../types/form';

const ROLE_OPTIONS: { value: PersonnelRole; label: string }[] = [
  { value: 'pi', label: '計畫主持人' },
  { value: 'co_pi', label: '協同主持人' },
  { value: 'researcher', label: '研究人員' },
  { value: 'contact', label: '聯絡人' },
  { value: 'assistant', label: '研究助理' },
];

// 成員卡標題（useWatch 讓姓名和角色即時反映）
function PersonnelCardTitle({ index }: { index: number }) {
  const { control } = useFormStore();
  const role = useWatch({ control, name: `personnel.${index}.role` });
  const name = useWatch({ control, name: `personnel.${index}.name_zh` });
  const roleLabel = ROLE_OPTIONS.find(o => o.value === role)?.label || `成員 ${index + 1}`;
  return <>{name ? `${roleLabel}　${name}` : roleLabel}</>;
}

const DEGREE_OPTIONS = [
  { value: '博士', label: '博士' },
  { value: '碩士', label: '碩士' },
  { value: '學士', label: '學士' },
  { value: '其他', label: '其他' },
];

const PROJECT_STATUS_OPTIONS = [
  { value: 'completed', label: '近三年已完成' },
  { value: 'ongoing',   label: '執行中' },
  { value: 'pending',   label: '申請中' },
];

// ===== 學歷子元件 =====
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

function EducationFields({ personIndex }: { personIndex: number }) {
  const { control } = useFormStore();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `personnel.${personIndex}.education`,
  });

  return (
    <div>
      {fields.map((field, i) => (
        <EducationRow key={field.id} personIndex={personIndex} rowIndex={i} onRemove={() => remove(i)} />
      ))}
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        size="small"
        onClick={() => append({ ...emptyEducation })}
        style={{ width: '100%' }}
      >
        新增學歷
      </Button>
    </div>
  );
}

// ===== 服務經歷子元件 =====
function WorkHistoryFields({ personIndex }: { personIndex: number }) {
  const { control } = useFormStore();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `personnel.${personIndex}.work_history`,
  });

  return (
    <div>
      {fields.map((field, i) => (
        <Card
          key={field.id}
          size="small"
          style={{ marginBottom: 8, background: '#fafafa' }}
          extra={
            <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => remove(i)} />
          }
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
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        size="small"
        onClick={() => append({ ...emptyWorkHistory })}
      >
        新增服務經歷
      </Button>
    </div>
  );
}

// ===== 計畫子元件 =====
function ProjectFields({ personIndex }: { personIndex: number }) {
  const { control, watch } = useFormStore();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `personnel.${personIndex}.projects`,
  });

  return (
    <div>
      {fields.map((field, i) => {
        const budget = watch(`personnel.${personIndex}.projects.${i}.budget`);
        const role = watch(`personnel.${personIndex}.projects.${i}.role`);
        const showSummary = role === '主持人' && !!budget;

        return (
          <Card
            key={field.id}
            size="small"
            style={{ marginBottom: 8, background: '#fafafa' }}
            extra={
              <Button type="text" danger icon={<DeleteOutlined />} size="small" onClick={() => remove(i)} />
            }
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
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        size="small"
        onClick={() => append({ ...emptyProject })}
      >
        新增計畫
      </Button>
    </div>
  );
}

// ===== 著作子元件 =====
function PublicationFields({ personIndex }: { personIndex: number }) {
  const { control } = useFormStore();
  return (
    <div>
      <Controller
        name={`personnel.${personIndex}.publications`}
        control={control}
        render={({ field: f }) => (
          <Input.TextArea
            {...f}
            value={Array.isArray(f.value) ? '' : (f.value ?? '')}
            rows={5}
            placeholder={'逐筆填寫，每筆著作一行，例：\nChiou C-S, Hong Y-P, Liao Y-S, et al. New multidrug-resistant Salmonella enterica serovar Anatum clone, Taiwan, 2015–2017. Emerg Infect Dis. 2019;25(1).'}
          />
        )}
      />
      <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
        若無相關著作，請填「無」（附表三將顯示此內容）
      </div>
    </div>
  );
}

// ===== 主元件 =====
export default function Step2Personnel() {
  const { control, getValues, setValue } = useFormStore();
  const { fields, append, remove } = useFieldArray({ control, name: 'personnel' });
  const { handleExportProfile, triggerImport, RoleSelectModal } = usePersonnelProfile();

  return (
    <div>
      {RoleSelectModal}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>研究團隊</h3>
          <p style={{ color: '#666', margin: '4px 0 0' }}>至少需要一位計畫主持人（PI），未填聯絡人時，系統預設以計畫主持人為聯絡人。</p>
        </div>
        <Tooltip title="匯入人員 Profile JSON，可選擇匯入為主持人、協同主持人或研究人員">
          <Button icon={<ImportOutlined />} onClick={triggerImport}>匯入人員 Profile</Button>
        </Tooltip>
      </div>

      {fields.map((field, index) => (
        <Card
          key={field.id}
          size="small"
          title={<PersonnelCardTitle index={index} />}
          style={{ marginBottom: 12 }}
          extra={
            <Space size={4}>
              {fields[index] && getValues(`personnel.${index}.role`) === 'contact' && (
                <Tooltip title="自動填入計畫主持人的基本資料">
                  <Button
                    type="text"
                    icon={<CopyOutlined />}
                    size="small"
                    onClick={() => {
                      const pi = getValues('personnel').find(p => p.role === 'pi');
                      if (!pi) { message.warning('尚未設定計畫主持人'); return; }
                      const { role: _role, work_history, projects, publications, ...piData } = pi;
                      const current = getValues(`personnel.${index}`);
                      setValue(`personnel.${index}`, { ...current, ...piData }, { shouldDirty: true });
                      message.success('已複製計畫主持人資料');
                    }}
                  >
                    同計畫主持人
                  </Button>
                </Tooltip>
              )}
              <Button
                type="text"
                icon={<ExportOutlined />}
                size="small"
                onClick={() => handleExportProfile(getValues(`personnel.${index}`))}
              >
                匯出 Profile
              </Button>
              {fields.length > 1 && (
                <Popconfirm title="確定刪除此成員？" onConfirm={() => remove(index)}>
                  <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                </Popconfirm>
              )}
            </Space>
          }
        >
          {/* ===== 基本資料 ===== */}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Controller
              name={`personnel.${index}.fax`}
              control={control}
              render={({ field: f }) => (
                <Form.Item label="傳真">
                  <Input {...f} />
                </Form.Item>
              )}
            />
            <Controller
              name={`personnel.${index}.address`}
              control={control}
              render={({ field: f }) => (
                <Form.Item label="連絡地址" tooltip="署內研究計畫書使用">
                  <Input {...f} />
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

          {/* ===== 專長與研究倫理訓練 ===== */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginTop: 8 }}>
            <Controller
              name={`personnel.${index}.expertise`}
              control={control}
              render={({ field: f }) => (
                <Form.Item label="專長領域" style={{ marginBottom: 8 }}>
                  <Input {...f} placeholder="例：傳染病流行病學、統計分析" />
                </Form.Item>
              )}
            />
            <Controller
              name={`personnel.${index}.irb_training_hours`}
              control={control}
              render={({ field: f }) => (
                <Form.Item
                  label="研究倫理訓練時數"
                  tooltip="主持人需六年內≥9小時；研究人員需三年內≥4小時"
                  style={{ marginBottom: 8 }}
                >
                  <InputNumber
                    {...f}
                    min={0}
                    step={1}
                    precision={0}
                    addonAfter="小時"
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              )}
            />
          </div>

          {/* ===== 附表一、二、三資料（折疊）===== */}
          <Collapse
            ghost
            style={{ marginTop: 8 }}
            items={[{
              key: 'appendix',
              label: '學經歷資料（附表一、二、三）',
              children: (
                <div>
                  {/* 學歷 */}
                  <Divider plain style={{ fontSize: 13 }}>學歷（附表一）</Divider>
                  <EducationFields personIndex={index} />

                  {/* 服務經歷 */}
                  <Divider plain style={{ fontSize: 13 }}>服務經歷（附表一）</Divider>
                  <WorkHistoryFields personIndex={index} />

                  {/* 計畫 */}
                  <Divider plain style={{ fontSize: 13 }}>研究計畫（附表一、二）</Divider>
                  <p style={{ color: '#888', fontSize: 12, margin: '0 0 8px' }}>
                    角色填「主持人」且有填經費時，系統會顯示附表二摘要欄位。
                  </p>
                  <ProjectFields personIndex={index} />

                  {/* 著作 */}
                  <Divider plain style={{ fontSize: 13 }}>近三年著作清單（附表三）</Divider>
                  <PublicationFields personIndex={index} />
                </div>
              ),
            }]}
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
      </Space>
    </div>
  );
}
