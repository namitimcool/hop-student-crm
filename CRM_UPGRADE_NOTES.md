# Recruitment CRM upgrade notes

This release preserves the existing React/Vite frontend, Express/Render API,
Firebase Authentication, Firestore data, OCR, and deployment configuration.
No existing routes were removed.

## Added files

- `server/routes/settings.js` — stores the workspace candidate pipeline in
  Firestore (`settings/workspace`).
- `server/utils/googleDrive.js` — Google Drive service-account resume upload
  and deletion helper.
- `CRM_UPGRADE_NOTES.md` — this deployment and Git handoff record.

## Modified flows

- **Candidates:** the full recruitment stage list, scorecard sliders,
  recommendations, follow-up metadata, pinned notes, candidate-created and
  stage-change activity records.
- **Dashboard:** added-today, screened, upcoming-follow-up and
  overdue-follow-up metrics.
- **Companies:** richer commercial/company fields plus unlimited contact
  records in `companyContacts`.
- **Sharing:** duplicate candidate/company/position submissions are rejected;
  shares support result, offer, joining date and remarks.
- **Payments:** invoice creation and received payments create candidate
  timeline entries.
- **Settings:** pipeline stages can be added or removed and are used by the
  candidate form and profile after save.
- **Resumes:** imported PDFs and replacements are stored in the configured
  Drive folder; Drive failures do not block OCR or candidate creation.

## Firestore additions

Existing data remains valid. New optional fields are additive and do not
require a migration. New collections/documents are:

- `settings/workspace`
- `companyContacts`

## Deployment checks

Render needs no new environment variables. Cloudflare Pages needs no new
environment variables. Deploy the backend and frontend from the same commit;
the frontend's new Settings requests require the new `/api/settings` backend
route.
