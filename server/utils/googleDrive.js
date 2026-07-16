// Google Drive resume storage. Files are uploaded into the folder identified
// by GOOGLE_DRIVE_FOLDER_ID using a personal Google account's OAuth 2.0
// refresh token (no service account, no shared Drive required). Firestore
// stores only the five stable file-reference fields returned below — this
// is unchanged from the previous implementation, so existing candidate
// records with these fields keep working exactly as before.
const { Readable } = require('stream');
const { google } = require('googleapis');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';

function credentials() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_DRIVE_FOLDER_ID } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN || !GOOGLE_DRIVE_FOLDER_ID) {
    const error = new Error('Google Drive is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, and GOOGLE_DRIVE_FOLDER_ID.');
    error.code = 'DRIVE_NOT_CONFIGURED';
    throw error;
  }
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, refreshToken: GOOGLE_REFRESH_TOKEN, folderId: GOOGLE_DRIVE_FOLDER_ID };
}

function driveClient(creds) {
  // No redirect URI is needed here: refreshing an access token from a stored
  // refresh token never redirects anywhere — a redirect URI is only used
  // during the one-time /api/google-drive/auth -> /api/google-drive/callback
  // exchange that produces the refresh token in the first place.
  const oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
  oauth2Client.setCredentials({ refresh_token: creds.refreshToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

function safePart(value, fallback) {
  return String(value || fallback).replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || fallback;
}

function escapeQuery(value) {
  return String(value).replace(/'/g, "\\'");
}

async function availableFileName(drive, folderId, candidateName, phone) {
  const stem = `${safePart(candidateName, 'Candidate')} - ${safePart(phone, 'No Phone')} - Resume`;
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const name = suffix === 1 ? `${stem}.pdf` : `${stem} (${suffix}).pdf`;
    const result = await drive.files.list({
      q: `'${escapeQuery(folderId)}' in parents and name = '${escapeQuery(name)}' and trashed = false`,
      fields: 'files(id)', pageSize: 1, supportsAllDrives: true, includeItemsFromAllDrives: true,
    });
    if (!result.data.files?.length) return name;
  }
  throw new Error('Could not allocate a unique Google Drive file name.');
}

async function uploadResumeToDrive({ candidateName, phone, buffer }) {
  const creds = credentials();
  const drive = driveClient(creds);
  const name = await availableFileName(drive, creds.folderId, candidateName, phone);
  const result = await drive.files.create({
    requestBody: { name, parents: [creds.folderId], mimeType: 'application/pdf' },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id,webViewLink', supportsAllDrives: true,
  });
  const driveFileId = result.data.id;
  if (!driveFileId) throw new Error('Google Drive did not return a file ID.');
  return {
    driveFileId,
    driveWebViewLink: result.data.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`,
    driveDownloadLink: `https://drive.google.com/uc?export=download&id=${driveFileId}`,
    resumeFileName: name,
    uploadedAt: new Date().toISOString(),
  };
}

async function deleteResumeFromDrive(driveFileId) {
  if (!driveFileId) return;
  const creds = credentials();
  const drive = driveClient(creds);
  try {
    await drive.files.delete({ fileId: driveFileId, supportsAllDrives: true });
  } catch (err) {
    // A manually removed file is already in the desired final state.
    if (err.code !== 404) throw err;
  }
}

module.exports = { uploadResumeToDrive, deleteResumeFromDrive, DRIVE_SCOPE };
