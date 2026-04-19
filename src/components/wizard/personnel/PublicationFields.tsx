import { Controller } from 'react-hook-form';
import { Input } from 'antd';
import { useFormStore } from '../../../hooks/useFormStore';

export function PublicationFields({ personIndex }: { personIndex: number }) {
  const { control } = useFormStore();
  return (
    <div>
      <Controller
        name={`personnel.${personIndex}.publications`}
        control={control}
        render={({ field: f }) => (
          <Input.TextArea
            {...f}
            // Array.isArray guard: 舊版草稿的 publications 可能為 Publication[]，防止 crash
            value={Array.isArray(f.value) ? '' : (f.value ?? '')}
            rows={5}
            placeholder={'逐筆填寫，每筆著作一行，例：\nChiou C-S, Hong Y-P, Liao Y-S, et al. New multidrug-resistant Salmonella enterica serovar Anatum clone, Taiwan, 2015–2017. Emerg Infect Dis. 2019;25(1).'}
          />
        )}
      />
      <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
        若無相關著作，請填「無」（附表三將顯示此內容）
      </div>
    </div>
  );
}
