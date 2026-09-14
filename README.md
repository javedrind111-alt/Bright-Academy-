# Bright Academy — Talaba Intizami Nizam

A Progressive Web App (PWA) for managing madrasa/school students, teachers,
fees, attendance, sabaq (daily lesson tracking), tests, and WhatsApp bulk
messaging — backed by Firebase.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire application (UI, styles, and logic) |
| `manifest.json` | PWA manifest (app name, icons, theme colors) |
| `service-worker.js` | Offline app-shell caching |
| `icon-192.png` / `icon-512.png` | App icons |

## Deploy

This is a static site — no build step required.

### GitHub Pages
1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Set **Source** to the `main` branch, root folder.
4. Your app will be live at `https://<username>.github.io/<repo-name>/`.

### Firebase Hosting (alternative)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## Firebase Setup

The app connects to Firestore for data storage. Make sure in your Firebase
project:
1. **Authentication** → Email/Password sign-in is enabled (if you migrate to
   Firebase Auth for teacher logins — see note below).
2. **Firestore Database** → created and security rules configured.
3. The `firebaseConfig` object in `index.html` matches your project's config
   (Project Settings → General → Your apps).

> **Security note:** the current build stores teacher passwords in plain
> text inside local storage / Firestore for simplicity. Before going to
> production with real user data, migrate teacher login to Firebase
> Authentication (email/password) rather than storing raw passwords.

## Local Development

Just open `index.html` in a browser, or serve it locally to properly test
the service worker (service workers don't run on the `file://` protocol):

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
