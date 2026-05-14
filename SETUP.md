# Volta Voucher — Setup Guide

## Tech Stack
- **Frontend**: HTML + Tailwind CSS (CDN) + Vanilla JS
- **Backend**: Google Apps Script (GAS) Web App
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (receipts)
- **Email**: GAS MailApp (Gmail)

---

## Step 1 — Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New project
2. Open **SQL Editor** → paste and run `supabase/schema.sql`
3. Go to **Storage** → New bucket → name: `receipts` → set **Public**
4. Go to **Settings → API** → copy:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **service_role** key (secret key, NOT anon)

---

## Step 2 — Google Apps Script Setup

1. Go to [script.google.com](https://script.google.com) → New project
2. Name it **Volta Voucher Backend**
3. Create the following `.gs` files and paste content from `gas/` folder:

   | File | Description |
   |------|-------------|
   | `Code.gs` | Main router (replaces default `Code.gs`) |
   | `Database.gs` | Supabase REST client |
   | `Auth.gs` | Login / session |
   | `Vouchers.gs` | Voucher logic |
   | `Admin.gs` | Admin operations |
   | `Email.gs` | Email notifications |
   | `Utils.gs` | Helpers, code generation |

4. Set **Script Properties** (`Project Settings → Script Properties`):

   | Key | Value |
   |-----|-------|
   | `SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `SUPABASE_SERVICE_KEY` | `eyJ...` (service_role key) |
   | `ADMIN_EMAIL` | `admin@yourcompany.com` |
   | `APP_URL` | URL where you host the frontend |

5. **Deploy as Web App**:
   - `Deploy → New deployment → Web App`
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Copy the deployment URL

6. **Create first Admin user** — run once manually:
   - In GAS editor, select function `setupAdminUser` → Run
   - Default credentials: `admin@volta.com` / `Admin@1234`
   - **Change password immediately after first login!**

---

## Step 3 — Frontend Configuration

Edit `js/config.js` — replace the placeholder values:

```js
const CONFIG = {
  GAS_URL:          'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  SUPABASE_URL:     'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY:'YOUR_ANON_KEY',   // anon key (public, safe for frontend)
  ...
};
```

---

## Step 4 — Host the Frontend

The frontend is plain HTML — host it anywhere:

| Option | How |
|--------|-----|
| **GitHub Pages** | Push to repo → enable Pages |
| **Netlify** | Drag & drop the folder |
| **Firebase Hosting** | `firebase deploy` |
| **Google Drive** | Share `index.html` publicly (limited) |

After hosting, update `APP_URL` in GAS Script Properties to the final URL.

---

## Project Structure

```
web app/
├── index.html              # Login page
├── user/
│   ├── dashboard.html      # User dashboard
│   ├── vouchers.html       # Create & manage vouchers
│   ├── account.html        # Profile & notifications
│   └── help.html           # Usage guide
├── admin/
│   ├── dashboard.html      # Admin overview
│   ├── vouchers.html       # Approve / reject vouchers
│   ├── users.html          # User management
│   └── help.html           # Admin guide
├── gas/
│   ├── Code.gs             # API router
│   ├── Database.gs         # Supabase client
│   ├── Auth.gs             # Authentication
│   ├── Vouchers.gs         # Voucher operations
│   ├── Admin.gs            # Admin operations
│   ├── Email.gs            # Email notifications
│   └── Utils.gs            # Voucher code generator
├── js/
│   ├── config.js           # !! Edit this first !!
│   ├── auth.js             # Session management
│   ├── api.js              # GAS API wrapper
│   └── utils.js            # UI helpers
├── css/
│   └── custom.css          # Theme & components
├── assets/
│   └── logo.png            # App logo
└── supabase/
    └── schema.sql          # Database schema
```

---

## Voucher Code Format

```
1 e X 1 D G 0 1 n a N r y X 2 v
      ^       ^ ^
      |       | └─ Lot number (positions 7-8, 01-99)
      |       └─── Random chars
      └─────────── Value character (position 3)
```

### Value Character Map

| Char | Value (THB) |
|------|-------------|
| T | 1 |
| A | 10 |
| B | 20 |
| C | 50 |
| X | 100 |
| D | 200 |
| E | 300 |
| Y | 500 |
| Z | 1,000 |
| W | 5,000 |
| F | 99 |
| G | 88 |
| H | 1,129 |
| O | Other |

---

## CSV Export Format

```csv
code,value_thb,expire_date,Duration
1eX1DG01naNryX2v,100,2026-06-30,0
2fY2EH02mbOszW3w,100,2026-06-30,0
```

---

## Logo

Place the Volta Voucher logo file at `assets/logo.png`.  
Recommended size: 320×125 px (2.56:1 ratio), transparent background.

---

## Default Login

| Field | Value |
|-------|-------|
| Email | `admin@volta.com` |
| Password | `Admin@1234` |

> ⚠️ Run `setupAdminUser()` in GAS first, then change the password immediately.
