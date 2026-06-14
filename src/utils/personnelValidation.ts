import type { Personnel } from '../types/form';

export interface PersonnelValidation {
  piCandidates: Personnel[];
  duplicateNames: string[];
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, '').trim();
}

export function validatePersonnel(personnel: Personnel[]): PersonnelValidation {
  const piCandidates = personnel.filter((person) => person.role === 'pi');
  const nameCounts = new Map<string, number>();
  const displayNames = new Map<string, string>();

  for (const person of personnel) {
    const normalized = normalizeName(person.name_zh || '');
    if (!normalized) continue;
    nameCounts.set(normalized, (nameCounts.get(normalized) || 0) + 1);
    displayNames.set(normalized, person.name_zh.trim());
  }

  const duplicateNames = [...nameCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([name]) => displayNames.get(name) || name);

  return { piCandidates, duplicateNames };
}

export function requireSinglePi(personnel: Personnel[]): Personnel {
  const { piCandidates } = validatePersonnel(personnel);
  if (piCandidates.length === 0) {
    throw new Error('研究團隊中沒有計畫主持人，請將一位人員的角色設為「計畫主持人」');
  }
  if (piCandidates.length > 1) {
    const names = piCandidates.map((person) => person.name_zh || '未填姓名').join('、');
    throw new Error(`研究團隊中有 ${piCandidates.length} 位計畫主持人（${names}）；同一計畫只能有一位，請先修正角色再生成文件`);
  }
  return piCandidates[0];
}
