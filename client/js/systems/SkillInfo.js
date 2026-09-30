// ============================================================
//  SkillInfo – อธิบายวิธีคิดดาเมจ/ฮีล/บัฟของสกิล ด้วยตัวเลขจริงของตัวละคร
//  สูตรเดียวกับ server (shared/stats.js rollDamage):
//    ดาเมจต่อครั้ง = พลัง × ตัวคูณสกิล × สุ่ม(0.9–1.1) − DEF ศัตรู × (กายภาพ 50% · เวทย์ 25%)   (ขั้นต่ำ 1)
//    คริติคอล = × ดาเมจคริ · โอกาสโดน = ความแม่นยำเทียบการหลบของศัตรู
// ============================================================
const pct = (v) => `${Math.round(v * 100)}%`;
const n0 = (v) => Math.round(v).toLocaleString();
const BUFF_TH = {
  def: (v) => `ป้องกัน +${v}`, defMul: (v) => `ป้องกัน +${pct(v)}`, atkMul: (v) => `พลังโจมตี (ATK/MATK) +${pct(v)}`,
  critAdd: (v) => `โอกาสคริ +${pct(v)}`, speed: (v) => `ความเร็วเดิน +${pct(v)}`, aspd: (v) => `ความเร็วโจมตี +${pct(v)}`, cleanse: () => 'ล้างสถานะผิดปกติ',
};
const DOT_TH = { poison: 'พิษ', bleed: 'เลือดไหล', burn: 'ไฟลุก' };

/**
 * @param sk  skillStats(...) ของเลเวลที่จะแสดง
 * @param d   ค่าสถานะจาก getDerived(c) (patk, matk, critRate, critDmg)
 */
