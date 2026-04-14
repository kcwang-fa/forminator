// ===== §5.4 申請流程導引（跑關順序）=====

import { Steps, Card, Tag, Space, Typography } from 'antd';
import { MailOutlined, PhoneOutlined, FileTextOutlined, CheckCircleOutlined, EditOutlined } from '@ant-design/icons';
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
                  {step.refDocuments?.map((ref) => (
                    <Tag key={ref.label} icon={<FileTextOutlined />} color="default">
                      {ref.label}
                    </Tag>
                  ))}
                  {step.documents.map((doc) => (
                    <Tag key={doc} icon={<FileTextOutlined />} color="blue">
                      {DOC_NAMES[doc]}
                    </Tag>
                  ))}
                </Space>

                {step.signatureNotes && step.signatureNotes.length > 0 && (
                  <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '8px 12px', marginTop: 8 }}>
                    <Space style={{ marginBottom: 4 }}>
                      <EditOutlined style={{ color: '#d48806' }} />
                      <Text strong style={{ color: '#d48806', fontSize: 13 }}>需親簽文件</Text>
                    </Space>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                      {step.signatureNotes.map((note) => (
                        <li key={note} style={{ fontSize: 13, color: '#595959' }}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

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
