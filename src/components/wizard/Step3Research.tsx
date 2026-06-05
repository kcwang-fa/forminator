// ===== 第 3 頁：研究內容 =====

import { useMemo, useState } from 'react';
import { Form, Input, Button, Spin, Tag, message, Table, Space, Popconfirm } from 'antd';
import { RobotOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { Controller } from 'react-hook-form';
import { useFormStore } from '../../hooks/useFormStore';
import { generateAbstract } from '../../api/llm';
import { getGanttMonthLabels, generateDefaultGantt } from '../../utils/gantt';
import type { GanttItem } from '../../types/form';

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
  // 甘特圖目前的月數（由第一列的 months 長度決定，所有列等長）
  const ganttMonths = ganttChart[0]?.months.length || 0;
  const monthLabels = useMemo(
    () => getGanttMonthLabels(ganttStart, ganttMonths),
    [ganttMonths, ganttStart],
  );

  // 修改某一列的工作項目名稱
  const handleTaskNameChange = (idx: number, value: string) => {
    const updated = ganttChart.map((g: GanttItem, i: number) =>
      i === idx ? { ...g, task_name: value } : g
    );
    setValue('gantt_chart', updated);
  };

  // 新增一列空白工作項目（月數沿用目前甘特圖）
  const handleAddGanttRow = () => {
    const blankRow: GanttItem = {
      task_name: '',
      months: Array.from({ length: ganttMonths }, () => false),
    };
    setValue('gantt_chart', [...ganttChart, blankRow]);
  };

  // 刪除某一列工作項目
  const handleDeleteGanttRow = (idx: number) => {
    setValue('gantt_chart', ganttChart.filter((_: GanttItem, i: number) => i !== idx));
  };

  // 一鍵帶入「資料分析」7 項預設範本（依目前月數自動分配進度，會覆寫現有工作項目）
  const handleLoadGanttTemplate = () => {
    setValue('gantt_chart', generateDefaultGantt(ganttMonths));
  };

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

  // 甘特圖月份標頭
  const ganttColumns = ganttChart.length > 0 ? [
    {
      title: '工作項目',
      dataIndex: 'task_name',
      key: 'task_name',
      width: 200,
      fixed: 'left' as const,
      // record.key 是列索引（dataSource 以 key: i 帶入），用它寫回避免同名/空白列互相干擾
      render: (_: unknown, record: { task_name: string; key: number }) => (
        <Input
          value={record.task_name}
          placeholder="請輸入工作項目"
          onChange={(e) => handleTaskNameChange(record.key, e.target.value)}
          size="small"
        />
      ),
    },
    ...ganttChart[0].months.map((_: boolean, i: number) => ({
      title: monthLabels[i] || `第${i + 1}月`,
      key: `m${i}`,
      width: 56,
      render: (_: unknown, record: { months: boolean[]; key: number }) => (
        <div style={{
          width: 24, height: 24, borderRadius: 4,
          background: record.months[i] ? '#1677ff' : '#f0f0f0',
          cursor: 'pointer',
        }}
        // 用 record.key（列索引）定位，避免同名/空白列誤判
        onClick={() => {
          const idx = record.key;
          const updated = [...ganttChart];
          updated[idx] = {
            ...updated[idx],
            months: updated[idx].months.map((v: boolean, mi: number) => mi === i ? !v : v),
          };
          setValue('gantt_chart', updated);
        }}
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
          onConfirm={() => handleDeleteGanttRow(record.key)}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ] : [];

  return (
    <div>
      <h3>研究內容</h3>

      <Controller
        name="purpose"
        control={control}
        rules={{ required: '請輸入研究目的' }}
        render={({ field, fieldState }) => (
          <Form.Item label="研究目的" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
            <Input.TextArea {...field} rows={4} placeholder="本研究旨在..." />
          </Form.Item>
        )}
      />

      <Controller
        name="background"
        control={control}
        rules={{ required: '請輸入背景分析' }}
        render={({ field, fieldState }) => (
          <Form.Item label="背景分析" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
            <Input.TextArea {...field} rows={6} placeholder="根據文獻回顧..." />
          </Form.Item>
        )}
      />

      <Controller
        name="methodology"
        control={control}
        rules={{ required: '請輸入研究方法' }}
        render={({ field, fieldState }) => (
          <Form.Item label="研究方法" required validateStatus={fieldState.error ? 'error' : ''} help={fieldState.error?.message}>
            <Input.TextArea {...field} rows={6} placeholder="本研究採用回溯性研究設計..." />
          </Form.Item>
        )}
      />

      <Controller
        name="expected_outcome"
        control={control}
        rules={{ required: '請輸入預期成果' }}
        render={({ field, fieldState }) => (
          <Form.Item
            label={(
              <span>
                預期成果
                <br />
                及主要效益
              </span>
            )}
            required
            validateStatus={fieldState.error ? 'error' : ''}
            help={fieldState.error?.message}
          >
            <Input.TextArea {...field} rows={3} placeholder="本研究預期..." />
          </Form.Item>
        )}
      />

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
            請先填寫以上 4 個核心欄位
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
              <Input.TextArea {...field} rows={6} placeholder="點擊上方按鈕自動生成，或手動填寫..." />
            </Form.Item>
          )}
        />

        <Controller
          name="abstract_en"
          control={control}
          render={({ field }) => (
            <Form.Item label="英文摘要" tooltip="🤖 LLM 自動生成，可手動編輯">
              <Input.TextArea {...field} rows={6} placeholder="Auto-generated or fill manually..." />
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

      <Controller
        name="references"
        control={control}
        render={({ field }) => (
          <Form.Item label="重要參考文獻">
            <Input.TextArea {...field} rows={5} placeholder="請列出主要參考文獻..." />
          </Form.Item>
        )}
      />

      {/* 甘特圖 */}
      <Form.Item label="預定進度表">
        {ganttChart.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            {/* 工作項目操作：自行新增、或一鍵帶入「資料分析」7 項範本 */}
            <Space style={{ marginBottom: 8 }}>
              <Button icon={<PlusOutlined />} size="small" onClick={handleAddGanttRow}>
                新增工作項目
              </Button>
              <Popconfirm
                title="帶入「資料分析」7 項預設範本？"
                description="會覆寫目前所有工作項目"
                okText="帶入"
                cancelText="取消"
                onConfirm={handleLoadGanttTemplate}
              >
                <Button size="small">帶入資料分析範本</Button>
              </Popconfirm>
            </Space>
            <Table
              dataSource={ganttChart.map((g: { task_name: string; months: boolean[] }, i: number) => ({ ...g, key: i }))}
              columns={ganttColumns}
              pagination={false}
              size="small"
              bordered
              scroll={{ x: 'max-content' }}
            />
            <p style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
              工作項目可自行輸入、新增或刪除；點擊格子可切換該月啟用/停用。月份欄由執行起迄日自動生成。
            </p>
          </div>
        ) : (
          <Tag color="orange">請先在第 1 頁填寫執行起迄日，系統將自動生成預定進度表</Tag>
        )}
      </Form.Item>
    </div>
  );
}
