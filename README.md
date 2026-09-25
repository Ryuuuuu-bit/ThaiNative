# ThaiNative Online – ไทยเนทีฟ ออนไลน์

เกม RPG บนเว็บเบราว์เซอร์ มุมมอง 2D Side-scroller ธีมผีไทย
สร้างด้วย **Phaser 3** (HTML5 Canvas/WebGL), JavaScript (ES Modules) และ CSS
ส่วนออนไลน์ใช้ **Node.js + Express + Socket.io**

## วิธีรัน

ต้องติดตั้ง Node.js 18 ขึ้นไป

```bash
npm install
npm start          # หรือ npm run dev (รีสตาร์ตอัตโนมัติเมื่อแก้โค้ด server)
```

จากนั้นเปิด <http://localhost:3000> ถ้าเปิดหลายแท็บหรือหลายเครื่องใน LAN (`http://<IP เครื่อง>:3000`) จะเห็นกันแบบ real-time

## ปุ่มควบคุม

| ปุ่ม | การทำงาน |
|---|---|
| ← → / A D | เดิน |
| Space / ↑ / W | กระโดด (ทะลุแพลตฟอร์มไม้ขึ้นจากด้านล่างได้) |
| J / Z (กดค้างได้) | โจมตี |
| E | คุยกับ NPC (ร้านค้าป้าแม้น) |
| C / I | หน้าต่างสถานะ / กระเป๋า |
| 1 / 2 | ดื่มยา HP / MP |
| Enter | แชท |
| Esc | ปิดหน้าต่าง |

## โครงสร้างโปรเจกต์

```
ProjectX/
├── package.json
├── server/
│   └── index.js              # Express + Socket.io (ห้องรวม, snapshot 15Hz, กันวาร์ป)
├── shared/                   # โค้ดที่ใช้ร่วม Client + Server
│   ├── constants.js          # ขนาดโลก, แรงโน้มถ่วง, อัตราส่ง network
│   ├── stats.js              # สูตร STR/DEX/INT/CRI/VIT + คำนวณดาเมจ
│   └── data/
│       ├── classes.js        # 4 อาชีพ: นักดาบ นักเวทย์ นักธนู นักมวยไทย
│       ├── appearance.js     # เพศ + ชุด 10 + ทรงผม 10 + ใบหน้า 10
│       ├── monsters.js       # ผีไทย 10 ชนิด + stats + ของดรอป
│       └── items.js          # ยา, อาวุธ, เกราะ, Skin อาชีพ, ร้านค้า NPC
└── client/
    ├── index.html            # Canvas + UI overlay (HTML)
    ├── css/style.css         # ธีม UI รักลงลายทอง
    └── js/
        ├── main.js           # ตั้งค่า Phaser
        ├── scenes/
        │   ├── BootScene.js    # สร้างภาพ/anim ทั้งหมด
        │   ├── CreateScene.js  # หน้าสร้างตัวละคร
        │   └── GameScene.js    # โลกเกม, input, network
        ├── entities/
        │   ├── Player.js       # การเคลื่อนไหว + state machine ของ animation
        │   ├── Monster.js      # AI: walker / flyer / jumper / ranged
        │   └── RemotePlayer.js # ผู้เล่นอื่น (snapshot interpolation)
        ├── systems/
        │   ├── Character.js    # โมเดลตัวละคร, EXP/เลเวล, เซฟ localStorage
        │   ├── Combat.js       # โจมตี, กระสุน, ตัวเลขดาเมจ, รางวัล
        │   ├── Inventory.js    # กระเป๋า, สวมใส่, ซื้อ-ขาย
        │   ├── UI.js           # HUD, สถานะ, กระเป๋า, ร้านค้า, แชท
        │   └── util.js
        ├── net/Network.js      # Socket.io client
        └── gfx/
            ├── CharacterArt.js # วาดตัวละคร Pixel Art (paper-doll + poses)
            ├── MonsterArt.js   # วาดผี 10 ชนิด
            └── SpriteFactory.js# แปลงภาพวาดเป็น spritesheet + Phaser animations
```

## ระบบค่าพลัง (shared/stats.js)

| ค่า | ผล |
|---|---|
| STR | พลังโจมตีกายภาพ +2 ต่อแต้ม |
| DEX | ความแม่นยำ +1% และโอกาสคริติคอล +0.4% ต่อแต้ม |
| INT | พลังเวทย์ +2.5 และ MP +6 ต่อแต้ม |
| CRI | ความแรงคริติคอล +2% ต่อแต้ม (เริ่มที่ x1.5) |
| VIT | HP สูงสุด +12 ต่อแต้ม |

ได้แต้มสถานะ 5 แต้มต่อเลเวล อัปได้ในหน้าต่างสถานะ (C)

## ระบบออนไลน์

```
Client A ──player:update (15Hz)──►  Server  ──world:snapshot (15Hz)──► ทุก Client
         ◄──world:init / player:joined / player:left / chat ──
```

- Server เก็บตำแหน่งผู้เล่นทุกคน จำกัดระยะเคลื่อนที่ต่อช่วงเวลา (กันวาร์ป) และตรวจค่ารูปลักษณ์ที่ส่งมา
- Client แสดงผู้เล่นอื่นย้อนหลัง 100ms แล้ว interpolate ระหว่าง snapshot ให้เคลื่อนที่ลื่น
- ตอนนี้มอนสเตอร์และการต่อสู้ยังคำนวณฝั่ง client (แต่ละคนเห็นผีของตัวเอง)
  ขั้นต่อไปคือย้าย AI มอนสเตอร์และการคำนวณดาเมจไปไว้ที่ server เพื่อให้ตีผีตัวเดียวกันได้และกันโกง

## ใช้ภาพจาก PixelLab แทนภาพที่วาดด้วยโค้ด

ตอนนี้ภาพทั้งหมดวาดด้วยโค้ดใน `client/js/gfx/` จึงรันได้ทันทีโดยไม่ต้องมีไฟล์ภาพ ถ้าจะเปลี่ยนเป็นภาพจาก PixelLab:

1. ให้ spritesheet เรียงเฟรมเป็นแถวเดียวตามลำดับใน `CHAR_ANIMS` หรือ `MONSTER_ANIMS`
   (เช่น ผี: walk 4 เฟรม → attack 3 → hit 1 → die 4)
2. วางไฟล์ไว้ใน `client/assets/` แล้วโหลดใน `BootScene.preload()`
3. สร้าง animation key ชื่อเดิม (`mon_krasue:walk` ฯลฯ) แทนการเรียก `bakeMonster()` ส่วนโค้ดอื่นไม่ต้องแก้
