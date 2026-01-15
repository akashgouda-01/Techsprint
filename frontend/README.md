# safe-route

Local development notes

1. Install deps: `npm install`
2. Start dev server: `npm run dev`

Firebase setup

1. Create `.env.local` in project root and add your Firebase values (see keys already present in the repo).
2. Restart the dev server after adding env vars: `npm run dev`.
3. Use the initialized clients from `src/lib/firebase.ts`:

```ts
import { auth, db, analytics } from "./src/lib/firebase";
```

The repo includes `firebase` in `package.json`; run `npm install` if not yet installed.

Deploy to Render

1. Create a Render account and connect your Git repository.
2. Add a new **Static Site**.
   - **Build Command:** `npm ci && npm run build`
   - **Publish Directory:** `dist`
3. In the Render dashboard set the environment variables (under Settings → Environment):
   - `VITE_API_BASE_URL` (e.g., `https://your-backend.onrender.com` - your backend API URL)
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
     `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
     `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`.
4. (Optional) Add the provided `render.yaml` to the repo and set the repo URL in it.

Notes:

- Do not commit secrets into the repo. Use Render's dashboard to add private env vars.
- The `dist` folder is produced by `vite build` and is served by Render as a static site.
- If you need server-side functions later, choose a Render Web Service or Background Worker instead.
