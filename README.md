# Sit Cover — Admin Panel

Admin panel for the Sit Cover shop website (`SQLRIZWAN/sit-cover`).
Live: `https://sqlrizwan.github.io/sit-cover-admin/`

## What it does
- 🔐 Firebase Auth login (email + password)
- 📊 Dashboard — all-time & today's sales/revenue, total users, active users (5 min), website visitors, live new orders
- 🧾 Orders — filter chips, full detail, status changes, WhatsApp send (shop + customer), map link, payment screenshot
- 🗂️ Categories — website tabs: add/edit/delete, active toggle, ↑↓ reorder
- 📦 Products — per-category pages, photos/videos compressed in-browser and saved to Firebase (`media/` node, ≤6, first = cover), stock switch, edit/delete
- ⚙️ Settings — shop info, phones/WhatsApp/WAMD, map pin, distance delivery fees

Everything writes to the **same Firebase Realtime Database** as the shop website, so changes appear live on the site.

## Deploy
Push to `main` → `.github/workflows/deploy.yml` injects secrets into `js/config.js` → GitHub Pages.

### Required repo secrets (`Settings → Secrets and variables → Actions`)
| Secret | Value |
|---|---|
| `FIREBASE_CONFIG` | JSON: `{"apiKey":"…","authDomain":"…","databaseURL":"…","projectId":"…","storageBucket":"…","messagingSenderId":"…","appId":"…"}` |
| `GEMINI_API_KEY` | Google AI Studio key (used by the website's chatbot) |

Media (product photos/videos) and payment screenshots are stored in Firebase Realtime Database — no Cloudinary needed.

## First login
1. Firebase console → **Authentication → Sign-in method → Email/Password → Enable**.
2. Firebase console → **Authentication → Users → Add user** (email + password).
3. Open the site → log in with that user.

## Local preview
`js/config.js` is generated in CI — fill it manually for local testing, or just rely on the deployed Pages site.

## Rules
`database.rules.json` must be pushed to the Firebase Realtime Database (any authed admin user can write; public can only read config/categories/products and create new orders).
