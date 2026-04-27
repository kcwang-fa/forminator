// 通用的字串清單編輯器：每行一個 Input + 移除鍵 + 底部新增鍵。
// 用於資料庫卡片的「其他欄位名稱」/「中文欄位名稱」list。
// 不含商業邏輯，純 controlled component。

import { Button, Input, Space } from 'antd';

interface EditableListFieldsProps {
  values: string[];
  onChange: (value: string[]) => void;
  placeholderPrefix: string;
  addLabel: string;
}

export function EditableListFields({
  values,
  onChange,
  placeholderPrefix,
  addLabel,
}: EditableListFieldsProps) {
  const updateValue = (itemIndex: number, nextValue: string) => {
    const next = [...values];
    next[itemIndex] = nextValue;
    onChange(next);
  };

  const removeValue = (itemIndex: number) => {
    onChange(values.filter((_, idx) => idx !== itemIndex));
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={8}>
      {values.map((item, itemIndex) => (
        <div
          key={itemIndex}
          style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}
        >
          <Input
            value={item}
            onChange={(event) => updateValue(itemIndex, event.target.value)}
            placeholder={`${placeholderPrefix} ${itemIndex + 1}`}
          />
          <Button
            type="text"
            danger
            onClick={() => removeValue(itemIndex)}
            disabled={values.length <= 1}
          >
            移除
          </Button>
        </div>
      ))}
      <Button type="dashed" onClick={() => onChange([...(values || []), ''])}>
        {addLabel}
      </Button>
    </Space>
  );
}
