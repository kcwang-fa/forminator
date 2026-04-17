// ===== Step 5：經費概算 =====

import { useMemo } from 'react';
import { useFormStore } from '../../hooks/useFormStore';
import { BUDGET_PRESETS, defaultBudgetItems } from '../../data/defaults';
import { calcMgmt, calcTotal, isMgmtActive } from '../../utils/budgetCalc';
import type { BudgetItem } from '../../types/form';
import { Switch, Input, Table, Button, Tooltip, Typography, Checkbox, Select } from 'antd';
import { QuestionCircleOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

type ColumnRecord = BudgetItem | { id: string; name: string; _section: true };

function makeColumns(
  updateItem: (id: string, field: 'amount' | 'note', val: string) => void,
  updateName: (id: string, name: string) => void,
  removeItem: (id: string) => void,
  updateCategory: (id: string, category: string) => void,
) {
  return [
    {
      title: '項目名稱',
      dataIndex: 'name',
      width: 200,
      render: (name: string, record: ColumnRecord) => {
        if ('_section' in record) {
          return <Text strong style={{ color: '#555' }}>{name}</Text>;
        }
        const r = record as BudgetItem;
        const preset = BUDGET_PRESETS.find(p => p.id === r.id);
        if (r.is_custom) {
          return (
            <div style={{ display: 'flex', gap: 4 }}>
              <Select
                value={r.category || '業務費'}
                onChange={val => updateCategory(r.id, val)}
                size="small"
                style={{ width: 90 }}
                options={[
                  { value: '人事費', label: '人事費' },
                  { value: '業務費', label: '業務費' },
                ]}
              />
              <Input
                value={name}
                placeholder="項目名稱"
                onChange={e => updateName(r.id, e.target.value)}
                size="small"
              />
            </div>
          );
        }
        return (
          <span>
            {name}
            {preset?.tooltip && (
              <Tooltip title={preset.tooltip}>
                <QuestionCircleOutlined style={{ marginLeft: 6, color: '#999', cursor: 'help' }} />
              </Tooltip>
            )}
          </span>
        );
      },
    },
    {
      title: '金額（元）',
      dataIndex: 'amount',
      width: 150,
      render: (_: unknown, record: ColumnRecord) => {
        if ('_section' in record) return null;
        const r = record as BudgetItem;
        return (
          <Input
            value={r.amount}
            placeholder="0"
            onChange={e => updateItem(r.id, 'amount', e.target.value.replace(/[^\d]/g, ''))}
            suffix="元"
            size="small"
          />
        );
      },
    },
    {
      title: '說明',
      dataIndex: 'note',
      render: (_: unknown, record: ColumnRecord) => {
        if ('_section' in record) return null;
        const r = record as BudgetItem;
        return (
          <Input
            value={r.note}
            placeholder="估算方法及用途"
            onChange={e => updateItem(r.id, 'note', e.target.value)}
            size="small"
          />
        );
      },
    },
    {
      title: '',
      width: 40,
      render: (_: unknown, record: ColumnRecord) => {
        if ('_section' in record) return null;
        const r = record as BudgetItem;
        return r.is_custom ? (
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => removeItem(r.id)}
          />
        ) : null;
      },
    },
  ];
}

const PERSONNEL_IDS = ['pi_fee', 'co_pi_fee', 'ra_fee', 'insurance', 'pension'];
const BUSINESS_IDS  = ['irb_fee', 'travel', 'meal', 'misc'];

