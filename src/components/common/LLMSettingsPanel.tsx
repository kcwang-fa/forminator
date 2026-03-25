// ===== LLM 設定面板 =====

import { Form, Input, Radio, Button, Drawer, Typography, Alert } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { LLMProvider, LLMSettings } from '../../hooks/useLLMSettings';

const { Text } = Typography;

interface Props {
  settings: LLMSettings;
  onSave: (settings: LLMSettings) => void;
}

export default function LLMSettingsPanel({ settings, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<LLMProvider>(settings.provider);
  const [apiKey, setApiKey] = useState(settings.apiKey);

  const handleOpen = () => {
    setProvider(settings.provider);
    setApiKey(settings.apiKey);
    setOpen(true);
  };

  const handleSave = () => {
    onSave({ provider, apiKey });
    setOpen(false);
  };

  return (
    <>
      <Button icon={<SettingOutlined />} onClick={handleOpen}>
        AI 設定
      </Button>
      <Drawer
        title="AI 模型設定"
        open={open}
        onClose={() => setOpen(false)}
        width={400}
        extra={
          <Button type="primary" onClick={handleSave} disabled={!apiKey.trim()}>
            儲存
          </Button>
        }
      >
        <Alert
          message="API Key 僅儲存在您的瀏覽器中，不會上傳至伺服器儲存。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form layout="vertical">
          <Form.Item label="AI 服務提供者">
            <Radio.Group
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setApiKey('');
              }}
            >
              <Radio.Button value="groq">Groq</Radio.Button>
              <Radio.Button value="gemini">Google Gemini</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label={provider === 'groq' ? 'Groq API Key' : 'Gemini API Key'}
            required
          >
            <Input.Password
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider === 'groq'
                  ? '輸入您的 Groq API Key（gsk_...）'
                  : '輸入您的 Gemini API Key'
              }
            />
          </Form.Item>

          <Text type="secondary" style={{ fontSize: 12 }}>
            {provider === 'groq' ? (
              <>使用模型：Qwen3 32B。可至 <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">Groq Console</a> 取得 API Key。</>
            ) : (
              <>使用模型：Gemini 3.1 Flash Lite。可至 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a> 取得 API Key。</>
            )}
          </Text>
        </Form>
      </Drawer>
    </>
  );
}
