# Google Drive OAuth 2.0 Setup (personal account, no service account)

This replaces the old Google Drive **service account** upload with **OAuth 2.0**
using your own personal Google account. Resumes are uploaded straight into a
folder in your personal Drive. Nothing else in the CRM changes — Firebase,
Firestore, OCR, authentication, and the candidate/company UI are untouched.

## What changed

- `server/utils/googleDrive.js` now authenticates with an OAuth 2.0 refresh
  token instead of a service-account key. Its exported functions
  (`uploadResumeToDrive`, `deleteResumeFromDrive`) and the Firestore fields
  they write are **identical** to before:
  `driveFileId`, `driveWebViewLink`, `driveDownloadLink`, `resumeFileName`, `uploadedAt`.
- Two new routes exist purely to help you generate the refresh token once:
  `GET /api/google-drive/auth` and `GET /api/google-drive/callback`. They are
  not called anywhere else in the app.
- Old env vars removed from the Drive upload flow: `GOOGLE_PROJECT_ID`,
  `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`.
- New env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`.
  `GOOGLE_DRIVE_FOLDER_ID` stays the same — just point it at a folder in
  **your** Drive instead of one shared with a service account.

Existing candidates that already have `driveFileId` / `driveWebViewLink` /
`driveDownloadLink` / `resumeFileName` / `uploadedAt` in Firestore keep
working — the field names and the CRM UI didn't change, only how the server
authenticates to Drive.

## Step 1 — Create an OAuth 2.0 Client ID

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   (create or pick a project — it doesn't need to be the same one as any
   Firebase project).
2. **APIs & Services → Library** → enable the **Google Drive API**.
3. **APIs & Services → OAuth consent screen** → set it up as **External**,
   add yourself as a **Test user** (this is enough — you don't need to submit
   for verification since only you will use it).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized redirect URIs**, add the callback URL for wherever
     you'll run this flow, e.g.:
     - `http://localhost:4000/api/google-drive/callback` (local)
     - `https://your-app.onrender.com/api/google-drive/callback` (Render)
5. Copy the generated **Client ID** and **Client secret**.

## Step 2 — Get a refresh token

You only need to do this once, and it's easiest locally:

1. In `server/.env`, set:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_DRIVE_FOLDER_ID=your-drive-folder-id
   ```
   (Leave `GOOGLE_REFRESH_TOKEN` blank for now — it isn't needed to run this step.)
2. Start the server: `cd server && npm run dev`
3. Open **http://localhost:4000/api/google-drive/auth** in your browser.
4. Sign in with the **personal Google account** that owns the target Drive
   folder, and approve the requested Drive access.
5. You'll land on the callback page, which prints something like:
   ```
   Google Drive connected successfully.

   Copy this value into GOOGLE_REFRESH_TOKEN ...

   1//09abc...xyz
   ```
6. Copy that value into `GOOGLE_REFRESH_TOKEN` in `server/.env`, then restart
   the server.

If the callback page says no `refresh_token` was returned, it's usually
because Google already granted this app access before and won't re-issue one
silently. Fix it by removing the app's access at
[myaccount.google.com/permissions](https://myaccount.google.com/permissions)
and visiting `/api/google-drive/auth` again.

## Step 3 — Find your Drive folder ID

Open the target folder in Google Drive; the ID is the part of the URL after
`/folders/`, e.g. for
`https://drive.google.com/drive/folders/1OWVc042UmR2O9NwHLCnxs_Elyx4OxQXN`
the folder ID is `1OWVc042UmR2O9NwHLCnxs_Elyx4OxQXN`.

## Step 4 — Render environment variables

In the Render dashboard, on the backend service's **Environment** tab, set
exactly these four (remove `GOOGLE_PROJECT_ID`, `GOOGLE_CLIENT_EMAIL`, and
`GOOGLE_PRIVATE_KEY` if they're still there from the old service-account setup):

| Key | Value |
|---|---|
| `GOOGLE_CLIENT_ID` | from Step 1 |
| `GOOGLE_CLIENT_SECRET` | from Step 1 |
| `GOOGLE_REFRESH_TOKEN` | from Step 2 |
| `GOOGLE_DRIVE_FOLDER_ID` | from Step 3 |

If you'd rather generate the refresh token directly against the deployed
Render URL instead of localhost, add
`https://your-app.onrender.com/api/google-drive/callback` as an authorized
redirect URI in Step 1, deploy with `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/
`GOOGLE_DRIVE_FOLDER_ID` set, then visit
`https://your-app.onrender.com/api/google-drive/auth` once to get the token.

## Everything else is unchanged

Replacing a resume still deletes the old Drive file and uploads the new one;
deleting a candidate still deletes their Drive file too — both routes call
the same `uploadResumeToDrive` / `deleteResumeFromDrive` functions as before,
just backed by OAuth instead of a service account.
