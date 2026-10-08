# Memora MVP 0.1 — GitHub Pages + Google Apps Script + Google Drive

## Scope of this version
This is intentionally only the recording/storage proof:

1. Read a question from Google Sheets.
2. Record camera + microphone together in one video.
3. Stop automatically at 3:00.
4. Preview the real recorded file in the browser.
5. Send it to Google Apps Script.
6. Apps Script saves the real `.webm` or `.mp4` file in Google Drive.
7. Store basic metadata in Google Sheets.
8. Re-open the saved file from the site.

AssemblyAI is deliberately NOT connected yet. Once this is stable, transcription is the next layer.

## Why Base64 is used in 0.1
For this proof, Base64 is the simplest bridge from a static GitHub Pages site to an Apps Script web app. It is not the long-term video architecture.

The browser records at a deliberately modest target bitrate (~400 kbps video + 48 kbps mono audio). A 3-minute answer should usually be around 10 MB before Base64, although the exact size is browser-dependent. Base64 increases payload size by roughly one third.

The frontend converts `Blob -> ArrayBuffer -> standard Base64` and validates the string BEFORE sending it. The backend validates again, decodes it, and compares the decoded byte count against the original Blob byte count. This avoids the earlier corruption caused by ambiguous/incorrect Base64 transport.

## 1. Create Apps Script backend

1. Go to script.google.com and create a new standalone project.
2. Replace the default code with `apps-script/Code.gs`.
3. Save.
4. Run `setupMvp()` manually once.
5. Accept Drive + Sheets permissions.
6. Open **Executions / Logs** and copy the created Drive folder and Sheet URLs if you want to inspect them.

`setupMvp()` creates:

- Drive folder: `Memora_MVP_0_1_Videos`
- Spreadsheet: `Memora_MVP_0_1_DB`
  - `Videos`
  - `Questions`

## 2. Edit questions
Open the `Questions` tab in the generated Sheet.

Columns:

- `id`
- `question`
- `active`
- `featured`
- `sortOrder`

To change the main question, edit the text or set another row to `featured = TRUE`.

## 3. Deploy Apps Script

1. **Deploy > New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access: **Anyone**
5. Deploy
6. Copy the URL ending in `/exec`

After every future change to `Code.gs`, create a new deployment version:

**Deploy > Manage deployments > Edit > New version > Deploy**

## 4. Configure frontend
Open `config.js` and paste the `/exec` URL:

```js
window.REMENTO_CONFIG = {
  API_URL: "https://script.google.com/macros/s/.../exec",
  MAX_RECORDING_SECONDS: 180
};
```

## 5. Publish on GitHub Pages
Upload these files to the repository root:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

Then:

**Repository > Settings > Pages > Deploy from a branch > main / root**

Camera and microphone require HTTPS, which GitHub Pages provides.

## 6. Test order
Do not begin with 3 minutes.

Test in this order:

1. 10 seconds
2. 30 seconds
3. 1 minute
4. 3 minutes

For each test confirm:

- camera works;
- microphone is present in playback;
- preview plays before upload;
- upload completes;
- a real video file appears in Drive;
- Drive preview plays the file;
- a row appears in the `Videos` sheet.

## Important MVP privacy note
`Code.gs` uses `ANYONE_WITH_LINK` for the uploaded video so GitHub can preview it without authentication. This is appropriate only for this private MVP test. Do not use this sharing model for a production family-memory product.

## If a 3-minute upload fails
Open Chrome DevTools > Console and copy:

- the `Recording ready` object;
- the `Upload payload` object;
- the full error.

That tells us whether the problem is recording size, Base64 conversion, HTTP transport, Apps Script decoding, or Drive itself.
