# Memora / Remento-style MVP — Front + Google Drive

This version intentionally has:

- No login
- No member ID
- No PIN
- No AssemblyAI yet
- No Make/Zapier
- One creator experience
- Family share links as presentation-only MVP links

## What works

1. GitHub Pages homepage with memory questions loaded dynamically from the Google Sheet `Questions` tab.
2. Browser camera + microphone recording.
3. The browser creates **one video file with an audio track already embedded**.
4. Preview / retake before saving.
5. Video uploads to Google Apps Script and is stored in Google Drive.
6. Apps Script creates a Google Sheet to index memories.
7. The frontend lists saved memories.
8. Each memory displays the Drive video player.
9. You can paste a manual transcript and a manually written story.
10. Title, transcript and story are saved to the Google Sheet.
11. A family-view link hides editing controls.

## Important: video vs audio

For this MVP we record ONE MediaStream obtained with:

```js
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
```

`MediaRecorder` records both tracks into the same video file (`.webm` on most browsers, with `.mp4` fallback where supported).

You do **not** need a second audio file for transcription. Most transcription systems can accept the video file itself because the audio track is embedded. If later you specifically want an audio-only copy, we can either:

- record a second audio-only MediaRecorder stream in parallel, or
- extract audio later in a proper backend.

For this simple MVP, keeping only the video is cleaner.

---

# 1. Apps Script setup

1. Go to https://script.google.com and create a new standalone Apps Script project.
2. Replace the default code with `apps-script/Code.gs`.
3. Save.
4. From the function dropdown, choose `setupMvp` and run it once.
5. Approve Drive + Sheets permissions.
6. Open **Execution log**. It will show:
   - the Drive folder created for videos
   - the Google Sheet created as the simple database

The script stores those IDs in Script Properties automatically.

## Deploy as Web App

1. Click **Deploy → New deployment**.
2. Type: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Deploy.
6. Copy the URL ending in `/exec`.

When you modify `Code.gs`, create a new deployment version or edit the deployment so the `/exec` version contains your latest code.

---

# 2. Connect the frontend

Open `config.js` and change:

```js
API_URL: "PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE"
```

to the `/exec` URL from Apps Script.

Example:

```js
API_URL: "https://script.google.com/macros/s/XXXXX/exec"
```

---

# 3. GitHub Pages

Create a new GitHub repository and upload these files to the repository root:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

Do NOT upload the `apps-script` folder to GitHub if you do not want the backend source there. It contains no API key, so it is not secret, but it is not required by GitHub Pages.

Then:

1. GitHub repository → **Settings**.
2. **Pages**.
3. Deploy from branch.
4. Branch: `main`, folder `/ (root)`.
5. Save.
6. Open the generated HTTPS GitHub Pages URL.

HTTPS is important because browsers only expose camera and microphone APIs in secure contexts.

---

# 4. Test sequence

Use a short first test, around 15–20 seconds.

1. Open the GitHub Pages URL.
2. Tap **Grabar mi respuesta**.
3. Allow camera and microphone.
4. Record 15–20 seconds.
5. Stop.
6. Preview it.
7. Tap **Guardar recuerdo**.
8. The file should appear in the `Memora_MVP_Videos` Drive folder.
9. The memory should appear on the homepage.
10. Open it.
11. Paste a test transcript.
12. Add a title and story.
13. Save text.
14. Refresh and confirm everything remains.
15. Press **Compartir** and open the copied URL in another browser/private window.

---

# 5. Current MVP limitations

### Size

The product-facing recording limit is now:

- **3 minutes per video**

There is no MB limit shown to the user. The current Apps Script transport still has an internal safety guard because the video is encoded in Base64 before upload. At the bitrate used by the frontend, a normal 3-minute recording should remain comfortably below it.

### Drive sharing

Apps Script attempts to set each video to:

`Anyone with link → Viewer`

This is necessary for a family member to watch the Drive preview without logging in. Some Google Workspace administrators can block link sharing.

### Family link is not authentication

The `?memory=...&view=family` URL hides editing controls, but there is no security layer. This is intentional for the MVP. Anyone who has the link can potentially view the memory, and a technically knowledgeable user could alter the URL/UI.

### iPhone/browser formats

The code tests supported MediaRecorder MIME types and prefers WebM, with MP4 fallback. Browser support can vary, which is why the first real device tests should be:

- iPhone Safari
- Android Chrome
- desktop Chrome

---

# 6. Next step after this works

Do not add AssemblyAI yet.

First validate this exact loop:

**Question → Record → Preview → Save to Drive → Library → Open memory → Manual transcript/story → Family link**

Once that works reliably, AssemblyAI can replace only the manual transcript/story step. The rest of the product stays essentially the same.


# 7. Edit questions from Google Sheets

Run `setupMvp()` with the updated `Code.gs`. The database spreadsheet will contain a tab named `Questions` with these columns:

| id | question | active | featured | sortOrder |
|---|---|---|---|---|
| Q001 | ¿Cuál es uno de tus primeros recuerdos de infancia? | TRUE | TRUE | 1 |
| Q002 | ¿Cómo era la casa donde creciste? | TRUE | FALSE | 2 |

How it works:

- Edit the **question** cell to change the wording.
- Add a new row to add another question.
- Set **active = FALSE** to hide a question without deleting it.
- Set **featured = TRUE** on one question to make it the default question shown when the page opens.
- Use **sortOrder** to control the order of the active question list.
- The **Otra pregunta** button rotates among active questions.
- Refresh/reopen the GitHub page after changing the Sheet to load the newest questions.

The HTML does not need to be edited when questions change. Apps Script exposes `?action=listQuestions`, and the frontend reads the current active questions from that endpoint.
