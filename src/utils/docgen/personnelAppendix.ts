// ===== 附表一/二/三 placeholder 準備（DOC-2 personnel_appendix loop）=====
//
// 對應 scripts/inject-doc2.cjs 的 {#personnel_appendix}...{/personnel_appendix}。
// 動 pa_* key 名稱會直接弄壞 DOC-2 模板渲染，請務必對齊 inject-doc2.cjs。
//
// ROLE_LABEL 故意和 docgenMaps.ts 的 ROLE_MAP 用語不同：
//   - 此處 pi='主持人'（IRB-018 表格慣用語，附表一用）
//   - ROLE_MAP   pi='計畫主持人'（DOC-9 簽呈慣用語）
// 不要為了 DRY 強行合併。

import type { FormData } from '../../types/form';

const ROLE_LABEL: Record<string, string> = {
  pi: '主持人', co_pi: '協同主持人', researcher: '研究人員',
};

const GENDER_LABEL: Record<string, string> = {
  male: '男', female: '女',
};

// 附表三（著作清單）的空值預設。
// why：官方範本明文要求「若無此資料，請填無此資料」，留空的表格送出會被退件。
//      與附表二「無此資料」(pa_no_pi_proj) 的呈現方式一致，避免某一格空白看起來像漏填。
// how：使用者沒填、或只打了空白字元時，自動帶入「無此資料」；有填則原樣保留。
const NO_PUBLICATIONS_TEXT = '無此資料';

const toProj = (proj: FormData['personnel'][0]['projects'][0]) => ({
  proj_name:     proj.project_name,
  proj_role:     proj.role,
  proj_budget:   proj.budget || '無',
  proj_funder:   proj.funder,
  proj_start_ym: proj.start_ym,
  proj_end_ym:   proj.end_ym,
});

export function preparePersonnelAppendix(data: FormData) {
  const members = data.personnel.filter(p => ['pi', 'co_pi', 'researcher'].includes(p.role));

  return {
    personnel_appendix: members.map(p => {
      const piProjects = (p.projects || []).filter(proj => proj.role === '主持人' && !!proj.budget);
      const completed  = (p.projects || []).filter(pr => pr.status === 'completed');
      const ongoing    = (p.projects || []).filter(pr => pr.status === 'ongoing');
      const pending    = (p.projects || []).filter(pr => pr.status === 'pending');

      return {
        pa_role_label:   ROLE_LABEL[p.role] || p.role,
        pa_name_zh:      p.name_zh,
        pa_gender_label: GENDER_LABEL[p.gender] || '',
        pa_birth_date:   p.birth_date || '',
        pa_education: (p.education || []).map(e => ({
          edu_degree:    e.degree === '其他' ? (e.degree_other || '其他') : (e.degree || ''),
          edu_school:    [e.school, e.department].filter(Boolean).join(' '),
          edu_grad_year: e.grad_year || '',
        })),
        pa_work_history: (p.work_history || []).map(wh => ({
          wh_institution: wh.institution,
          wh_title:       wh.title,
          wh_start_ym:    wh.start_ym,
          wh_end_ym:      wh.end_ym,
        })),
        pa_completed:    completed.map(toProj),
        pa_no_completed: completed.length === 0,
        pa_ongoing:      ongoing.map(toProj),
        pa_no_ongoing:   ongoing.length === 0,
        pa_pending:      pending.map(toProj),
        pa_no_pending:   pending.length === 0,
        pa_has_pi_proj:     piProjects.length > 0,
        pa_no_pi_proj:      piProjects.length === 0,
        pa_pi_proj_name:    piProjects[0]?.project_name || '',
        pa_pi_proj_pi:      p.name_zh,
        pa_pi_proj_funder:  piProjects[0]?.funder || '',
        pa_pi_proj_period:  piProjects[0] ? `${piProjects[0].start_ym}～${piProjects[0].end_ym}` : '',
        pa_pi_proj_budget:  piProjects[0]?.budget || '',
        pa_pi_proj_summary: piProjects[0]?.summary || '',
        pa_publications_text: (p.publications || '').trim() || NO_PUBLICATIONS_TEXT,
      };
    }),
    personnel_appendix_count: members.length,
  };
}
