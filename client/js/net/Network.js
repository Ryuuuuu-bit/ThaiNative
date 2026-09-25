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
  emitLocal(evt, data) { this.handlers[evt]?.(data); }

  connect(name, appearance) {
    if (typeof window.io !== 'function') {
      console.warn('[Network] socket.io client not found → offline mode');
      this.emitLocal('status', false);
      return;
    }
    const s = (this.socket = window.io({ transports: ['websocket', 'polling'], reconnectionDelay: 1500 }));

    s.on('connect', () => {
      s.emit('player:join', { name, appearance });
      this.emitLocal('status', true);
    });
    s.on('disconnect', () => this.emitLocal('status', false));
    s.on('connect_error', () => this.emitLocal('status', false));

    s.on('world:init', (d) => { this.selfId = d.selfId; this.emitLocal('init', d); });
    s.on('player:joined', (p) => this.emitLocal('joined', p));
    s.on('player:left', (id) => this.emitLocal('left', id));
    s.on('player:appearance', (d) => this.emitLocal('appearance', d));
    s.on('world:snapshot', (snap) => {
      // ตัดตัวเองออก เหลือแต่ผู้เล่นอื่น
      snap.players = snap.players.filter((p) => p.id !== this.selfId);
      this.emitLocal('snapshot', snap);
    });
    s.on('chat', (m) => this.emitLocal('chat', m));
  }

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
}
