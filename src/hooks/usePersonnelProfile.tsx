// ===== 人員 Profile 匯出／匯入 Hook =====

import { useCallback, useRef, useState } from 'react';
import { message, Modal, Select, Form } from 'antd';
import { useFormStore } from './useFormStore';
import { exportPersonnelProfile, importPersonnelProfile } from '../utils/exportImport';
import { emptyPersonnel } from '../data/defaults';
import type { Personnel, PersonnelRole } from '../types/form';

const ROLE_OPTIONS = [
  { value: 'pi',         label: '計畫主持人' },
  { value: 'co_pi',      label: '協同主持人' },
  { value: 'researcher', label: '研究人員' },
];

export function usePersonnelProfile() {
  const { getValues, setValue } = useFormStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingProfile, setPendingProfile] = useState<Omit<Personnel, 'role'> | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<PersonnelRole>('researcher');

  // ===== 匯出 =====
  const handleExportProfile = useCallback((person: Personnel) => {
    exportPersonnelProfile(person);
    message.success(`已匯出 ${person.name_zh || '人員'} 的 Profile`);
  }, []);

  // ===== 匯入：選擇檔案 =====
  const triggerImport = useCallback(() => {
    if (!fileInputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const profile = await importPersonnelProfile(file);
        if (!profile) {
          message.error('Profile 格式不正確，請確認是否為人員 Profile JSON');
          return;
        }
        setPendingProfile(profile.personnel);
        setSelectedRole('researcher');
        setRoleModalOpen(true);
      };
      fileInputRef.current = input;
    }
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  }, []);

  // ===== 匯入：確認角色後加入人員清單 =====
  const confirmImport = useCallback(() => {
    if (!pendingProfile) return;
    const current = getValues('personnel');
    const newPerson: Personnel = {
      ...emptyPersonnel,
      ...pendingProfile,
      role: selectedRole,
    };
    setValue('personnel', [...current, newPerson], { shouldDirty: true });
    setRoleModalOpen(false);
    setPendingProfile(null);
    message.success(`已匯入 ${newPerson.name_zh || '人員'} 為${ROLE_OPTIONS.find(o => o.value === selectedRole)?.label}`);
  }, [pendingProfile, selectedRole, getValues, setValue]);

  // ===== Modal 元件（inline，避免多餘檔案）=====
  const RoleSelectModal = (
    <Modal
      title={`匯入人員：${pendingProfile?.name_zh || ''} 請選擇角色`}
      open={roleModalOpen}
      onOk={confirmImport}
      onCancel={() => { setRoleModalOpen(false); setPendingProfile(null); }}
      okText="確認匯入"
      cancelText="取消"
    >
      <Form layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item label="匯入為" required>
          <Select
            value={selectedRole}
            onChange={setSelectedRole}
            options={ROLE_OPTIONS}
            style={{ width: '100%' }}
          />
        </Form.Item>
        {pendingProfile && (
          <div style={{ color: '#666', fontSize: 13 }}>
            <div>姓名：{pendingProfile.name_zh}</div>
            <div>職稱：{pendingProfile.title}　單位：{pendingProfile.unit}</div>
          </div>
        )}
      </Form>
    </Modal>
  );

  return {
    handleExportProfile,
    triggerImport,
    RoleSelectModal,
  };
}