export default function Step5Budget() {
  const { watch, setValue } = useFormStore();
  const needs_funding: boolean = watch('needs_funding') ?? false;
  const budget_items: BudgetItem[] = watch('budget_items') ?? defaultBudgetItems;

  function updateItem(id: string, field: 'amount' | 'note', value: string) {
    setValue('budget_items', budget_items.map(i => i.id === id ? { ...i, [field]: value } : i), { shouldDirty: true });
  }
  function updateName(id: string, name: string) {
    setValue('budget_items', budget_items.map(i => i.id === id ? { ...i, name } : i), { shouldDirty: true });
  }
  function updateCategory(id: string, category: string) {
    setValue('budget_items', budget_items.map(i => i.id === id ? { ...i, category } : i), { shouldDirty: true });
  }
  function removeItem(id: string) {
    setValue('budget_items', budget_items.filter(i => i.id !== id), { shouldDirty: true });
  }
  function addCustomItem() {
    setValue('budget_items', [
      ...budget_items,
      { id: `custom_${Date.now()}`, name: '', is_custom: true, category: '業務費', amount: '', note: '' },
    ], { shouldDirty: true });
  }
  function toggleMgmt(checked: boolean) {
    setValue('budget_items', budget_items.map(i =>
      i.id === 'mgmt' ? { ...i, active: checked } : i
    ), { shouldDirty: true });
  }

  const mgmtAmount  = calcMgmt(budget_items);
  const mgmtActive  = isMgmtActive(budget_items);
  const totalAmount = calcTotal(budget_items);

  const personnelItems = budget_items.filter(i => PERSONNEL_IDS.includes(i.id));
  const businessItems  = budget_items.filter(i => BUSINESS_IDS.includes(i.id) || i.is_custom);

  const tableData: ColumnRecord[] = [
    { id: '_h_personnel', name: '人事費', _section: true },
    ...personnelItems,
    { id: '_h_business', name: '業務費', _section: true },
    ...businessItems,
  ];

  const columns = useMemo(
    () => makeColumns(updateItem, updateName, removeItem, updateCategory),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [budget_items],
  );

  return (
    <div>
      <h3>陸、經費概算</h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Switch
          checked={needs_funding}
          onChange={val => {
            setValue('needs_funding', val, { shouldDirty: true });
            if (val && (!budget_items || budget_items.length === 0)) {
              setValue('budget_items', defaultBudgetItems, { shouldDirty: true });
            }
          }}
        />
        <Text>本計畫需要編列經費</Text>
      </div>

      {needs_funding && (
        <>
          <Table
            dataSource={tableData}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ marginBottom: 8 }}
            columns={columns}
            rowClassName={record => '_section' in record ? 'budget-section-header' : ''}
          />

          {/* 管理費（可選，自動計算） */}
          <Table
            dataSource={[{ id: 'mgmt', name: '管理費', amount: String(mgmtAmount), note: '(人事費+業務費-主持人費-協同主持人費) × 15%' }]}
            rowKey="id"
            pagination={false}
            size="small"
            showHeader={false}
            style={{ marginBottom: 8, opacity: mgmtActive ? 1 : 0.4 }}
            columns={[
              {
                dataIndex: 'name', width: 200,
                render: (name: string) => (
                  <span>
                    <Checkbox
                      checked={mgmtActive}
                      onChange={e => toggleMgmt(e.target.checked)}
                      style={{ marginRight: 8 }}
                    />
                    {name}
                    <Tooltip title="自動計算：(人事費 + 業務費 - 主持人費 - 協同主持人費) × 15%">
                      <QuestionCircleOutlined style={{ marginLeft: 6, color: '#999', cursor: 'help' }} />
                    </Tooltip>
                  </span>
                ),
              },
              {
                dataIndex: 'amount', width: 150,
                render: (val: string) => <Input value={mgmtActive ? Number(val).toLocaleString() : '—'} suffix={mgmtActive ? '元' : ''} size="small" disabled />,
              },
              { dataIndex: 'note', render: (note: string) => <Text type="secondary" style={{ fontSize: 12 }}>{mgmtActive ? note : '不納入計算'}</Text> },
              { width: 40, render: () => null },
            ]}
          />

          {/* 合計 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 40px 8px 0', borderTop: '1px solid #f0f0f0' }}>
            <Text strong>合計：</Text>
            <Text strong style={{ color: '#1677ff' }}>{totalAmount.toLocaleString()} 元</Text>
          </div>

          <Button icon={<PlusOutlined />} onClick={addCustomItem} style={{ marginTop: 12 }}>
            新增其他業務費項目
          </Button>

          <p style={{ color: '#999', fontSize: 12, marginTop: 12 }}>
            ・人事費上限：總經費 50%<br />
            ・雜支費上限：業務費總額 5%，且不超過 10 萬元<br />
            ・管理費 = (人事費 + 業務費 - 主持人費 - 協同主持人費) × 15%<br />
            ・不得購置儀器設備（無資本門），需要時以租金方式編列
          </p>
        </>
      )}
    </div>
  );
}
