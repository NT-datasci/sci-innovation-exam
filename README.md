# คลังข้อสอบ SCI67-310 — เว็บฝึกทำข้อสอบ

เว็บไซต์ static ล้วน (ไม่มี build step) สำหรับฝึกทำข้อสอบเตรียมสอบปลายภาครายวิชา
**SCI67-310 นวัตกรรมและผู้ประกอบการวิทยาศาสตร์** — คลังข้อสอบ 200 ข้อ (5 ชุด ชุดละ 40 ข้อ)
พร้อมเฉลย คำอธิบาย, hint รายข้อ และคู่มือสรุปเนื้อหา

## ฟีเจอร์

- **ฝึกทำเป็นชุด** — เลือกชุด 1–5 ตรวจคำตอบและดูเฉลยได้ทันทีหลังตอบแต่ละข้อ
- **จำลองสอบจริง** — ทำครบ 40 ข้อก่อนเห็นเฉลย เลือกจับเวลาได้ (40/60/90 นาที หรือไม่จับเวลา)
- **ฝึกตามหมวด** — รวมข้อจาก 5 ชุดในหมวดเดียวกัน (Design Thinking / BMC / IP &amp; Patent / Pitch Deck)
- **สุ่มทบทวน** — สุ่มข้อจากทั้งคลัง 200 ข้อ
- **Hint** — คำแนะนำสั้น ๆ ต่อข้อ ดูได้ก่อนตอบ โดยไม่เฉลยตรง ๆ
- **คู่มือเตรียมสอบ** (`guide.html`) — สรุปเนื้อหา 4 หมวดหลัก + เกณฑ์การให้คะแนน/กฎของรายวิชา
- บันทึกคะแนนล่าสุดต่อชุด/หมวดไว้ใน localStorage ของเบราว์เซอร์

## โครงสร้างไฟล์

```
index.html, quiz.html, guide.html   หน้าเว็บหลัก
assets/css/styles.css                สไตล์ (รองรับ light/dark mode)
assets/js/app.js, quiz.js            ตรรกะฝั่งหน้าเว็บ
data/questions.json                  ข้อมูลข้อสอบทั้งหมด (สร้างจาก build script)
data/hints-set{1..5}.json            Hint ต้นฉบับต่อชุด ก่อน merge
scripts/build-data.mjs               Node script: parse guideline.md + merge hints → questions.json
guideline.md                         ไฟล์ต้นฉบับคลังข้อสอบ (เก็บไว้เป็น source อ้างอิง)
```

## รันดูตัวอย่างในเครื่อง

ต้องเปิดผ่าน local server (ไม่ใช่เปิดไฟล์ตรง ๆ) เพราะหน้าเว็บ `fetch()` ไฟล์ `data/questions.json`:

```bash
python3 -m http.server 8000
# แล้วเปิด http://localhost:8000
```

หรือถ้ามี Node:

```bash
npx serve .
```

## การแก้ไข/เพิ่มข้อสอบ (regenerate ข้อมูล)

ถ้าแก้ไข `guideline.md` หรือไฟล์ `data/hints-set*.json` ให้รันคำสั่งนี้เพื่อสร้าง `data/questions.json` ใหม่:

```bash
node scripts/build-data.mjs
```

สคริปต์นี้ไม่ใช้ npm package ใด ๆ (pure Node) และจะ validate ว่าได้ครบ 200 ข้อ แต่ละข้อมี 4 ตัวเลือกและเฉลยครบ ก่อนเขียนไฟล์

## Deploy

เว็บไซต์ deploy อยู่ที่ **https://nt-datasci.github.io/sci-innovation-exam/** ผ่าน GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) ซึ่งจะ build และ deploy ใหม่ให้อัตโนมัติทุกครั้งที่ push เข้า branch `main`
