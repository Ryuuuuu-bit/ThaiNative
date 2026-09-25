// สร้างไฟล์ shared/data/skills.json จาก skills.js (ข้อมูล 20 สกิล + ค่าทุกเลเวล)
//   node tools/export_skills.mjs
import { writeFileSync } from 'node:fs';
import { SKILLS, SKILL_SLOTS, MAX_SKILL_LV, SP_PER_LEVEL, START_SP, skillStats, reqCharLevel } from '../shared/data/skills.js';
import { JOBS } from '../shared/data/classes.js';

const out = { hotbarSlots: SKILL_SLOTS, maxSkillLevel: MAX_SKILL_LV, spPerLevel: SP_PER_LEVEL, startSp: START_SP, jobs: {} };
for (const [job, list] of Object.entries(SKILLS)) {
  out.jobs[job] = {
    nameTh: JOBS[job].nameTh,
    skills: list.map((s) => ({
      id: s.id, nameTh: s.nameTh, icon: s.icon, type: s.type, kind: s.kind ?? null, ultimate: !!s.ultimate,
      unlockLevel: s.reqLv, desc: s.desc, effect: s.effect ?? null,
      levels: Array.from({ length: MAX_SKILL_LV }, (_, i) => {
        const st = skillStats(s, i + 1);
        return { lv: i + 1, requireCharLevel: reqCharLevel(s, i + 1), mpCost: st.mp, cooldownMs: st.cd,
          damageRatio: st.mult ?? null, ...(st.duration ? { durationMs: st.duration } : {}), ...(st.heal ? { healRatio: st.heal } : {}) };
      }),
    })),
  };
}
writeFileSync(new URL('../shared/data/skills.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('wrote shared/data/skills.json', Object.values(out.jobs).reduce((n, j) => n + j.skills.length, 0), 'skills');
