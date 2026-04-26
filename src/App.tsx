// ===== 研究計畫表單終結者 Forminator — 主應用 =====

import { useRef, useCallback, useMemo } from 'react';
import { ConfigProvider, Layout, Steps, Button, Space, Upload, Checkbox, Typography, Divider, Modal, Collapse, Card, Tag, Grid, App as AntApp } from 'antd';
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
import LLMSettingsPanel from './components/common/LLMSettingsPanel';
import Step1BasicInfo from './components/wizard/Step1BasicInfo';
import Step2Personnel from './components/wizard/Step2Personnel';
import Step3Research from './components/wizard/Step3Research';
import Step4IRB from './components/wizard/Step4IRB';
import Step5Budget from './components/wizard/Step5Budget';
import Step6Database from './components/wizard/Step5Database';
import WorkflowGuide from './components/workflow/WorkflowGuide';

import { DOC_NAMES, SDD_VERSION, defaultFormData, type DocId } from './data/defaults';
import { getPlanConfig, type WizardStepKey } from './data/planConfigs';
import { STEP_CONFIGS } from './data/stepConfigs';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

// step key → React 元件對應。實際顯示哪幾步由 planConfigs.wizardStepKeys 決定。
// title / hint / affectedDocs 集中在 stepConfigs.ts，這裡只負責元件 mapping。
const STEP_COMPONENTS: Record<WizardStepKey, React.ComponentType> = {
  basic:     Step1BasicInfo,
  personnel: Step2Personnel,
  research:  Step3Research,
  irb:       Step4IRB,
  budget:    Step5Budget,
  database:  Step6Database,
};

