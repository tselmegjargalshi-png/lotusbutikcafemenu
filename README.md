# Lotus Butik Cafe · Dijital Menü

Turkish, mobile-first digital menu for **Lotus Butik Cafe by Yeliz** (Milas), with an admin panel for editing names, prices, categories, visibility and order.

| | |
|---|---|
| Public menu | https://lotusbutikcafemenu.vercel.app |
| Admin panel | https://lotusbutikcafemenu.vercel.app/admin |
| QR code | `print/menu-qr.png`, `print/menu-qr.svg` |
| Printable table card (A6) | `print/table-card-A6.pdf` |

Admin login credentials are **not** stored in this repository. The password exists here only as a scrypt hash in the `ADMIN_PASSWORD_HASH` environment variable on Vercel.

## How it works

- `public/` – static site: `index.html` (menu), `admin.html` (panel), `assets/` (CSS, JS, lotus logo).
- `api/` – Vercel Functions:
  - `GET /api/menu` – public menu (hidden items and admin-only fields removed).
  - `POST /api/login`, `POST /api/logout` – session cookie (HMAC-signed, HttpOnly, Secure, SameSite=Strict, 12 h).
  - `GET/PUT /api/admin/menu` – full menu for the panel; saving requires a valid session.
- `lib/store.js` – menu storage in a **private Vercel Blob** store (`menu.json`). Every save also writes a dated copy to `backups/`. If nothing has been saved yet, the menu falls back to `lib/seed.js`.
- `lib/seed.js` – initial menu, transcribed from the printed menu and the handwritten pastry board. Regenerate with `npm run seed` after editing `scripts/build-seed.mjs` (only needed for a full reset; normal edits happen in the admin panel).

Security: scrypt password hash, constant-time comparisons, login brute-force brake, same-origin JSON check on writes, optimistic-concurrency check (two open admin tabs can't silently overwrite each other), strict Content-Security-Policy, server-side validation of every field.

## Admin panel (Türkçe kısa kullanım)

1. `/admin` adresine gidip kullanıcı adı ve şifre ile giriş yapın.
2. Kategoriye tıklayıp açın; ürün adını, fiyatını, birimini (kg, porsiyon…) veya açıklamasını kutulara yazın.
3. **↑ ↓** ile sıralayın, **Gizle** ile menüden geçici olarak kaldırın (ör. tükendiğinde), **✕** ile silin.
4. **+ Ürün ekle** / **+ Kategori ekle** ile yeni kayıt açın.
5. **Kaydet**'e basın (veya Ctrl/⌘+S). Menü birkaç saniye içinde güncellenir.
6. Sarı **Kontrol et** etiketi: bu fiyat fotoğraftan net okunamadı. Doğruysa etikete tıklayıp onaylayın.
7. Fiyat biçimi: `150`, `500 / 750` gibi. ₺ işareti otomatik eklenir.

## Environment variables (Vercel → Project → Settings → Environment Variables)

| Name | Purpose |
|---|---|
| `ADMIN_USERNAME` | Admin username (case-insensitive) |
| `ADMIN_PASSWORD_HASH` | scrypt hash of the admin password |
| `SESSION_SECRET` | ≥ 32 random characters; changing it logs everyone out |
| `BLOB_READ_WRITE_TOKEN` | Added automatically by the connected Blob store |

### Changing the admin password

```bash
npm install
npm run hash-password -- 'Yeni-Guclu-Sifre-2026!'
```

Paste the printed `scrypt$...` value into `ADMIN_PASSWORD_HASH` on Vercel, then redeploy (Deployments → ⋯ → Redeploy).

## Local development

```bash
npm install
ADMIN_USERNAME=lotusadmin ADMIN_PASSWORD_HASH='scrypt$...' SESSION_SECRET=$(openssl rand -hex 32) npm run dev
# http://localhost:3000  (without BLOB_READ_WRITE_TOKEN the seed menu is shown and saving is disabled)
```

## QR code

`npm run qr` regenerates `print/menu-qr.png` / `.svg`. If you add a custom domain, run `npm run qr -- https://your-domain` and reprint the card (`print/table-card.html` → print to A6).

## Deploy

The Vercel project `lotusbutikcafemenu` is connected to this repository: every push to `main` deploys to production automatically.
