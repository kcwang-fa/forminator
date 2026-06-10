// ===== 研究計畫表單終結者 Forminator — 主應用 =====

import { useRef, useCallback } from 'react';
import { ConfigProvider, Layout, Steps, Button, Space, Upload, Checkbox, Typography, Divider, Modal, Collapse, Card, Tag, Grid, App as AntApp } from 'antd';
import { ExportOutlined, ImportOutlined, DownloadOutlined, ArrowLeftOutlined, ArrowRightOutlined, FileTextOutlined, PlusOutlined, CompressOutlined, ExpandOutlined } from '@ant-design/icons';
import zhTW from 'antd/locale/zh_TW';

import { FormContext, useCreateFormStore } from './hooks/useFormStore';
import { useLLMSettings } from './hooks/useLLMSettings';
import { useFocusMode } from './hooks/useFocusMode';
import { useWizardNavigation } from './hooks/useWizardNavigation';
import { useDocumentGeneration } from './hooks/useDocumentGeneration';
import { useImportExport } from './hooks/useImportExport';
import { useAutoGantt } from './hooks/useAutoGantt';
import { useAutoSave, clearDraft } from './hooks/useAutoSave';
import { useExportReminder } from './hooks/useExportReminder';
import { useUnsavedChangesGuard } from './hooks/useUnsavedChangesGuard';

import SaveStatusIndicator from './components/common/SaveStatusIndicator';
import LLMSettingsPanel from './components/common/LLMSettingsPanel';
import Step1BasicInfo from './components/wizard/Step1BasicInfo';
import Step2Personnel from './components/wizard/Step2Personnel';
import Step3Research from './components/wizard/Step3Research';
import Step4IRB from './components/wizard/Step4IRB';
import Step5Budget from './components/wizard/Step5Budget';
import Step6Database from './components/wizard/Step5Database';
import WorkflowGuide from './components/workflow/WorkflowGuide';