const DOC_GROUPS: Array<{ key: string; label: string; docs: DocId[] }> = [
  { key: 'irb', label: 'IRB', docs: ['DOC-1', 'DOC-2', 'DOC-3', 'DOC-4', 'DOC-5', 'DOC-6'] },
  { key: 'database', label: '資料庫', docs: ['DOC-7', 'DOC-8', 'DOC-9', 'DOC-10', 'DOC-11'] },
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
  // 根據 review_type 動態決定步驟清單
  const reviewType = form.watch('review_type');
  const planConfig = useMemo(() => getPlanConfig(reviewType), [reviewType]);
  const screens = Grid.useBreakpoint();
  const isDesktop = !!screens.lg;
  const steps = useMemo(() => {
    return planConfig.wizardStepKeys.map((key) => ({
      key,
      title: STEP_CONFIGS[key].title,
      component: STEP_COMPONENTS[key],
    }));
  }, [planConfig]);

  const { currentStep, showResult, next, prev, goTo, enterResult, exitResult, isFirst, isLast } = useWizardNavigation(steps.length);
  const { selectedDocs, setSelectedDocs, generating, download } = useDocumentGeneration();
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

  const toggleDocGroup = useCallback((docs: DocId[]) => {
    setSelectedDocs((prev) => {
      const hasAllGroupDocs = docs.every((doc) => prev.includes(doc));
      const hasOtherDocs = prev.some((doc) => !docs.includes(doc));

      if (hasAllGroupDocs && hasOtherDocs) {
        return docs;
      }

      if (!hasAllGroupDocs) {
        return Array.from(new Set([...prev, ...docs]));
      }

      return prev.filter((doc) => !docs.includes(doc));
    });
  }, [setSelectedDocs]);

  const updateDocGroupSelection = useCallback((groupDocs: DocId[], nextGroupDocs: DocId[]) => {
    setSelectedDocs((prev) => {
      const otherDocs = prev.filter((doc) => !groupDocs.includes(doc));
      return [...otherDocs, ...nextGroupDocs];
    });
  }, [setSelectedDocs]);

  const currentStepDef = steps[currentStep] ?? {
    key: 'basic' as const,
    title: STEP_CONFIGS.basic.title,
    component: STEP_COMPONENTS.basic,
  };
  const CurrentStepComponent = currentStepDef.component;
  const currentStepConfig = STEP_CONFIGS[currentStepDef.key];
  const currentStepDocs = currentStepConfig.affectedDocs;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        background: '#FDFCFA',
        borderBottom: '1px solid #D9D4CC',
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

      <Content
        style={{
          padding: isDesktop ? '24px' : '16px',
          maxWidth: 1440,
          margin: '0 auto',
          width: '100%',
        }}
        ref={contentRef}
      >
        <DataLossWarning onExport={handleExport} hasData={hasData} />

        {!showResult ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isDesktop ? '260px minmax(0, 1fr)' : '1fr',
              gap: 20,
              alignItems: 'start',
            }}
          >
            <div style={{ position: isDesktop ? 'sticky' : 'static', top: 88 }}>
              <Card
                title="申請流程"
                style={{
                  marginBottom: 16,
                  borderColor: '#D9D4CC',
                  boxShadow: '0 8px 20px rgba(86, 74, 59, 0.05)',
                }}
              >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space wrap size={8}>
                    <Tag color="blue">{planConfig.label}</Tag>
                    <Tag color="default">{steps.length} 個填寫步驟</Tag>
                    <Tag color="default">{planConfig.docs.length} 份文件</Tag>
                  </Space>
                  <Text type="secondary">{planConfig.description}</Text>
                  <Steps
                    direction="vertical"
                    size="small"
                    current={currentStep}
                    items={steps.map((step, index) => ({
                      title: (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span>{step.title}</span>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            第 {index + 1} 步
                          </Text>
                        </div>
                      ),
                    }))}
                    onChange={goTo}
                  />
                </Space>
              </Card>

              <Card
                title="目前進度"
                size="small"
                style={{ borderColor: '#D9D4CC', boxShadow: '0 8px 20px rgba(86, 74, 59, 0.05)' }}
              >
                <Space direction="vertical" size={8}>
                  <Text>已完成步驟：{currentStep} / {steps.length - 1}</Text>
                  <Text>目前位置：{currentStepDef.title}</Text>
                  <Text type="secondary">點左側流程可以直接切換步驟。</Text>
                </Space>
              </Card>
            </div>

            <Card
              bordered={false}
              style={{
                minHeight: 560,
                boxShadow: '0 10px 28px rgba(86, 74, 59, 0.08)',
              }}
            >
              <div
                style={{
                  marginBottom: 24,
                  paddingBottom: 20,
                  borderBottom: '1px solid #E5DED3',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <Space wrap size={8}>
                  <Tag color="blue">第 {currentStep + 1} 步</Tag>
                  {currentStepDocs.map((doc) => (
                    <Tag key={doc} color="default">{doc}</Tag>
                  ))}
                </Space>
                <div>
                  <Title level={2} style={{ margin: 0 }}>{currentStepDef.title}</Title>
                  <Text type="secondary" style={{ fontSize: 15 }}>
                    {currentStepConfig.hint}
                  </Text>
                </div>
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>本步會影響的文件</Text>
                  <Space wrap size={[8, 8]}>
                    {currentStepDocs.map((doc) => (
                      <Tag key={doc} color="processing">
                        {doc} {DOC_NAMES[doc]}
                      </Tag>
                    ))}
                  </Space>
                </div>
              </div>

              <div style={{ minHeight: 400 }}>
                <CurrentStepComponent />
              </div>

              <Divider />

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
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
            </Card>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <Title level={3}>🎉 文件準備完成！</Title>
              <Text type="secondary">請選擇要下載的文件，並依跑關順序辦理後續流程。</Text>
            </div>

            <div style={{ background: '#F0EDE8', borderRadius: 8, padding: 24, marginBottom: 24 }}>
              <h4>選擇要產生的文件</h4>
              <Collapse
                ghost
                items={DOC_GROUPS.map((group) => ({
                  key: group.key,
                  label: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={group.docs.every((doc) => selectedDocs.includes(doc))}
                          indeterminate={
                            group.docs.some((doc) => selectedDocs.includes(doc)) &&
                            !group.docs.every((doc) => selectedDocs.includes(doc))
                          }
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleDocGroup(group.docs);
                          }}
                        >
                          {group.label}
                        </Checkbox>
                      </span>
                      <span style={{ color: '#666056' }}>（{group.docs.length} 份）</span>
                    </div>
                  ),
                  children: (
                    <Checkbox.Group
                      value={group.docs.filter((doc) => selectedDocs.includes(doc))}
                      onChange={(vals) => updateDocGroupSelection(group.docs, vals as DocId[])}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {group.docs.map((doc) => (
                          <Checkbox key={doc} value={doc}>
                            <FileTextOutlined /> {doc} {DOC_NAMES[doc]}
                          </Checkbox>
                        ))}
                      </div>
                    </Checkbox.Group>
                  ),
                }))}
              />

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
        研究計畫表單終結者 Forminator — 「I'll be back... with all 8 forms.」<br />
        意見回饋 / 問題通報：請 e-mail 至 <a href="mailto:kcwang35@cdc.gov.tw" style={{ color: '#999' }}>kcwang35@cdc.gov.tw</a>
      </Footer>
    </Layout>
  );
}

export default function App() {
  return (
    <ConfigProvider
      locale={zhTW}
      theme={{
        token: {
          colorPrimary:       '#2C6FBF',
          fontFamily:         '"LXGW WenKai TC", "Noto Sans TC", sans-serif',
          colorBgLayout:      '#F7F5F0',
          colorBgContainer:   '#FDFCFA',
          colorBorder:        '#D9D4CC',
          colorTextBase:      '#2D2D2D',
          colorTextSecondary: '#666056',
          fontSize:           15,
          borderRadius:       6,
        },
        components: {
          Layout: {
            footerBg: '#F0EDE8',
          },
          Steps: {
            colorPrimary: '#2C6FBF',
          },
        },
      }}
    >
      <AntApp>
        <AppContent />
      </AntApp>
    </ConfigProvider>
  );
}
