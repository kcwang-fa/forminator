// ===== 研究計畫表單終結者 Forminator — 主應用 =====

import { useRef, useCallback } from 'react';
import { ConfigProvider, Layout, Steps, Button, Space, Upload, Checkbox, Typography, Divider, Alert, Modal, App as AntApp } from 'antd';
import { ExportOutlined, ImportOutlined, DownloadOutlined, ArrowLeftOutlined, ArrowRightOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import zhTW from 'antd/locale/zh_TW';

import { FormContext, useCreateFormStore } from './hooks/useFormStore';
import { useLLMSettings } from './hooks/useLLMSettings';
import { useWizardNavigation } from './hooks/useWizardNavigation';
import { useDocumentGeneration } from './hooks/useDocumentGeneration';
import { useImportExport } from './hooks/useImportExport';
import { useAutoGantt } from './hooks/useAutoGantt';
import { useAutoSave, clearDraft } from './hooks/useAutoSave';

import DataLossWarning from './components/common/DataLossWarning';
import FeedbackButton from './components/common/FeedbackButton';
import LLMSettingsPanel from './components/common/LLMSettingsPanel';
import Step1BasicInfo from './components/wizard/Step1BasicInfo';
import Step2Personnel from './components/wizard/Step2Personnel';
import Step3Research from './components/wizard/Step3Research';
import Step4IRB from './components/wizard/Step4IRB';
import Step5Database from './components/wizard/Step5Database';
import WorkflowGuide from './components/workflow/WorkflowGuide';

import { DOC_NAMES, SDD_VERSION, defaultFormData } from './data/defaults';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

const STEPS = [
  { title: '基本資訊', component: Step1BasicInfo },
  { title: '研究團隊', component: Step2Personnel },
  { title: '研究內容', component: Step3Research },
  { title: 'IRB 審查', component: Step4IRB },
  { title: '資料庫申請', component: Step5Database },
];

function AppContent() {
  const form = useCreateFormStore();
  const { settings: llmSettings, setSettings: setLLMSettings } = useLLMSettings();
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <FormContext.Provider value={form}>
      <AppInner
        form={form}
        llmSettings={llmSettings}
        setLLMSettings={setLLMSettings}
        contentRef={contentRef}
      />
    </FormContext.Provider>
  );
}

function AppInner({ form, llmSettings, setLLMSettings, contentRef }: {
  form: ReturnType<typeof useCreateFormStore>;
  llmSettings: ReturnType<typeof useLLMSettings>['settings'];
  setLLMSettings: ReturnType<typeof useLLMSettings>['setSettings'];
  contentRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { currentStep, showResult, next, prev, goTo, enterResult, exitResult, isFirst, isLast } = useWizardNavigation();
  const { selectedDocs, setSelectedDocs, generating, download, allDocs } = useDocumentGeneration();
  const { handleExport, handleImport } = useImportExport();
  useAutoGantt();
  useAutoSave();

  const hasData = form.formState.isDirty;

  const handleNewForm = useCallback(() => {
    Modal.confirm({
      title: '確定要新建表單嗎？',
      content: '目前填寫的內容將會清除。建議先匯出 JSON 草稿備份。',
      okText: '確定新建',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        clearDraft();
        form.reset(defaultFormData);
      },
    });
  }, [form]);
  const CurrentStepComponent = STEPS[currentStep].component;

  return (
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
          <Title level={4} style={{ margin: 0 }}>研究計畫表單終結者</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>Forminator v{SDD_VERSION}</Text>
        </div>
        <Space>
          <Button icon={<PlusOutlined />} onClick={handleNewForm}>新建表單</Button>
          <LLMSettingsPanel settings={llmSettings} onSave={setLLMSettings} />
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
        <Alert
          message="本工具適用於署內無經費研究免審申請，協助快速產生計畫書、IRB 申請表及相關文件"
          type="info"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />

        {!showResult ? (
          <>
            <Steps
              current={currentStep}
              items={STEPS.map((s) => ({ title: s.title }))}
              style={{ marginBottom: 32 }}
              onChange={goTo}
            />

            <div style={{ minHeight: 400 }}>
              <CurrentStepComponent />
            </div>

            <Divider />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={prev}
                disabled={isFirst}
              >
                上一步
              </Button>

              {!isLast ? (
                <Button type="primary" onClick={next}>
                  下一步 <ArrowRightOutlined />
                </Button>
              ) : (
                <Button type="primary" icon={<DownloadOutlined />} size="large" onClick={enterResult}>
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
                {allDocs.map((doc) => (
                  <Checkbox key={doc} value={doc}>
                    <FileTextOutlined /> {doc} {DOC_NAMES[doc]}
                  </Checkbox>
                ))}
              </Checkbox.Group>

              <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
                <Button type="primary" icon={<DownloadOutlined />} size="large"
                  onClick={download}
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
              <Button onClick={exitResult}>← 返回修改表單</Button>
            </div>
          </>
        )}
      </Content>

      <Footer style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>
        研究計畫表單終結者 Forminator — 「I'll be back... with all 7 forms.」
      </Footer>
      <FeedbackButton />
    </Layout>
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
