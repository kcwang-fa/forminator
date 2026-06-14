// 「是否招募研究對象」為免審與簡審共用的主問題。
// 只有選擇「是」時，才需要補充招募方式及退出機制。
//
// 簡審額外多一格「研究對象名單取得方式」（IRB-002-1／DOC-12 第 8 點（3）），對齊 DOC-12 那 5 個勾選格；
// 由 showRosterMethods prop 控制（免審 DOC-5 沒有這幾格，故預設不顯示），同樣收在「招募＝是」底下。

import { Checkbox, Form, Input, Switch } from 'antd';
import { Controller, useWatch } from 'react-hook-form';
import { useFormStore } from '../../../hooks/useFormStore';
import type { SubjectRosterMethod } from '../../../types/form';

// 名單取得方式選項（對齊 DOC-12 第 8 點（3）的 5 個勾選格順序）。
const ROSTER_METHOD_OPTIONS: { value: SubjectRosterMethod; label: string }[] = [
  { value: 'public', label: '公開招募' },
  { value: 'sampling', label: '系統性抽樣' },
  { value: 'existing_db', label: '既有資訊系統或資料庫' },
  { value: 'existing_project', label: '既有計畫的研究對象名單' },
  { value: 'other', label: '其他' },
];

export function RecruitmentFields({ showRosterMethods = false }: { showRosterMethods?: boolean }) {
  const { control } = useFormStore();
  const recruitSubjects = useWatch({ control, name: 'recruit_subjects' });
  const rosterMethods = useWatch({ control, name: 'subject_roster_methods' }) ?? [];
  const showExistingDbName = showRosterMethods && rosterMethods.includes('existing_db');
  const showExistingProjectName = showRosterMethods && rosterMethods.includes('existing_project');
  const showRosterOtherDetail = showRosterMethods && rosterMethods.includes('other');

  return (
    <>
      <Controller
        name="recruit_subjects"
        control={control}
        render={({ field }) => (
          <Form.Item
            label="是否招募研究對象"
            tooltip="若選擇「是」，請再填寫招募方式及研究對象退出機制。"
          >
            <Switch
              checked={Boolean(field.value)}
              onChange={field.onChange}
              checkedChildren="是"
              unCheckedChildren="否"
            />
          </Form.Item>
        )}
      />

      {/* 招募＝是才展開後續欄位：名單取得方式（簡審）＋ 招募方式及退出機制。 */}
      {recruitSubjects && (
        <>
          {/* 名單取得方式：簡審才顯示（對應 DOC-12 第 8 點（3）的勾選格）。 */}
          {showRosterMethods && (
            <Controller
              name="subject_roster_methods"
              control={control}
              render={({ field }) => (
                <Form.Item
                  label="研究對象名單取得方式（可複選）"
                  tooltip="勾選的項目會在產出的申請表上自動打勾；若選既有資料庫、既有計畫或其他，下面會出現對應說明欄。"
                >
                  <Checkbox.Group
                    value={field.value}
                    onChange={field.onChange}
                    options={ROSTER_METHOD_OPTIONS}
                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                  />
                </Form.Item>
              )}
            />
          )}

          {showExistingDbName && (
            <Controller
              name="subject_roster_existing_db_name"
              control={control}
              render={({ field }) => (
                <Form.Item label="既有資訊系統或資料庫名稱">
                  <Input {...field} placeholder="例：傳染病個案通報系統" />
                </Form.Item>
              )}
            />
          )}

          {showExistingProjectName && (
            <Controller
              name="subject_roster_existing_project_name"
              control={control}
              render={({ field }) => (
                <Form.Item label="既有計畫的研究對象名單">
                  <Input {...field} placeholder="請填寫既有計畫名稱或名單來源" />
                </Form.Item>
              )}
            />
          )}

          {showRosterOtherDetail && (
            <Controller
              name="subject_roster_other_detail"
              control={control}
              render={({ field }) => (
                <Form.Item label="名單取得方式其他說明">
                  <Input {...field} placeholder="請說明其他名單取得方式" />
                </Form.Item>
              )}
            />
          )}

          <Controller
            name="recruit_method"
            control={control}
            rules={{ required: '請說明招募方式及退出機制' }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="招募方式及退出機制"
                required
                validateStatus={fieldState.error ? 'error' : undefined}
                help={fieldState.error?.message}
              >
                <Input.TextArea
                  {...field}
                  rows={3}
                  placeholder="請說明如何招募研究對象，以及研究對象如何退出研究"
                />
              </Form.Item>
            )}
          />
        </>
      )}
    </>
  );
}
