# FootballLive V8 — Guest First

V8 mengubah pengalaman website menjadi **Guest First**:
- Pengunjung langsung melihat live score/jadwal tanpa login.
- Login/register hanya opsional untuk fitur favorit.
- Admin tetap wajib login.
- Password pengguna sudah di-hash dengan bcrypt.
- Helmet dan rate limiting dasar ditambahkan.
- Session cookie lebih aman saat production/HTTPS.
- API-Football tetap dipanggil dari server sehingga API key tidak ditaruh di browser.
- Tersedia robots.txt dan sitemap.xml.
- Slot iklan/sponsor dikelola dari `/admin.html`.

## Jalankan
1. Install Node.js 20+.
2. Extract ZIP.
3. `npm install`
4. Salin `.env.example` menjadi `.env`.
5. Isi `API_FOOTBALL_KEY`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
6. `npm start`
7. Buka `http://localhost:3000`

## Catatan production
Untuk peluncuran publik, gunakan HTTPS, session store persisten (bukan MemoryStore), database PostgreSQL/managed DB bila skala meningkat, backup, logging, validasi input lebih ketat, dan kebijakan privasi/terms. Jangan menayangkan stream sepak bola tanpa hak/izin; gunakan embed atau sumber resmi/berlisensi.

## V9 additions
- Guest-first remains the default.
- Quick navigation cards for Live, leagues and favorites.
- League Center page with standings and top scorers.
- Team Center page with team statistics.
- PWA manifest + service worker for installable/mobile-friendly behavior.
- Expanded portal-style homepage.

## V10 production preparation
- Configurable database path
- `/health` endpoint for hosting health checks
- Global API rate limiting
- Privacy Policy + Terms templates
- Render Blueprint with persistent disk
- Deployment and monetization checklist
