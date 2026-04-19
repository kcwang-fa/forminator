// ===== Step 5：經費概算 =====

import { useMemo, useEffect } from 'react';
import { useFormStore } from '../../hooks/useFormStore';
import { BUDGET_PRESETS, defaultBudgetItems } from '../../data/defaults';
import { calcMgmt, calcTotal, isMgmtActive, CAPITAL_IDS, PERSONNEL_IDS, BUSINESS_IDS } from '../../utils/budgetCalc';
import type { BudgetItem } from '../../types/form';
import { Switch, Input, Table, Button, Tooltip, Typography, Checkbox } from 'antd';
import { QuestionCircleOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

type ColumnRecord = BudgetItem | { id: string; name: string; _section: true };

function makeColumns(
  updateItem: (id: string, field: 'amount' | 'note', val: string) => void,
  updateName: (id: string, name: string) => void,
  removeItem: (id: string) => void,
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
            <Input
              value={name}
              placeholder="項目名稱"
              onChange={e => updateName(r.id, e.target.value)}
              size="small"
            />
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



export default function Step5Budget() {
  const { watch, setValue } = useFormStore();
  const needs_funding: boolean = watch('needs_funding') ?? false;
  const apply_amount: string = watch('apply_amount') ?? '';
  const budget_items: BudgetItem[] = watch('budget_items') ?? defaultBudgetItems;

  // 補全舊草稿缺少的 preset 項目（新增預設項目後不需手動清草稿）
  useEffect(() => {
    const existingIds = new Set(budget_items.map(i => i.id));
    const missing = BUDGET_PRESETS.filter(p => !p.auto && !existingIds.has(p.id));
    if (missing.length === 0) return;

    // 把缺少的項目插入到 mgmt 之前，保持 preset 順序
    const mgmtIndex = budget_items.findIndex(i => i.id === 'mgmt');
    const insertAt = mgmtIndex >= 0 ? mgmtIndex : budget_items.length;
    const newItems: BudgetItem[] = missing.map(p => ({
      id: p.id, name: p.name, category: p.category, is_custom: false, amount: '', note: '',
    }));
    const merged = [
      ...budget_items.slice(0, insertAt),
      ...newItems,
      ...budget_items.slice(insertAt),
    ];
    setValue('budget_items', merged, { shouldDirty: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateItem(id: string, field: 'amount' | 'note', value: string) {
    setValue('budget_items', budget_items.map(i => i.id === id ? { ...i, [field]: value } : i), { shouldDirty: true });
  }
  function updateName(id: string, name: string) {
    setValue('budget_items', budget_items.map(i => i.id === id ? { ...i, name } : i), { shouldDirty: true });
  }
  function removeItem(id: string) {
    setValue('budget_items', budget_items.filter(i => i.id !== id), { shouldDirty: true });
  }
  function addCustomItem(category: '業務費' | '資本門' | '人事費') {
    // 插入到同類別的最後一項之後（mgmt 之前）
    const mgmtIndex = budget_items.findIndex(i => i.id === 'mgmt');
    const newItem = { id: `custom_${Date.now()}`, name: '', is_custom: true, category, amount: '', note: '' };
    const insertAt = mgmtIndex >= 0 ? mgmtIndex : budget_items.length;
    const updated = [...budget_items.slice(0, insertAt), newItem, ...budget_items.slice(insertAt)];
    setValue('budget_items', updated, { shouldDirty: true });
  }
  function toggleMgmt(checked: boolean) {
    setValue('budget_items', budget_items.map(i =>
      i.id === 'mgmt' ? { ...i, active: checked } : i
    ), { shouldDirty: true });
  }

  const mgmtAmount  = calcMgmt(budget_items);
  const mgmtActive  = isMgmtActive(budget_items);
  const totalAmount = calcTotal(budget_items);

  const personnelItems = budget_items.filter(i => PERSONNEL_IDS.includes(i.id) || (i.is_custom && i.category === '人事費'));
  const businessItems  = budget_items.filter(i => BUSINESS_IDS.includes(i.id) || (i.is_custom && i.category === '業務費'));
  const capitalItems   = budget_items.filter(i => CAPITAL_IDS.includes(i.id) || (i.is_custom && i.category === '資本門'));

  const columns = useMemo(
    () => makeColumns(updateItem, updateName, removeItem),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [budget_items],
  );

  const sectionTableProps = {
    rowKey: 'id' as const,
    pagination: false as const,
    size: 'small' as const,
    columns,
    style: { marginBottom: 4 },
  };

  return (
    <div>
      <h3>經費概算</h3>

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
          {/* 申請金額 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <Text style={{ whiteSpace: 'nowrap' }}>申請金額</Text>
            <Input
              value={apply_amount}
              placeholder="0"
              onChange={e => setValue('apply_amount', e.target.value.replace(/[^\d]/g, ''), { shouldDirty: true })}
              suffix="元"
              style={{ width: 200 }}
            />
          </div>

          {/* 業務費（經常門） */}
          <Text strong style={{ display: 'block', background: '#fafafa', padding: '6px 8px', border: '1px solid #f0f0f0' }}>業務費（經常門）</Text>
          <Table dataSource={businessItems} {...sectionTableProps} />
          <Button size="small" icon={<PlusOutlined />} onClick={() => addCustomItem('業務費')} style={{ marginBottom: 16 }}>新增項目</Button>

          {/* 設備費（資本門） */}
          <Text strong style={{ display: 'block', background: '#fafafa', padding: '6px 8px', border: '1px solid #f0f0f0', marginTop: 8 }}>設備費（資本門）</Text>
          <Table dataSource={capitalItems} {...sectionTableProps} showHeader={false} />
          <Button size="small" icon={<PlusOutlined />} onClick={() => addCustomItem('資本門')} style={{ marginBottom: 16 }}>新增項目</Button>

          {/* 人事費（經常門） */}
          <Text strong style={{ display: 'block', background: '#fafafa', padding: '6px 8px', border: '1px solid #f0f0f0', marginTop: 8 }}>人事費（經常門）</Text>
          <Table dataSource={personnelItems} {...sectionTableProps} showHeader={false} />
          <Button size="small" icon={<PlusOutlined />} onClick={() => addCustomItem('人事費')} style={{ marginBottom: 16 }}>新增項目</Button>

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

          <p style={{ color: '#999', fontSize: 12, marginTop: 12 }}>
            ・人事費上限：總經費 50%<br />
            ・管理費 = (人事費 + 業務費 - 主持人費 - 協同主持人費) × 15%（資本門不計入）<br />
            ・資本門：儀器設備購置，須另行核准
          </p>
        </>
      )}
    </div>
  );
}
