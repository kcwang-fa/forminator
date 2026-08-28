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
import { isSelfProjectPi, qualifiesForAppendix2 } from '../../data/defaults';

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
    personnel_appendix: members.map((p, idx) => {
      // 附表二：計畫主持人／協同主持人／研究人員擔任該角色、且有經費的既往計畫。
      // 判定與 UI 的摘要欄顯示條件共用 qualifiesForAppendix2，兩邊不能各寫一份。
      // 範本的附表二只有一個摘要區塊，符合條件有多筆時仍只印第一筆（沿用改版前行為）。
      const appendix2Projects = (p.projects || []).filter(proj => qualifiesForAppendix2(proj.role, proj.budget));
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
        // {#pa_has_pi_proj} 在模板裡包住附表二那一組欄位（計畫名稱／主持人／補助單位／
        // 期程／經費／摘要）。餵 array 時 docxtemplater 會把它當 loop，逐筆重複整組欄位；
        // 餵 boolean 才是單純的顯示／隱藏。改餵 array 之後，同一人有多個符合條件的計畫
        // 就會全部列出，而模板 XML 一行都不用改。空陣列＝不輸出，等同原本的 false。
        pa_has_pi_proj: appendix2Projects.map(proj => ({
          pa_pi_proj_name:   proj.project_name,
          // 「計畫主持人：」欄位。
          // why：這裡填的是「那個計畫的主持人」，不是填表的這個人。本人就是主持人時
          //      使用者可以留空，由這裡帶本人姓名；本人只是協同主持人／研究人員又沒填，
          //      就留白讓他們手寫——絕不能一律帶本人姓名，那會在附表二印出不實的主持人。
          pa_pi_proj_pi:     (proj.pi_name || '').trim() || (isSelfProjectPi(proj.role) ? p.name_zh : ''),
          pa_pi_proj_funder: proj.funder,
          pa_pi_proj_period: `${proj.start_ym}～${proj.end_ym}`,
          pa_pi_proj_budget: proj.budget,
          pa_pi_proj_summary: proj.summary,
        })),
        pa_no_pi_proj: appendix2Projects.length === 0,
        pa_publications_text: (p.publications || '').trim() || NO_PUBLICATIONS_TEXT,
        // 附表一「填表人簽章」＝該人自己的簽名。沒簽則 section 不成立、欄位留白可手簽。
        // 旁邊的「計畫主持人簽章」用頂層的 pi_sig（loop 內查不到的 key，docxtemplater
        // 會自動往外層 scope 找——這是 docxtemplater 的原生行為，不用在這裡重複塞）。
        pa_has_sig: Boolean(p.signature_image),
        pa_sig:     p.signature_image || '',
        // 附表三結尾的條件分頁旗標（對應 inject-doc2.cjs 的 {#pa_not_last}）。
        // why：附表一/二在範本末尾自帶分頁符，附表三沒有；全員附表三連續輸出時
        //      若不補分頁，兩個人的著作清單會擠在同一頁。
        //      最後一位設 false，避免文件尾多出一張空白頁。
        pa_not_last: idx < members.length - 1,
      };
    }),
    personnel_appendix_count: members.length,
  };
}