import { DOC_NAMES, SDD_VERSION, defaultFormData, type DocId } from './data/defaults';
import { resolveActivePlan, OUTPUT_CATEGORIES, OUTPUT_CATEGORY_CONFIGS, type WizardStepKey } from './data/planConfigs';
import { STEP_CONFIGS } from './data/stepConfigs';
import { getProgressEncouragement, RESULT_ENCOURAGEMENT } from './data/encouragements';

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
  // 步驟與文件 = review_type 全集 ∩ 勾選的成果類別
  // （本專案開啟 React Compiler，會自動 memo，不需手寫 useMemo）
  const reviewType = form.watch('review_type');
  const outputCategories = form.watch('output_categories') ?? [];
  const active = resolveActivePlan(reviewType, outputCategories);
  const planConfig = active.planConfig;
  const screens = Grid.useBreakpoint();
  const isDesktop = !!screens.lg;
  // 專注模式：開啟時收掉左側導覽與重複的文件 Tag，讓視線集中在當前步驟的欄位
  const { focusMode, toggleFocusMode } = useFocusMode();
  const steps = active.wizardStepKeys.map((key) => ({
    key,
    title: STEP_CONFIGS[key].title,
    component: STEP_COMPONENTS[key],
  }));

  // 結果頁的文件勾選群組：依成果類別分組，只保留目前實際會產出的文件
  const docGroups = OUTPUT_CATEGORIES
    .map((key) => ({
      key,
      label: OUTPUT_CATEGORY_CONFIGS[key].label,
      docs: OUTPUT_CATEGORY_CONFIGS[key].docs.filter((doc) => active.docs.includes(doc)),
    }))
    .filter((group) => group.docs.length > 0);

  const { currentStep, showResult, next, prev, goTo, enterResult, exitResult, isFirst, isLast } = useWizardNavigation(steps.length);
  const { selectedDocs, setSelectedDocs, generating, download } = useDocumentGeneration();
  // 接線（無循環）：autoSave 存檔後通知 reminder 算變化量；匯出後通知 reminder 重設 baseline
  const reminder = useExportReminder();
  const { saveStatus, lastSavedAt } = useAutoSave({ onSaved: reminder.onSaved });
  const { handleExport, handleImport } = useImportExport({ onExported: reminder.markExported });
  useAutoGantt();

  const hasData = form.formState.isDirty;
  useUnsavedChangesGuard(hasData);

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

  // 群組 checkbox 是單純的 toggle：只管「這一群」自己，不動其他群已選的文件。
  // 全勾 → 取消這群；沒全勾（含半勾）→ 補齊這群。
  const toggleDocGroup = useCallback((docs: DocId[]) => {
    setSelectedDocs((prev) => {
      const hasAllGroupDocs = docs.every((doc) => prev.includes(doc));

      if (hasAllGroupDocs) {
        // 已全勾 → 把這群的文件從選取中移除（保留其他群）
        return prev.filter((doc) => !docs.includes(doc));
      }

      // 未全勾 → 補齊這群（用 Set 去重，避免和已選的重複）
      return Array.from(new Set([...prev, ...docs]));
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
    <Layout style={{
      minHeight: '100vh',
      // 專注模式：整個內容背景換成較深的暖灰「畫布」，讓白色主卡片像一張放在書桌上的稿紙
      //（Google Docs／Word 的寫作隱喻）。一般模式維持 token 的 colorBgLayout (#F7F5F0)
      ...(focusMode ? { background: '#EBE6DE' } : {}),
    }}>
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
          <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
          <Button
            icon={focusMode ? <ExpandOutlined /> : <CompressOutlined />}
            type={focusMode ? 'primary' : 'default'}
            ghost={focusMode}
            onClick={toggleFocusMode}
            title="專注模式：收起側邊導覽與提示，只留當前步驟的填寫欄位"
          >
            專注模式
          </Button>
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
        {!showResult ? (
          <div
            style={{
              display: 'grid',
              // 專注模式：單欄；否則桌機雙欄（左導覽 + 右表單）、行動單欄
              gridTemplateColumns: focusMode ? '1fr' : (isDesktop ? '260px minmax(0, 1fr)' : '1fr'),
              gap: 20,
              alignItems: 'start',
            }}
          >
            {!focusMode && (
            <div style={{ position: isDesktop ? 'sticky' : 'static', top: 88 }}>
              <Card
                title="申請流程"
                style={{
                  marginBottom: 16,
                  borderColor: '#D9D4CC',
                  boxShadow: '0 8px 20px rgba(86, 74, 59, 0.05)',
                }}
              >
                <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                  <Space wrap size={8}>
                    <Tag color="blue">{planConfig.label}</Tag>
                    <Tag color="default">{steps.length} 個填寫步驟</Tag>
                    <Tag color="default">{active.docs.length} 份文件</Tag>
                  </Space>
                  <Text type="secondary">{planConfig.description}</Text>
                  <Steps
                    orientation="vertical"
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
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Text>已完成步驟：{currentStep} / {steps.length - 1}</Text>
                  <Text>目前位置：{currentStepDef.title}</Text>
                  <Text type="secondary">點左側流程可以直接切換步驟。</Text>
                  {/* 加油打氣：依目前進度顯示不同的鼓勵語（文案集中在 data/encouragements.ts） */}
                  <div style={{ marginTop: 4, padding: '8px 10px', background: '#F0EDE8', borderRadius: 6 }}>
                    <Text style={{ fontSize: 13, color: '#564A3B' }}>
                      {getProgressEncouragement(currentStep, steps.length)}
                    </Text>
                  </div>
                </Space>
              </Card>
            </div>
            )}

            <Card
              variant="borderless"
              // 專注模式：內距加大留白，讓填寫區更透氣，像一張安靜的稿紙
              styles={focusMode ? { body: { padding: '40px 56px' } } : undefined}
              style={{
                minHeight: 560,
                // 專注模式拿掉卡片陰影（不再像儀表板裡浮起的卡），改靠背景畫布的對比凸顯「稿紙」
                boxShadow: focusMode ? 'none' : '0 10px 28px rgba(86, 74, 59, 0.08)',
                // 專注模式：單欄時把主卡片置中、改純白稿紙底。寬度對齊一般模式右側填寫欄
                //（≈1440 容器扣掉左側 260 導覽 + 間距），讓填字區跟平常一樣寬、不縮水
                ...(focusMode ? { maxWidth: 1120, margin: '0 auto', width: '100%', background: '#FFFFFF' } : {}),
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
                {/* 專注模式：用精簡水平步驟條取代左側整塊導覽，保留定位與跳轉能力 */}
                {focusMode && (
                  <Steps
                    orientation="horizontal"
                    size="small"
                    current={currentStep}
                    onChange={goTo}
                    items={steps.map((step) => ({ title: step.title }))}
                  />
                )}
                {!focusMode && (
                  <Space wrap size={8}>
                    <Tag color="blue">第 {currentStep + 1} 步</Tag>
                    {currentStepDocs.map((doc) => (
                      <Tag key={doc} color="default">{doc}</Tag>
                    ))}
                  </Space>
                )}
                <div>
                  <Title level={2} style={{ margin: 0 }}>{currentStepDef.title}</Title>
                  <Text type="secondary" style={{ fontSize: 15 }}>
                    {currentStepConfig.hint}
                  </Text>
                </div>
                {!focusMode && (
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
                )}
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
              {/* 完成頁慰勞句（文案集中在 data/encouragements.ts） */}
              <div style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 14, color: '#564A3B' }}>{RESULT_ENCOURAGEMENT}</Text>
              </div>
            </div>

            <div style={{ background: '#F0EDE8', borderRadius: 8, padding: 24, marginBottom: 24 }}>
              <h4>選擇要產生的文件</h4>
              <Collapse
                ghost
                items={docGroups.map((group) => ({
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
