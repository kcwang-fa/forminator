// ===== 第 3 頁：研究內容 =====

import { useState, type ReactNode } from 'react';
import { Form, Input, Button, Spin, Tag, message, Table, Space, Popconfirm, Tabs, Modal } from 'antd';
import { RobotOutlined, PlusOutlined, DeleteOutlined, ProfileOutlined } from '@ant-design/icons';
import { Controller } from 'react-hook-form';
import { useFormStore } from '../../hooks/useFormStore';
import { generateAbstract } from '../../api/llm';
import { getGanttMonthLabels, generateDefaultGanttRows, ganttYearStartDate } from '../../utils/gantt';
import { buildYearlySkeleton, type YearlySection } from '../../utils/yearlySkeleton';
import type { GanttItem, GanttYear } from '../../types/form';

export default function Step3Research() {
  const { control, watch, setValue, getValues } = useFormStore();
  const [generating, setGenerating] = useState(false);

  const purpose = watch('purpose');
  const background = watch('background');
  const methodology = watch('methodology');
  const expectedOutcome = watch('expected_outcome');
  const ganttChart = watch('gantt_chart');
  const projectType = watch('project_type');
  const executionStart = watch('execution_start');
  const fullExecutionStart = watch('full_execution_start');

  const canGenerate = purpose && background && methodology && expectedOutcome;
  const ganttStart = projectType === 'new_1yr'
    ? executionStart
    : fullExecutionStart || executionStart;
  // 是否多年期：多年期才在頁籤標年度（第N年/民國年度）；一年期只有單一年度、不顯示頁籤。
  const isMultiYear = ganttChart.length > 1;

  // 從執行起始日推得計畫起始的民國年；無法解析時回 null（頁籤只顯示「第N年」）。
  const ganttRocBase = (() => {
    const date = new Date(ganttStart);
    return Number.isNaN(date.getTime()) ? null : date.getFullYear() - 1911;
  })();

  // 第 yearIndex 年的月份標籤起始日期（民國年/月）：
  // 多年期按年度（曆年）對齊——第 0 年從計畫起始月，第 1 年起一律從該年度 1 月開始。
  const yearStartDate = (yearIndex: number): string =>
    ganttYearStartDate(ganttStart, yearIndex, isMultiYear);

  // 頁籤標題：多年期顯示「第N年（114 年度）」，無法推年度時退回「第N年」。
  const yearTabLabel = (yearIndex: number): string => {
    const ordinal = `第${yearIndex + 1}年`;
    return ganttRocBase == null ? ordinal : `${ordinal}（${ganttRocBase + yearIndex} 年度）`;
  };

  // 只改某一年的甘特資料，其餘年度維持不變（寫回整個 gantt_chart）。
  const updateYear = (yearIndex: number, updater: (year: GanttYear) => GanttYear) => {
    const next = ganttChart.map((year: GanttYear, i: number) =>
      i === yearIndex ? updater(year) : year
    );
    setValue('gantt_chart', next);
  };

  // 修改某一年某一列的工作項目名稱
  const handleTaskNameChange = (yearIndex: number, rowKey: number, value: string) => {
    updateYear(yearIndex, year => ({
      rows: year.rows.map((row, ri) => ri === rowKey ? { ...row, task_name: value } : row),
    }));
  };

  // 切換某一年某一列某個月份的啟用/停用
  const handleToggleMonth = (yearIndex: number, rowKey: number, monthIndex: number) => {
    updateYear(yearIndex, year => ({
      rows: year.rows.map((row, ri) =>
        ri === rowKey
          ? { ...row, months: row.months.map((v, mi) => mi === monthIndex ? !v : v) }
          : row
      ),
    }));
  };

  // 在某一年新增一列空白工作項目（月數沿用該年）
  const handleAddGanttRow = (yearIndex: number) => {
    updateYear(yearIndex, year => {
      const monthCount = year.rows[0]?.months.length || 0;
      const blankRow: GanttItem = {
        task_name: '',
        months: Array.from({ length: monthCount }, () => false),
      };
      return { rows: [...year.rows, blankRow] };
    });
  };

  // 刪除某一年某一列工作項目
  const handleDeleteGanttRow = (yearIndex: number, rowKey: number) => {
    updateYear(yearIndex, year => ({
      rows: year.rows.filter((_, ri) => ri !== rowKey),
    }));
  };

  // 一鍵把「資料分析」7 項範本帶入「該年」（依該年月數分配進度，會覆寫該年所有工作項目）
  const handleLoadGanttTemplate = (yearIndex: number) => {
    updateYear(yearIndex, year => ({
      rows: generateDefaultGanttRows(year.rows[0]?.months.length || 12),
    }));
  };

  // 多年期：把某一節的「分年填空骨架」帶入該欄位。
  // 欄位為空 → 直接填入；欄位已有內容 → 跳確認，附加到末尾（不覆寫、不丟既有文字）。
  const handleLoadSkeleton = (section: YearlySection) => {
    const skeleton = buildYearlySkeleton(section, ganttRocBase, ganttChart.length);
    const current = (getValues(section) || '').trim();
    if (!current) {
      setValue(section, skeleton);
      message.success('已帶入分年骨架');
      return;
    }
    Modal.confirm({
      title: '欄位已有內容',
      content: '將分年骨架附加到現有內容末尾？（不會覆寫原有文字）',
      okText: '附加',
      cancelText: '取消',
      onOk: () => {
        setValue(section, `${getValues(section)}\n\n${skeleton}`);
        message.success('已附加分年骨架');
      },
    });
  };

  // 多年期才顯示的「帶入分年骨架」小按鈕（放在各節 label 旁）
  const skeletonButton = (section: YearlySection) =>
    isMultiYear ? (
      <Button
        type="link"
        size="small"
        icon={<ProfileOutlined />}
        style={{ paddingLeft: 8 }}
        onClick={() => handleLoadSkeleton(section)}
      >
        帶入分年骨架
      </Button>
    ) : null;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await generateAbstract({
        purpose: getValues('purpose'),
        background: getValues('background'),
        methodology: getValues('methodology'),
        expected_outcome: getValues('expected_outcome'),
      });
      setValue('abstract_zh', res.abstract_zh);
      setValue('abstract_en', res.abstract_en);
      setValue('keywords_zh', res.keywords_zh);
      setValue('keywords_en', res.keywords_en);
      message.success('摘要與關鍵字生成完成！可手動修改。');
    } catch (err) {
      message.error(`生成失敗：${err instanceof Error ? err.message : '未知錯誤'}`);
    } finally {
      setGenerating(false);
    }
  };

  // 建立某一年的甘特表格欄位（工作項目欄 + 該年各月份欄 + 刪除欄）
  const buildYearColumns = (yearIndex: number, year: GanttYear) => {
    const monthCount = year.rows[0]?.months.length || 0;
    const monthLabels = getGanttMonthLabels(yearStartDate(yearIndex), monthCount);
    return [
      {
        title: '工作項目',
        dataIndex: 'task_name',
        key: 'task_name',
        width: 200,
        fixed: 'left' as const,
        // record.key 是「該年內」的列索引，用它寫回避免同名/空白列互相干擾
        render: (_: unknown, record: { task_name: string; key: number }) => (
          <Input
            value={record.task_name}
            placeholder="請輸入工作項目"
            onChange={(e) => handleTaskNameChange(yearIndex, record.key, e.target.value)}
            size="small"
          />
        ),
      },
      ...Array.from({ length: monthCount }, (_, i) => ({
        title: monthLabels[i] || `第${i + 1}月`,
        key: `m${i}`,
        width: 56,
        render: (_: unknown, record: { months: boolean[]; key: number }) => (
          <div style={{
            width: 24, height: 24, borderRadius: 4,
            background: record.months[i] ? '#1677ff' : '#f0f0f0',
            cursor: 'pointer',
          }}
          onClick={() => handleToggleMonth(yearIndex, record.key, i)}
          />
        ),
      })),
      {
        title: '',
        key: 'action',
        width: 48,
        fixed: 'right' as const,
        render: (_: unknown, record: { key: number }) => (
          <Popconfirm
            title="刪除此工作項目？"
            okText="刪除"
            cancelText="取消"
            onConfirm={() => handleDeleteGanttRow(yearIndex, record.key)}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        ),
      },
    ];
  };

  // 某一年的甘特面板：工作項目操作列 + 表格（每年各自獨立，工作項目可不同）
  const renderYearPanel = (yearIndex: number, year: GanttYear) => (
    <div style={{ overflowX: 'auto' }}>
      {/* 工作項目操作：自行新增、或一鍵帶入「資料分析」7 項範本（只作用在這一年）*/}
      <Space style={{ marginBottom: 8 }}>
        <Button icon={<PlusOutlined />} size="small" onClick={() => handleAddGanttRow(yearIndex)}>
          新增工作項目
        </Button>
        <Popconfirm
          title="帶入「資料分析」7 項預設範本？"
          description="會覆寫這一年的所有工作項目"
          okText="帶入"
          cancelText="取消"
          onConfirm={() => handleLoadGanttTemplate(yearIndex)}
        >
          <Button size="small">帶入資料分析範本</Button>
        </Popconfirm>
      </Space>
      <Table
        dataSource={year.rows.map((g: GanttItem, i: number) => ({ ...g, key: i }))}
        columns={buildYearColumns(yearIndex, year)}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 'max-content' }}
      />
    </div>
  );

  // ===== 把畫面拆成幾個區塊變數，多年期 / 一年期「共用同一份 JSX」=====
  // 為什麼這樣寫：多年期內容很長（多了執行成果概要、又有分年甘特），單頁往下捲很久，
  // 所以多年期改用 Tabs 把內容「按區塊」分成三頁。但欄位本身一年期 / 多年期是一樣的，
  // 因此把每個區塊各寫成一個變數、只寫一次，再依 isMultiYear 決定「攤平堆疊」或「塞進 Tabs」，
  // 避免維護兩套重複 JSX。資料流完全不變（同一個 RHF 表單、同樣的 Controller、同樣的 setValue）。

  // --- 研究論述各欄（多年期會集中放在「研究論述」分頁）---

  // 多年期子分頁的 tab 標題（卡片）已經是欄位名了，欄位的 Form.Item label「文字」就省略，
  // 避免 tab 標題與 label 上下出現兩次同名；只保留骨架按鈕（extra）。必填星號（required prop）
  // 與 tooltip 仍由 Form.Item 自己的 prop 提供——即使 label 文字是空的也照常顯示。
  // 一年期是攤平堆疊、沒有 tab 標題，label 必須照常顯示「欄位名（＋按鈕）」否則欄位就沒名字了。
  const narrativeLabel = (text: string, extra?: ReactNode): ReactNode =>
    isMultiYear ? (extra ?? <span />) : <span>{text}{extra}</span>;

  const purposeField = (
    <Controller
      name="purpose"
      control={control}
      rules={{ required: '請輸入研究主旨' }}
      render={({ field, fieldState }) => (
        <Form.Item label={narrativeLabel('研究主旨', skeletonButton('purpose'))} required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
          {/* autoSize：minRows 是「框最矮也有這麼高」的下限，maxRows 是捲動前的上限。
              打字空間夠大，內容多時自動長高，超過 maxRows 才出現捲軸（避免整頁被單一框撐太長）。*/}
          <Input.TextArea {...field} autoSize={{ minRows: 6, maxRows: 14 }} placeholder="本研究旨在..." />
        </Form.Item>
      )}
    />
  );

  // 分年計劃目的：從研究主旨拆出來的獨立欄位，只在多年期的「研究論述」子分頁出現。
  // 骨架按鈕產生【分年目的】逐年填空（研究主旨那顆現在只給【全程總目標】）。
  const yearlyObjectivesField = (
    <Controller
      name="yearly_objectives"
      control={control}
      render={({ field }) => (
        <Form.Item
          label={narrativeLabel('分年計劃目的', skeletonButton('yearly_objectives'))}
          tooltip="多年期計畫請逐年敘明各年度的分年目的；可按「帶入分年骨架」產生逐年填空。"
        >
          <Input.TextArea {...field} autoSize={{ minRows: 6, maxRows: 16 }} placeholder="逐年敘明各年度目的，例：第1年完成資料清理與描述性分析..." />
        </Form.Item>
      )}
    />
  );

  const backgroundField = (
    <Controller
      name="background"
      control={control}
      rules={{ required: '請輸入背景分析' }}
      render={({ field, fieldState }) => (
        <Form.Item label={narrativeLabel('背景分析')} required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
          {/* 背景分析通常較長，minRows 給到 8（比一般欄位高一點）*/}
          <Input.TextArea {...field} autoSize={{ minRows: 8, maxRows: 18 }} placeholder="根據文獻回顧..." />
        </Form.Item>
      )}
    />
  );

  // 三、多年期計畫之執行成果概要：只有多年期才有這個變數（一年期由 docgen 自動填「不適用」）。
  // 新案概述主持人過去相關成果；延續案敘明初步成果並逐年檢視分年目標達成情形。
  // 因為只在多年期的「研究論述」分頁引用，一年期分支不會用到它，所以不需要再包 isMultiYear 條件。
  const summaryField = (
    <Controller
      name="summary_of_results"
      control={control}
      render={({ field }) => (
        <Form.Item
          label={narrativeLabel('多年期計畫之執行成果概要')}
          tooltip="新案：概述主持人過去曾執行之相關計畫成果及實際應用；延續案：敘明初步成果並逐年檢視分年目標達成情形（頁數上限 5 頁）"
        >
          <Input.TextArea {...field} autoSize={{ minRows: 6, maxRows: 16 }} placeholder="新案可概述主持人過去相關計畫成果；延續案敘明初步成果與分年目標達成情形..." />
        </Form.Item>
      )}
    />
  );

  const methodologyField = (
    <Controller
      name="methodology"
      control={control}
      rules={{ required: '請輸入實施方法及進行步驟' }}
      render={({ field, fieldState }) => (
        <Form.Item label={narrativeLabel('實施方法及進行步驟', skeletonButton('methodology'))} required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
          {/* 研究方法通常較長，minRows 同背景給到 8 */}
          <Input.TextArea {...field} autoSize={{ minRows: 8, maxRows: 18 }} placeholder="本研究採用回溯性研究設計..." />
        </Form.Item>
      )}
    />
  );

  const expectedOutcomeField = (
    <Controller
      name="expected_outcome"
      control={control}
      rules={{ required: '請輸入成果預估' }}
      render={({ field, fieldState }) => (
        <Form.Item
          label={narrativeLabel('成果預估', skeletonButton('expected_outcome'))}
          required
          validateStatus={fieldState.error ? 'error' : ''}
          help={fieldState.error?.message}
        >
          {/* 原本只有 rows={3} 特別矮，改 autoSize 後下限拉到 6，跟其他欄位一致 */}
          <Input.TextArea {...field} autoSize={{ minRows: 6, maxRows: 14 }} placeholder="本研究預期..." />
        </Form.Item>
      )}
    />
  );

  const referencesField = (
    <Controller
      name="references"
      control={control}
      render={({ field }) => (
        <Form.Item label={narrativeLabel('重要參考文獻')}>
          <Input.TextArea {...field} autoSize={{ minRows: 6, maxRows: 16 }} placeholder="請列出主要參考文獻..." />
        </Form.Item>
      )}
    />
  );

  // --- 摘要與關鍵詞區塊（AI 生成按鈕 + 中/英摘要 + 中/英關鍵詞）---
  // 提示文案改成「直接點名四個欄位」，不再用「以上」——多年期分頁後這四欄在另一個分頁，
  // 講「以上」會指錯位置，點名欄位名稱在兩種版面都正確。
  const abstractSection = (
    <>
      {/* LLM 自動生成按鈕 */}
      <div style={{ background: '#f6f8fa', borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <Button
          type="primary"
          icon={<RobotOutlined />}
          onClick={handleGenerate}
          disabled={!canGenerate}
          loading={generating}
          size="large"
        >
          {generating ? '生成中...' : '自動生成摘要與關鍵字'}
        </Button>
        {!canGenerate && (
          <span style={{ marginLeft: 12, color: '#999', fontSize: 13 }}>
            請先填寫研究目的、背景分析、研究方法、預期成果
          </span>
        )}
        <p style={{ color: '#666', fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          將傳送研究內容至 AI 服務生成摘要（可於右上角「AI 設定」切換 Groq / Gemini）。機密研究請勿使用此功能。
        </p>
      </div>

      <Spin spinning={generating}>
        <Controller
          name="abstract_zh"
          control={control}
          render={({ field }) => (
            <Form.Item label="中文摘要" tooltip="🤖 LLM 自動生成，可手動編輯">
              <Input.TextArea {...field} autoSize={{ minRows: 6, maxRows: 14 }} placeholder="點擊上方按鈕自動生成，或手動填寫..." />
            </Form.Item>
          )}
        />

        <Controller
          name="abstract_en"
          control={control}
          render={({ field }) => (
            <Form.Item label="英文摘要" tooltip="🤖 LLM 自動生成，可手動編輯">
              <Input.TextArea {...field} autoSize={{ minRows: 6, maxRows: 14 }} placeholder="Auto-generated or fill manually..." />
            </Form.Item>
          )}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Controller
            name="keywords_zh"
            control={control}
            render={({ field }) => (
              <Form.Item label="中文關鍵詞" tooltip="🤖 LLM 自動生成，以頓號分隔">
                <Input {...field} placeholder="例：流感、疫苗效益、群聚事件" />
              </Form.Item>
            )}
          />
          <Controller
            name="keywords_en"
            control={control}
            render={({ field }) => (
              <Form.Item label="英文關鍵詞 (MeSH)" tooltip="🤖 LLM 自動生成，以逗號分隔">
                <Input {...field} placeholder="e.g. Influenza, Vaccine Effectiveness" />
              </Form.Item>
            )}
          />
        </div>
      </Spin>
    </>
  );

  // --- 預定進度表區塊（分年甘特圖，內部本來就已自帶分年 tabs）---
  const scheduleSection = (
    <Form.Item label="預定進度表">
      {ganttChart.length > 0 ? (
        <div>
          {isMultiYear ? (
            <Tabs
              type="card"
              items={ganttChart.map((year: GanttYear, yearIndex: number) => ({
                key: String(yearIndex),
                label: yearTabLabel(yearIndex),
                children: renderYearPanel(yearIndex, year),
              }))}
            />
          ) : (
            renderYearPanel(0, ganttChart[0])
          )}
          <p style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
            工作項目可自行輸入、新增或刪除；點擊格子可切換該月啟用/停用。月份欄由執行起迄日自動生成。
            {isMultiYear && '多年期計畫請逐年填寫，各年的工作項目可以不同。'}
          </p>
        </div>
      ) : (
        <Tag color="orange">請先在第 1 頁填寫執行起迄日，系統將自動生成預定進度表</Tag>
      )}
    </Form.Item>
  );

  return (
    <div>
      <h3>研究內容</h3>

      {isMultiYear ? (
        // 多年期：內容長，用 Tabs 按區塊分三頁。
        // ⚠️ 四個必填欄（purpose / background / methodology / expected_outcome）全部放在第一頁
        //   「研究論述」，這樣驗證錯誤的紅字一定看得到，不會被藏在沒展開的分頁裡。
        <Tabs
          items={[
            {
              key: 'narrative',
              label: '研究論述',
              // 研究論述再用「水平頂部子分頁」一節一頁（順序貼齊 DOC-2 肆、計畫內容）。
              // 改水平頂部（非直式）讓子頁內容用滿整個寬度，填寫框更寬；用 type="card"（卡片式）
              // 跟外層的 line tab 做層級區隔，避免兩排水平 tab 看起來像同一排而混淆。
              // ⚠️ 不設 destroyInactiveTabPane：保留各子頁 DOM，切頁不丟資料、必填錯誤也不會被藏掉。
              children: (
                // 用 Form layout="vertical"（component={false} 只提供版面 context、不接管資料，
                // 資料仍由 react-hook-form 管）把 label 移到輸入框「上方」——預設 horizontal label 會
                // 擺左邊吃掉約 200px 寬度、且 label 越長框越窄；改 vertical 後輸入框用滿整個寬度。
                // 只包多年期子分頁，一年期攤平版面不受影響。
                <Form layout="vertical" component={false}>
                  <Tabs
                    type="card"
                    items={[
                      { key: 'purpose', label: '研究主旨', children: purposeField },
                      { key: 'yearly_objectives', label: '分年計劃目的', children: yearlyObjectivesField },
                      { key: 'background', label: '背景分析', children: backgroundField },
                      { key: 'summary', label: '執行成果概要', children: summaryField },
                      { key: 'methodology', label: '實施方法及進行步驟', children: methodologyField },
                      { key: 'expected_outcome', label: '成果預估', children: expectedOutcomeField },
                      { key: 'references', label: '重要參考文獻', children: referencesField },
                    ]}
                  />
                </Form>
              ),
            },
            { key: 'abstract', label: '摘要與關鍵詞', children: abstractSection },
            { key: 'schedule', label: '預定進度表', children: scheduleSection },
          ]}
        />
      ) : (
        // 一年期：內容較短，維持原本的單頁堆疊（順序與改版前完全相同，無 summaryField）。
        <>
          {purposeField}
          {backgroundField}
          {methodologyField}
          {expectedOutcomeField}
          {abstractSection}
          {referencesField}
          {scheduleSection}
        </>
      )}
    </div>
  );
}
