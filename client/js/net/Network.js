// ============================================================
//  Network – เชื่อมต่อ Socket.io กับ Server
//  • ส่งตำแหน่ง/ท่าทางของเรา ~15 ครั้ง/วินาที (throttle)
//  • รับ snapshot ของผู้เล่นคนอื่น แล้วส่งต่อให้ GameScene
//  • ถ้าไม่มี server (เปิดไฟล์ตรงๆ) จะทำงานแบบออฟไลน์อัตโนมัติ
// ============================================================
import { NET } from '/shared/constants.js';

export class Network {
  constructor() {
    this.socket = null;
    this.selfId = null;
    this.handlers = {};
    this.lastSent = 0;
    this.lastPayload = '';
  }

  get online() { return !!this.socket?.connected; }

  /** ลงทะเบียน callback: on('init'|'joined'|'left'|'snapshot'|'appearance'|'chat'|'status', fn) */
  on(evt, fn) { this.handlers[evt] = fn; return this; }
  get selfIdOrNull() { return this.online ? this.selfId : null; }
  emitLocal(evt, data) { this.handlers[evt]?.(data); }

  /** getInfo: () => ({ appearance, x, y }) – อ่านค่าล่าสุดทุกครั้งที่ (re)connect */
  connect(name, getInfo) {
    if (typeof window.io !== 'function') {
      console.warn('[Network] socket.io client not found → offline mode');
      this.emitLocal('status', false);
      return;
    }
    const s = (this.socket = window.io({ transports: ['websocket', 'polling'], reconnectionDelay: 1500 }));

    s.on('connect', () => {
      const info = typeof getInfo === 'function' ? getInfo() : { appearance: getInfo };
      s.emit('player:join', { name, ...info });          // ต่อใหม่ → เริ่มที่ตำแหน่งเดิม ไม่เด้งกลับหมู่บ้าน
      this.emitLocal('status', true);
    });
    s.on('disconnect', () => this.emitLocal('status', false));
    s.on('connect_error', () => this.emitLocal('status', false));

    s.on('world:init', (d) => { this.selfId = d.selfId; this.emitLocal('init', d); });
    s.on('player:joined', (p) => this.emitLocal('joined', p));
    s.on('player:left', (id) => this.emitLocal('left', id));
    s.on('player:appearance', (d) => this.emitLocal('appearance', d));
    s.on('player:warp:reject', (d) => this.emitLocal('warpReject', d));
    s.on('world:snapshot', (snap) => {
      // ตัดตัวเองออก เหลือแต่ผู้เล่นอื่น
      snap.players = snap.players.filter((p) => p.id !== this.selfId);
      this.emitLocal('snapshot', snap);
    });
    s.on('chat', (m) => this.emitLocal('chat', m));
    s.on('skill:cast', (d) => this.emitLocal('skill', d));
    s.on('mob:state', (d) => this.emitLocal('mob:state', d));
    s.on('mob:die', (d) => this.emitLocal('mob:die', d));
    s.on('mob:dmg', (d) => this.emitLocal('mob:dmg', d));
    s.on('mob:reward', (d) => this.emitLocal('mob:reward', d));
    // ระบบ MMO: ปาร์ตี้ · เทรด · เรดบอส → ส่งต่อด้วยชื่อ event เดิม
    for (const ev of ['party:invite', 'party:state', 'party:exp', 'trade:request', 'trade:state', 'trade:closed', 'trade:complete', 'trade:verify',
      'raid:state', 'raid:spawn', 'raid:attack', 'raid:impact', 'raid:dmg', 'raid:reward', 'raid:defeated']) {
      s.on(ev, (d) => this.emitLocal(ev, d));
    }
  }

  /** ส่ง event ทั่วไปไป server (ออฟไลน์ = ไม่ทำอะไร) */
  send(ev, data) { if (this.online) this.socket.emit(ev, data); }

  /** เรียกทุกเฟรม – ส่งจริงตาม NET.sendRate และเฉพาะเมื่อข้อมูลเปลี่ยน */
  sendState(time, state) {
    if (!this.online || time - this.lastSent < 1000 / NET.sendRate) return;
    const payload = JSON.stringify(state);
    if (payload === this.lastPayload && time - this.lastSent < 1000) return; // ไม่เปลี่ยน → ส่ง heartbeat ทุก 1 วิ
    this.lastSent = time;
    this.lastPayload = payload;
    this.socket.emit('player:update', state);
  }

  sendAppearance(appearance) { if (this.online) this.socket.emit('player:appearance', appearance); }
  sendChat(text) { if (this.online) this.socket.emit('chat', text); }

  /** แจ้งการใช้สกิล (ให้คนอื่นเห็น VFX)  tx,ty = ตำแหน่งเป้าหมายของสกิลแบบ strike */
  sendSkill(sk, player) {
    if (!this.online) return;
    const t = sk.type === 'strike' ? player.scene.combat.strikeTarget(player, sk) : null;
    this.socket.emit('skill:cast', {
      skillId: sk.id, lv: sk.lv, x: Math.round(player.x), y: Math.round(player.y), dir: player.facing,
      tx: t ? t.x : undefined, ty: t ? t.y : undefined,
    });
  }
}
