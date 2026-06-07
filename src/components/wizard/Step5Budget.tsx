// ===== Step 5：經費概算 =====
//
// 多年期計畫：每個經費項目可「逐年」填寫金額（year_amounts[k]），最右顯示全程小計。
//   - item.amount 是衍生欄位（= year_amounts 加總），代表全程總額，供陸、經費需求表與合計用。
//   - 一年期（years===1）只顯示單一金額欄，UI 與改版前相同。
//   - 第 2 年起的欄頭提供「帶入前一年」按鈕，一鍵把上一年所有項目金額複製到本年。
//   - 管理費逐年自動計算（calcMgmtYear），不可手動填。

import { useEffect } from 'react';
import { useFormStore } from '../../hooks/useFormStore';
import { BUDGET_PRESETS, defaultBudgetItems } from '../../data/defaults';
import {
  calcMgmt, calcMgmtYear, calcTotalYear, isMgmtActive,
  getYearAmounts, sumYearAmounts,
  CAPITAL_IDS, PERSONNEL_IDS, BUSINESS_IDS,
} from '../../utils/budgetCalc';
import { getRocDateParts } from '../../utils/date';
import type { BudgetItem } from '../../types/form';
import { Switch, Input, Table, Button, Tooltip, Typography, Checkbox } from 'antd';
import { QuestionCircleOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

type ColumnRecord = BudgetItem | { id: string; name: string; _section: true };

// 產生「項目名稱」欄
function nameColumn(
  updateName: (id: string, name: string) => void,
) {
  return {
    title: '項目名稱',
    dataIndex: 'name',
    width: 180,
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
  };
}

// 產生每年一欄的金額欄（可編輯）；多年期才顯示年度標題與「帶入前一年」按鈕
function amountColumns(
  years: number,
  rocYears: string[],
  isMulti: boolean,
  updateYearAmount: (id: string, k: number, val: string) => void,
  fillFromPrevYear: (k: number) => void,
) {
  return Array.from({ length: years }, (_, k) => ({
    title: isMulti ? (
      <div style={{ lineHeight: 1.3 }}>
        <div>{rocYears[k] ? `${rocYears[k]}年度` : `第${k + 1}年`}</div>
        {k >= 1 && (
          <Button type="link" size="small" style={{ padding: 0, height: 'auto', fontSize: 12 }} onClick={() => fillFromPrevYear(k)}>
            帶入前一年
          </Button>
        )}
      </div>
    ) : '金額（元）',
    width: isMulti ? 130 : 150,
    render: (_: unknown, record: ColumnRecord) => {
      if ('_section' in record) return null;
      const r = record as BudgetItem;
      const ya = getYearAmounts(r, years);
      return (
        <Input
          value={ya[k]}
          placeholder="0"
          onChange={e => updateYearAmount(r.id, k, e.target.value.replace(/[^\d]/g, ''))}
          suffix="元"
          size="small"
        />
      );
    },
  }));
}

// 全程小計欄（只在多年期顯示）
function subtotalColumn() {
  return {
    title: '全程小計',
    width: 120,
    render: (_: unknown, record: ColumnRecord) => {
      if ('_section' in record) return null;
      const r = record as BudgetItem;
      return <Text strong>{(Number(r.amount) || 0).toLocaleString()} 元</Text>;
    },
  };
}

// 說明欄 + 刪除欄
function noteAndDeleteColumns(
  updateNote: (id: string, val: string) => void,
  removeItem: (id: string) => void,
) {
  return [
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
            onChange={e => updateNote(r.id, e.target.value)}
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
          <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeItem(r.id)} />
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

  // 年數與每年的民國年標題：多年期由全程起始日逐年推算，一年期用 project_year
  const years = Math.max(1, Number(watch('project_years')) || 1);
  const isMulti = years > 1;
  const fullStart: string = watch('full_execution_start') || watch('execution_start') || '';
  const projectYear: string = watch('project_year') || '';
  const baseRoc = Number(getRocDateParts(fullStart).y);
  const rocYears = Array.from({ length: years }, (_, k) =>
    isMulti ? (Number.isFinite(baseRoc) ? String(baseRoc + k) : '') : projectYear);

  // 補全舊草稿缺少的 preset 項目（新增預設項目後不需手動清草稿）
  useEffect(() => {
    const existingIds = new Set(budget_items.map(i => i.id));
    const missing = BUDGET_PRESETS.filter(p => !p.auto && !existingIds.has(p.id));
    if (missing.length === 0) return;

    // 把缺少的項目插入到 mgmt 之前，保持 preset 順序
    const mgmtIndex = budget_items.findIndex(i => i.id === 'mgmt');
    const insertAt = mgmtIndex >= 0 ? mgmtIndex : budget_items.length;
    const newItems: BudgetItem[] = missing.map(p => ({
      id: p.id, name: p.name, category: p.category, is_custom: false,
      year_amounts: Array.from({ length: years }, () => ''), amount: '', note: '',
    }));
    const merged = [
      ...budget_items.slice(0, insertAt),
      ...newItems,
      ...budget_items.slice(insertAt),
    ];
    setValue('budget_items', merged, { shouldDirty: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 更新某項目第 k 年金額，並同步重算衍生的全程總額 amount
  function updateYearAmount(id: string, k: number, value: string) {
    setValue('budget_items', budget_items.map(i => {
      if (i.id !== id) return i;
      const ya = getYearAmounts(i, years);
      ya[k] = value;
      return { ...i, year_amounts: ya, amount: sumYearAmounts(ya) };
    }), { shouldDirty: true });
  }
  // 把第 k-1 年所有項目金額複製到第 k 年（管理費自動算、不複製）
  function fillFromPrevYear(k: number) {
    if (k < 1) return;
    setValue('budget_items', budget_items.map(i => {
      if (i.id === 'mgmt') return i;
      const ya = getYearAmounts(i, years);
      ya[k] = ya[k - 1];
      return { ...i, year_amounts: ya, amount: sumYearAmounts(ya) };
    }), { shouldDirty: true });
  }
  function updateNote(id: string, value: string) {
    setValue('budget_items', budget_items.map(i => i.id === id ? { ...i, note: value } : i), { shouldDirty: true });
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
    const newItem: BudgetItem = {
      id: `custom_${Date.now()}`, name: '', is_custom: true, category,
      year_amounts: Array.from({ length: years }, () => ''), amount: '', note: '',
    };
    const insertAt = mgmtIndex >= 0 ? mgmtIndex : budget_items.length;
    const updated = [...budget_items.slice(0, insertAt), newItem, ...budget_items.slice(insertAt)];
    setValue('budget_items', updated, { shouldDirty: true });
  }
  function toggleMgmt(checked: boolean) {
    setValue('budget_items', budget_items.map(i =>
      i.id === 'mgmt' ? { ...i, active: checked } : i
    ), { shouldDirty: true });
  }

  const mgmtActive = isMgmtActive(budget_items);
  // 全程合計 = 各年計算總額加總（與 docgen grandTotal 一致；一年期等同 calcTotal）
  const grandTotal = Array.from({ length: years }, (_, k) => calcTotalYear(budget_items, k, years)).reduce((a, b) => a + b, 0);

  const personnelItems = budget_items.filter(i => PERSONNEL_IDS.includes(i.id) || (i.is_custom && i.category === '人事費'));
  const businessItems  = budget_items.filter(i => BUSINESS_IDS.includes(i.id) || (i.is_custom && i.category === '業務費'));
  const capitalItems   = budget_items.filter(i => CAPITAL_IDS.includes(i.id) || (i.is_custom && i.category === '資本門'));

  // 各區段共用欄位：項目 | 逐年金額 | (全程小計) | 說明 | 刪除
  // 每次 render 重建即可（表單規模小），確保 callback 永遠抓到最新 budget_items
  const columns = [
    nameColumn(updateName),
    ...amountColumns(years, rocYears, isMulti, updateYearAmount, fillFromPrevYear),
    ...(isMulti ? [subtotalColumn()] : []),
    ...noteAndDeleteColumns(updateNote, removeItem),
  ];

  // 管理費列：逐年自動計算（disabled），最右為全程小計
  const mgmtColumns = [
    {
      dataIndex: 'name', width: 180,
      render: (name: string) => (
        <span>
          <Checkbox checked={mgmtActive} onChange={e => toggleMgmt(e.target.checked)} style={{ marginRight: 8 }} />
          {name}
          <Tooltip title="自動計算：(人事費 + 業務費 - 主持人費 - 協同主持人費) × 15%">
            <QuestionCircleOutlined style={{ marginLeft: 6, color: '#999', cursor: 'help' }} />
          </Tooltip>
        </span>
      ),
    },
    ...Array.from({ length: years }, (_, k) => ({
      width: isMulti ? 130 : 150,
      render: () => (
        <Input
          value={mgmtActive ? calcMgmtYear(budget_items, k, years).toLocaleString() : '—'}
          suffix={mgmtActive ? '元' : ''}
          size="small"
          disabled
        />
      ),
    })),
    ...(isMulti ? [{
      width: 120,
      render: () => <Text strong>{mgmtActive ? calcMgmt(budget_items).toLocaleString() : '—'} 元</Text>,
    }] : []),
    { dataIndex: 'note', render: () => <Text type="secondary" style={{ fontSize: 12 }}>{mgmtActive ? '自動計算' : '不納入計算'}</Text> },
    { width: 40, render: () => null },
  ];

  // 合計列：每年欄顯示「該年合計」（calcTotalYear），多年期最右「全程小計」欄才放全程加總
  const totalColumns = [
    { width: 180, render: () => <Text strong>合計</Text> },
    ...Array.from({ length: years }, (_, k) => ({
      width: isMulti ? 130 : 150,
      render: () => <Text strong style={{ color: '#1677ff' }}>{calcTotalYear(budget_items, k, years).toLocaleString()} 元</Text>,
    })),
    ...(isMulti ? [{
      width: 120,
      render: () => <Text strong style={{ color: '#1677ff' }}>{grandTotal.toLocaleString()} 元</Text>,
    }] : []),
    { dataIndex: 'note', render: () => null },
    { width: 40, render: () => null },
  ];

  const sectionTableProps = {
    rowKey: 'id' as const,
    pagination: false as const,
    size: 'small' as const,
    columns,
    style: { marginBottom: 4 },
    scroll: isMulti ? { x: 'max-content' as const } : undefined,
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
          {isMulti && (
            <p style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
              本計畫為 {years} 年期，請逐年填寫各項目金額。下方「合計」列為<strong>各年度合計</strong>（非全部加總）；
              最右「全程小計」欄與括號內「全程總額」才是跨年度加總。第 2 年起可用欄頭「帶入前一年」一鍵沿用上一年金額再微調。
            </p>
          )}

          {/* 申請金額：多年期改由各年計算總額自動帶，不需單一輸入 */}
          {!isMulti && (
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
          )}

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
            dataSource={[{ id: 'mgmt', name: '管理費' }]}
            rowKey="id"
            pagination={false}
            size="small"
            showHeader={false}
            style={{ marginBottom: 8, opacity: mgmtActive ? 1 : 0.4 }}
            scroll={isMulti ? { x: 'max-content' } : undefined}
            columns={mgmtColumns}
          />

          {/* 合計列：每年欄各顯示「該年合計」，最右「全程小計」欄才放全程加總 */}
          <Table
            dataSource={[{ id: 'total' }]}
            rowKey="id"
            pagination={false}
            size="small"
            showHeader={false}
            scroll={isMulti ? { x: 'max-content' } : undefined}
            style={{ marginTop: 4, borderTop: '2px solid #1677ff' }}
            columns={totalColumns}
          />
          {isMulti && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '4px 40px 0 0', fontSize: 12, color: '#999' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>（全程總額 {grandTotal.toLocaleString()} 元）</Text>
            </div>
          )}

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
