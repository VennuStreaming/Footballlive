# FootballLive V10 — Deployment

## Opsi yang disiapkan
Blueprint `render.yaml` menyiapkan Node web service + persistent disk untuk SQLite. Ini penting karena filesystem Render default bersifat ephemeral. Untuk skala lebih besar, migrasikan database ke PostgreSQL.

## Render
1. Upload repository ke GitHub.
2. Di Render, buat service dari repository.
3. Jika memakai Blueprint, gunakan `render.yaml`.
4. Isi secret:
   - SESSION_SECRET
   - ADMIN_EMAIL
   - ADMIN_PASSWORD
   - API_FOOTBALL_KEY
5. Deploy.
6. Pastikan `/health` mengembalikan JSON `ok: true`.
7. Tambahkan custom domain setelah aplikasi berhasil live.

Render mendukung environment variables/secrets, dan web service dapat menggunakan start command `npm start`. Untuk data persisten, gunakan managed Postgres/Key Value atau persistent disk; persistent disk tersedia pada web service berbayar.

## Railway
V10 juga dapat dijalankan sebagai Node service di Railway. Railway menyediakan PostgreSQL dan DATABASE_URL melalui environment variables. Untuk produksi berskala lebih besar, gunakan PostgreSQL dan ubah layer database aplikasi dari SQLite ke PostgreSQL.

## Monetisasi
Jangan memasukkan API key iklan langsung ke source control. Untuk AdSense, situs harus memiliki konten orisinal, memenuhi kebijakan, dan Anda harus dapat mengakses HTML situs. Pastikan konten streaming/video yang ditampilkan memiliki hak/izin.

## Sebelum publik
- Domain + HTTPS
- Privacy Policy dan Terms disesuaikan dengan praktik nyata
- Backup database
- Monitoring
- Rate limiting
- API quota monitoring
- Hash password
- Jangan commit `.env`
- Gunakan hanya stream resmi/berizin
