// ============================================================
//  AuthScreen – หน้าเข้าสู่ระบบ / สมัคร / เล่นแบบ Guest (ก่อนหน้าสร้างตัวละคร)
//  คืนค่า Promise<{ account, character }>  (character = ตัวละครบน server หรือ null)
// ============================================================
import { account } from '../net/Account.js';
import { sound } from './Sound.js';
import { titleScreen } from './TitleScreen.js';
import { loadSettings } from './Settings.js';

const $ = (s) => document.querySelector(s);

export async function showAuth() {
  sound.applySettings(loadSettings());
  titleScreen.start();                 // สุ่มวอลเปเปอร์ + เพลง (เล่นต่อถึงหน้าสร้างตัวละคร)
  bindTitleControls();
  // มี token เดิม → เข้าอัตโนมัติ
  const resumed = await account.resume();
  if (resumed) return resumed;
  if (account.offline) return { account: null, character: null };       // ไม่มี server → เล่นออฟไลน์

  return new Promise((resolve) => {
    const scr = $('#auth-screen');
    scr.classList.remove('hidden');
    let mode = 'login', busy = false;
    const err = (t) => { $('#auth-err').textContent = t || ''; };
    const setMode = (m) => {
      mode = m;
      document.querySelectorAll('.auth-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
      document.querySelectorAll('.reg-only').forEach((el) => el.classList.toggle('hidden', m !== 'register'));
      $('#auth-submit').textContent = m === 'login' ? 'เข้าสู่ระบบ ▶' : 'สมัครและเริ่มเล่น ▶';
      $('#auth-pass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
      err();
    };
    document.querySelectorAll('.auth-tabs button').forEach((b) => (b.onclick = () => { sound.play('click'); setMode(b.dataset.mode); }));
    const done = (d) => { scr.classList.add('hidden'); sound.play('blessing'); resolve(d); };
    const run = async (fn) => {
      if (busy) return;
      busy = true; err();
      scr.querySelectorAll('button').forEach((b) => (b.disabled = true));
      try { done(await fn()); }
      catch (e) { err(e.status ? e.message : 'เชื่อมต่อ server ไม่ได้ ลองใหม่อีกครั้ง'); sound.play('error'); }
      finally { busy = false; scr.querySelectorAll('button').forEach((b) => (b.disabled = false)); }
    };
    $('#auth-form').onsubmit = (e) => {
      e.preventDefault();
      const u = $('#auth-user').value.trim(), p = $('#auth-pass').value;
      if (!u || !p) return err('กรอกชื่อผู้ใช้และรหัสผ่าน');
      if (mode === 'register' && p !== $('#auth-pass2').value) return err('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
      run(() => (mode === 'login' ? account.login(u, p) : account.register(u, p)));
    };
    $('#auth-guest').onclick = () => { sound.play('click'); run(() => account.guest()); };
    // พิมพ์ในช่องไม่ให้ Phaser รับปุ่ม
    scr.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
    setMode('login');
    setTimeout(() => $('#auth-user').focus(), 50);
  });
}

/** ส่วนบัญชีในหน้าต่างตั้งค่า: แสดงชื่อ / เชื่อม ID สำหรับ Guest / ออกจากระบบ */
export function bindAccountSettings(ui) {
  const render = () => {
    const a = account.account;
    $('#acc-name').textContent = a ? a.display : 'ออฟไลน์ (เซฟในเครื่อง)';
    $('#acc-badge').textContent = a ? (a.guest ? 'Guest' : 'สมาชิก') : '';
    $('#acc-badge').classList.toggle('guest', !!a?.guest);
    $('#acc-note').textContent = a?.guest
      ? 'บัญชี Guest ผูกกับเบราว์เซอร์นี้ ถ้าล้างข้อมูลเบราว์เซอร์หรือเปลี่ยนเครื่องจะเข้าไม่ได้ — กด “เชื่อม ID” เพื่อตั้งชื่อผู้ใช้/รหัสผ่าน ตัวละครเดิมอยู่ครบ'
      : a ? 'ตัวละครบันทึกบน server อัตโนมัติ เข้าเล่นจากเครื่องไหนก็ได้ด้วยชื่อผู้ใช้นี้' : '';
    $('#acc-link').classList.toggle('hidden', !a?.guest);
    $('#acc-logout').classList.toggle('hidden', !a);
    if (!a?.guest) $('#link-form').classList.add('hidden');
  };
  $('#acc-link').onclick = () => { $('#link-form').classList.toggle('hidden'); $('#link-user').focus(); };
  document.querySelectorAll('#link-form input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
  $('#link-form').onsubmit = async (e) => {
    e.preventDefault();
    $('#link-err').textContent = '';
    try {
      await account.link($('#link-user').value.trim(), $('#link-pass').value);
      ui.toast(`🔗 เชื่อม ID สำเร็จ! ครั้งหน้าเข้าด้วยชื่อ “${account.account.username}” ได้เลย`);
      sound.play('levelup');
      $('#link-pass').value = '';
      render();
    } catch (err) { $('#link-err').textContent = err.message; sound.play('error'); }
  };
  $('#acc-logout').onclick = async () => {
    if (account.isGuest && !confirm('บัญชี Guest ยังไม่ได้เชื่อม ID — ถ้าออกจากระบบจะกลับมาเล่นตัวละครนี้ไม่ได้อีก ต้องการออกจริงไหม?')) return;
    ui.scene.saveNow?.();
    await account.logout();
    location.reload();
  };
  render();
  return render;
}

/** ปุ่มชื่อฉาก (คลิก = เปลี่ยนฉาก) + ปุ่มเสียง */
function bindTitleControls() {
  const cap = $('#title-caption'), snd = $('#title-sound');
  if (!cap || snd.dataset.bound) return;
  snd.dataset.bound = '1';
  cap.onclick = () => titleScreen.next();
  const render = () => {
    snd.textContent = sound.muted ? '🔇' : '🔊';
    snd.classList.toggle('hint', !sound.muted && !(sound.ctx && sound.ctx.state === 'running'));
  };
  snd.onclick = (e) => {
    e.stopPropagation();
    if (!snd.classList.contains('hint')) sound.toggleMute();   // ยังไม่เคยเปิดเสียง → คลิกแรกแค่เปิดเสียง
    sound.init();
    setTimeout(render, 50);
  };
  snd.classList.remove('hidden');
  window.addEventListener('pointerdown', () => setTimeout(render, 80));
  window.addEventListener('keydown', () => setTimeout(render, 80), { once: true });
  render();
  titleScreen.onStop = () => snd.classList.add('hidden');
}