export function skillCalcHtml(sk, d, { lv = 1, next = null } = {}) {
  const rows = [];
  const kind = sk.kind || 'physical';
  const power = kind === 'magic' ? d.matk : kind === 'best' ? Math.max(d.patk, d.matk) : d.patk;
  const pName = kind === 'magic' ? 'MATK' : kind === 'best' ? (d.matk > d.patk ? 'MATK' : 'ATK') : 'ATK';
  if (sk.mult) {
    const per = power * sk.mult;
    const hits = (sk.hits || 1), count = sk.count || 1, bounces = sk.bounces || 0;
    rows.push(`<b>ประเภท:</b> ${kind === 'magic' ? '🔮 เวทย์ · ใช้ MATK · โดนเสมอไม่สนหลบ · ทะลุเกราะ (DEF ศัตรูมีผลแค่ 25%)' : kind === 'best' ? '⚡ ผสม · ใช้ค่าที่สูงกว่าระหว่าง ATK/MATK' : '⚔️ กายภาพ · ใช้ ATK (DEF ศัตรูหักออก 50%)'}`);
    rows.push(`<b>ต่อครั้ง:</b> ${pName} ${n0(power)} × ${pct(sk.mult)} = <em>${n0(per)}</em> <small>(สุ่ม ${n0(per * 0.9)}–${n0(per * 1.1)})</small>`);
    const shape = sk.type === 'aoe' || sk.type === 'mortar' ? `โดนทุกตัวในรัศมี ${sk.radius}px` : sk.pierce ? 'ทะลุทุกตัวในแนว' : sk.type === 'bounce' ? `เด้งต่อได้ ${bounces} เป้า` : sk.all ? 'โดนทุกตัวตรงหน้า' : sk.type === 'dash' ? `พุ่ง ${sk.distance}px ชนตัวแรก` : 'เป้าเดียว';
    const times = hits * count;
    rows.push(`<b>จำนวนครั้ง:</b> ${hits > 1 ? `${hits} จังหวะ` : ''}${hits > 1 && count > 1 ? ' × ' : ''}${count > 1 ? `${count} ลูก` : ''}${times === 1 ? '1 ครั้ง' : ` = สูงสุด ${times} ครั้ง/เป้า`} · ${shape}`);
    if (times > 1) rows.push(`<b>รวมสูงสุดต่อเป้า:</b> ≈ <em>${n0(per * times)}</em> <small>(${pct(sk.mult * times)} ของ ${pName})</small>`);
    rows.push(`<b>หักเกราะ:</b> − DEF ศัตรู × ${kind === 'magic' ? '25%' : '50%'} ต่อครั้ง (ต่ำสุด 1)`);
    rows.push(`<b>คริติคอล:</b> โอกาส ${pct(d.critRate || 0)} → ดาเมจ × ${(d.critDmg || 1.5).toFixed(2)}`);
  }
  if (sk.hmult) {
    const hp = d.healPow || 1, h = d.matk * hp * sk.hmult;
    const extra = sk.type === 'tether' ? ` ทุก ${(sk.tick / 1000).toFixed(1)} วิ นาน ${(sk.duration / 1000).toFixed(0)} วิ (ใกล้ ≤${sk.near}px ×${sk.nearMul})`
      : sk.type === 'seed' ? ` หลัง ${(sk.delay / 1000).toFixed(0)} วิ หรือทันทีเมื่อ HP ต่ำกว่า ${pct(sk.lowHp)}`
      : sk.type === 'bounce' ? ` ต่อคน (เด้ง ${sk.bounces} คน)` : sk.perHit ? ` ต่อครั้ง +${pct(sk.perHit)}/ผีที่โดน (สูงสุด +${pct(sk.perMax)})` : '';
    rows.push(`<b>ฟื้นเลือดเพื่อน:</b> MATK ${n0(d.matk)}${hp > 1 ? ` × พลังรักษา ${pct(hp)}` : ''} × ${pct(sk.hmult)} = <em>${n0(h)}</em>${extra}`);
  }
  if (sk.heal && typeof sk.heal === 'number') rows.push(`<b>ฟื้น HP:</b> ${pct(sk.heal)} ของ HP สูงสุด${sk.party ? ' (ทุกคนในปาร์ตี้ในรัศมี)' : ''}${sk.mpHeal ? ` · MP ${pct(sk.mpHeal)}` : ''}`);
  if (sk.buff) {
    const list = Object.entries(sk.buff).map(([k, v]) => BUFF_TH[k]?.(v)).filter(Boolean);
    if (list.length) rows.push(`<b>บัฟ${sk.party ? 'ปาร์ตี้' : 'ตัวเอง'}:</b> ${list.join(' · ')} นาน ${((sk.duration || 0) / 1000).toFixed(0)} วิ${sk.party ? ` (รัศมี ${sk.radius}px)` : ''}`);
  }
  if (sk.undying) rows.push(`<b>ขวัญกันตาย:</b> เพื่อนที่ฟื้นจะไม่ตาย (HP เหลือ 1) นาน ${(sk.undying / 1000).toFixed(0)} วิ`);
  const eff = sk.effect || {};
  if (eff.stun) rows.push(`<b>ติดมึน:</b> ${(eff.stun.ms / 1000).toFixed(1)} วิ — ผีหยุดเดินและหยุดตี (บอสติดครึ่งเวลา)`);
  for (const [k, th] of Object.entries(DOT_TH)) if (eff[k]) { const P = eff[k]; rows.push(`<b>${th}:</b> ${P.ticks} ครั้ง ทุก ${(P.every / 1000).toFixed(1)} วิ ครั้งละ ${pct(P.ratio)} ของดาเมจที่โดน (รวมเพิ่ม ${pct(P.ratio * P.ticks)})`); }
  if (eff.slow) rows.push(`<b>เชื่องช้า:</b> ผีเดินช้าลง ${pct(eff.slow.pct)} นาน ${(eff.slow.ms / 1000).toFixed(1)} วิ (บอสครึ่งเวลา)`);
  if (eff.armorBreak) rows.push(`<b>เกราะแตก:</b> DEF ผี −${pct(eff.armorBreak.pct)} นาน ${(eff.armorBreak.ms / 1000).toFixed(0)} วิ (บอสครึ่งเวลา)`);
  if (eff.weak) rows.push(`<b>อ่อนแรง:</b> ผีตีเบาลง ${pct(eff.weak.pct)} นาน ${(eff.weak.ms / 1000).toFixed(0)} วิ (บอสครึ่งเวลา)`);
  if (sk.type === 'dash') rows.push('<b>พุ่ง:</b> อมตะชั่วครู่ระหว่างพุ่ง (0.3 วิ)');
  rows.push(`<b>MP ${sk.mp} · คูลดาวน์ ${(sk.cd / 1000).toFixed(1)} วิ</b>${sk.mastery ? ` <small>(รวมชำนาญขั้น ${sk.mastery}: แรง +${sk.mastery * 2}% · CD −${sk.mastery}%)</small>` : ''}`);
  if (next?.mult && sk.mult) rows.push(`<span class="nx">→ Lv.${lv + 1}: ตัวคูณ ${pct(next.mult)} (ต่อครั้ง ≈ ${n0(power * next.mult)}) · MP ${next.mp} · CD ${(next.cd / 1000).toFixed(1)} วิ</span>`);
  rows.push('<small class="grow">ต่อเลเวลสกิล: ตัวคูณ +15% · MP +10% · คูลดาวน์ −4% · บัฟ/ฮีลนานขึ้น +10%</small>');
  return `<ul class="sk-calc-list">${rows.map((r) => `<li>${r}</li>`).join('')}</ul>`;
}
