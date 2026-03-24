// ===== 表單終結者 Forminator — 主應用 =====

import { useState, useRef, useEffect } from 'react';
import { ConfigProvider, Layout, Steps, Button, Space, message, Modal, Upload, Checkbox, Typography, Divider, App as AntApp } from 'antd';
import { ExportOutlined, ImportOutlined, DownloadOutlined, ArrowLeftOutlined, ArrowRightOutlined, FileTextOutlined } from '@ant-design/icons';
import zhTW from 'antd/locale/zh_TW';

import { FormContext, useCreateFormStore } from './hooks/useFormStore';
import DataLossWarning from './components/common/DataLossWarning';
import Step1BasicInfo from './components/wizard/Step1BasicInfo';
import Step2Personnel from './components/wizard/Step2Personnel';
import Step3Research from './components/wizard/Step3Research';
import Step4IRB from './components/wizard/Step4IRB';
import Step5Database from './components/wizard/Step5Database';
import WorkflowGuide from './components/workflow/WorkflowGuide';

import { exportToJson, importFromJson } from './utils/exportImport';
import { generateDefaultGantt, calcMonthsBetween } from './utils/gantt';
import { generateAllDocuments } from './utils/docgen';
import { DOC_NAMES, SDD_VERSION } from './data/defaults';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

const STEPS = [
  { title: '基本資訊', component: Step1BasicInfo },
  { title: '研究團隊', component: Step2Personnel },
  { title: '研究內容', component: Step3Research },
  { title: 'IRB 審查', component: Step4IRB },
  { title: '資料庫申請', component: Step5Database },
];

const ALL_DOCS = Object.keys(DOC_NAMES);

function AppContent() {
  const form = useCreateFormStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>(ALL_DOCS);
  const [generating, setGenerating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const { getValues, setValue, watch, reset, formState } = form;
  const hasData = formState.isDirty;

  // 監聽執行起迄日，自動生成甘特圖
  const executionStart = watch('execution_start');
  const executionEnd = watch('execution_end');

  useEffect(() => {
    if (executionStart && executionEnd) {
      const months = calcMonthsBetween(executionStart, executionEnd);
      if (months > 0) {
        const currentGantt = getValues('gantt_chart');
        if (currentGantt.length === 0) {
          setValue('gantt_chart', generateDefaultGantt(months));
        }
      }
    }
  }, [executionStart, executionEnd, setValue, getValues]);

  // 匯出
  const handleExport = () => {
    exportToJson(getValues());
    message.success('JSON 已匯出！');
  };

  // 匯入
  const handleImport = async (file: File) => {
    const result = await importFromJson(file);
    if (!result) {
      message.error('JSON 檔案格式不正確');
      return;
    }
    if (result.version !== SDD_VERSION) {
      Modal.confirm({
        title: '版本不一致',
        content: `匯入檔案版本為 v${result.version}，目前系統版本為 v${SDD_VERSION}。部分欄位可能不相容，是否繼續匯入？`,
        onOk: () => {
          reset(result.data);
          message.success('匯入成功！');
        },
      });
    } else {
      reset(result.data);
      message.success('匯入成功！');
    }
  };

  // 生成文件 — 進入結果頁
  const handleGenerate = () => {
    setShowResult(true);
  };

  // 實際下載 ZIP
  const handleDownload = async () => {
    if (selectedDocs.length === 0) {
      message.warning('請至少選擇一份文件');
      return;
    }
    setGenerating(true);
    try {
      await generateAllDocuments(getValues(), selectedDocs);
      message.success(`已生成 ${selectedDocs.length} 份文件並下載 ZIP！`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '文件生成失敗');
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const CurrentStepComponent = STEPS[currentStep].component;

  return (
    <FormContext.Provider value={form}>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>🤖</span>
            <Title level={4} style={{ margin: 0 }}>表單終結者</Title>
            <Text type="secondary" style={{ fontSize: 12 }}>Forminator v{SDD_VERSION}</Text>
          </div>
          <Space>
            <Upload
              accept=".json"
              showUploadList={false}
              beforeUpload={(file) => { handleImport(file); return false; }}
            >
              <Button icon={<ImportOutlined />}>匯入草稿</Button>
            </Upload>
            <Button type="primary" ghost icon={<ExportOutlined />} onClick={handleExport}>
              匯出 JSON
            </Button>
          </Space>
        </Header>

        <Content style={{ padding: '24px', maxWidth: 960, margin: '0 auto', width: '100%' }} ref={contentRef}>
          <DataLossWarning onExport={handleExport} hasData={hasData} />

          {!showResult ? (
            <>
              <Steps
                current={currentStep}
                items={STEPS.map((s) => ({ title: s.title }))}
                style={{ marginBottom: 32 }}
                onChange={(step) => setCurrentStep(step)}
              />

              <div style={{ minHeight: 400 }}>
                <CurrentStepComponent />
              </div>

              <Divider />

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                >
                  上一步
                </Button>

                {currentStep < STEPS.length - 1 ? (
                  <Button type="primary" onClick={handleNext}>
                    下一步 <ArrowRightOutlined />
                  </Button>
                ) : (
                  <Button type="primary" icon={<DownloadOutlined />} size="large" onClick={handleGenerate}>
                    生成文件
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Title level={3}>🎉 文件準備完成！</Title>
                <Text type="secondary">請選擇要下載的文件，並依跑關順序辦理後續流程。</Text>
              </div>

              <div style={{ background: '#f6f8fa', borderRadius: 8, padding: 24, marginBottom: 24 }}>
                <h4>選擇要產生的文件</h4>
                <Checkbox.Group
                  value={selectedDocs}
                  onChange={(vals) => setSelectedDocs(vals as string[])}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
                >
                  {ALL_DOCS.map((doc) => (
                    <Checkbox key={doc} value={doc}>
                      <FileTextOutlined /> {doc} {DOC_NAMES[doc]}
                    </Checkbox>
                  ))}
                </Checkbox.Group>

                <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                  <Button type="primary" icon={<DownloadOutlined />} size="large"
                    onClick={handleDownload}
                    loading={generating}
                  >
                    {generating ? '生成中...' : `下載 ZIP（${selectedDocs.length} 份）`}
                  </Button>
                  <Button icon={<ExportOutlined />} onClick={handleExport}>
                    一併匯出 JSON 草稿
                  </Button>
                </div>

                <p style={{ color: '#999', fontSize: 12, marginTop: 12, marginBottom: 0 }}>
                  建議一併匯出 JSON 草稿檔，方便日後修改重新生成。
                </p>
              </div>

              <WorkflowGuide />

              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Button onClick={() => setShowResult(false)}>← 返回修改表單</Button>
              </div>
            </>
          )}
        </Content>

        <Footer style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
          表單終結者 Forminator — 「I'll be back... with all 7 forms.」
        </Footer>
      </Layout>
    </FormContext.Provider>
  );
}

export default function App() {
  return (
    <ConfigProvider locale={zhTW}>
      <AntApp>
        <AppContent />
      </AntApp>
    </ConfigProvider>
  );
}
