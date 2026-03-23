// ===== §5.4 申請流程導引（跑關順序）=====

import { Steps, Card, Tag, Space, Typography } from 'antd';
import { MailOutlined, PhoneOutlined, FileTextOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { workflowSteps, DOC_NAMES } from '../../data/defaults';

const { Text, Link } = Typography;

export default function WorkflowGuide() {
  return (
    <div style={{ marginTop: 32 }}>
      <Card title="📋 申請流程導引（跑關順序）" style={{ borderColor: '#1677ff' }}>
        <Steps
          direction="vertical"
          current={-1}
          items={workflowSteps.map((step) => ({
            title: (
              <Text strong style={{ fontSize: 16 }}>
                {step.title}
              </Text>
            ),
            description: (
              <div style={{ paddingBottom: 16 }}>
                <p style={{ margin: '8px 0' }}>{step.description}</p>

                <Space wrap style={{ marginBottom: 8 }}>
                  <Text type="secondary">所需文件：</Text>
                  {step.documents.map((doc) => (
                    <Tag key={doc} icon={<FileTextOutlined />} color="blue">
                      {doc} {DOC_NAMES[doc]}
                    </Tag>
                  ))}
                </Space>

                {step.contact && (
                  <div style={{ background: '#f6f8fa', borderRadius: 8, padding: 12, marginTop: 8 }}>
                    <Text strong>聯絡人：{step.contact.unit} {step.contact.name}</Text>
                    <br />
                    <Space style={{ marginTop: 4 }}>
                      <MailOutlined />
                      <Link href={`mailto:${step.contact.email}`}>{step.contact.email}</Link>
                    </Space>
                    <br />
                    <Space style={{ marginTop: 4 }}>
                      <PhoneOutlined />
                      <Text>{step.contact.phone}</Text>
                    </Space>
                  </div>
                )}
              </div>
            ),
            icon: <CheckCircleOutlined />,
          }))}
        />
      </Card>
    </div>
  );
}
