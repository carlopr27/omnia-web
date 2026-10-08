(() => {
  "use strict";

  const CONFIG = window.REMENTO_CONFIG || {};
  const API_URL = String(CONFIG.API_URL || "").trim();
  const MAX_SECONDS = Number(CONFIG.MAX_RECORDING_SECONDS || 180);

  // MVP 0.1: intentionally modest capture settings to keep a 3-minute
  // talking-head recording small enough for the simple Apps Script/Base64 path.
  const VIDEO_BITS_PER_SECOND = 400_000;
  const AUDIO_BITS_PER_SECOND = 48_000;

  const FALLBACK_QUESTIONS = [
    { id: "Q001", question: "¿Cuál es uno de tus primeros recuerdos de infancia?", featured: true },
    { id: "Q002", question: "¿Cómo era la casa donde creciste?", featured: false },
    { id: "Q003", question: "¿Qué recuerdas con más cariño de tus abuelos?", featured: false }
  ];

  const $ = (id) => document.getElementById(id);
  const views = [...document.querySelectorAll(".view")];

  let questions = [...FALLBACK_QUESTIONS];
  let currentQuestion = FALLBACK_QUESTIONS[0].question;
  let stream = null;
  let recorder = null;
  let chunks = [];
  let recordedBlob = null;
  let recordedUrl = null;
  let recordingStartedAt = 0;
  let timerId = null;

  function showView(id) {
    views.forEach((view) => view.classList.toggle("active", view.id === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function ensureApiConfigured() {
    if (!API_URL || API_URL.includes("PASTE_YOUR")) {
      throw new Error("Falta pegar la URL /exec de Apps Script en config.js.");
    }
  }

  async function apiGet(params) {
    ensureApiConfigured();
    const url = new URL(API_URL);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    url.searchParams.set("_", String(Date.now()));
    const response = await fetch(url.toString(), { cache: "no-store", redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Error de Apps Script");
    return data;
  }

  async function apiPost(payload) {
    ensureApiConfigured();
    // text/plain avoids an unnecessary CORS preflight. JSON remains intact,
    // including + / = characters in standard Base64.
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Error de Apps Script");
    return data;
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Number(totalSeconds) || 0);
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(Math.floor(seconds % 60)).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function formatBytes(bytes) {
    const mb = Number(bytes || 0) / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  function chooseMimeType() {
    const candidates = [
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4"
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
  }

  function setQuestion(question) {
    currentQuestion = String(question || "").trim() || "Cuéntame un recuerdo importante para ti.";
    $("questionText").textContent = currentQuestion;
    $("recordQuestionText").textContent = currentQuestion;
    $("reviewQuestionText").textContent = currentQuestion;
  }

  function pickQuestion(different = false) {
    const pool = questions.length ? questions : FALLBACK_QUESTIONS;
    let picked = pool.find((item) => item.featured) || pool[0];
    if (different) {
      const alternatives = pool.filter((item) => item.question !== currentQuestion);
      const source = alternatives.length ? alternatives : pool;
      picked = source[Math.floor(Math.random() * source.length)];
    }
    setQuestion(picked.question);
  }

  async function loadQuestions() {
    try {
      const data = await apiGet({ action: "listQuestions" });
      if (Array.isArray(data.questions) && data.questions.length) questions = data.questions;
    } catch (error) {
      console.warn("Questions sheet unavailable; using local fallback.", error);
    }
    pickQuestion(false);
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert("Este navegador no soporta grabación web. Usa una versión reciente de Chrome, Edge o Safari.");
      return;
    }

    cleanupRecording();
    showView("recordView");
    $("cameraPlaceholder").classList.remove("hidden");
    $("recordHint").textContent = "Preparando cámara y micrófono…";
    $("recordBtn").disabled = true;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640, max: 640 },
          height: { ideal: 360, max: 480 },
          frameRate: { ideal: 24, max: 24 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });

      $("cameraPreview").srcObject = stream;
      $("cameraPlaceholder").classList.add("hidden");
      $("recordBtn").disabled = false;
      $("recordHint").textContent = "Máximo 3 minutos";
    } catch (error) {
      console.error("getUserMedia failed", error);
      alert("No se pudo abrir la cámara o el micrófono. Revisa los permisos del navegador.");
      goHome();
    }
  }

  function stopStream() {
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    $("cameraPreview").srcObject = null;
  }

  function startRecording() {
    if (!stream) return;

    chunks = [];
    const mimeType = chooseMimeType();
    const options = {
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND
    };
    if (mimeType) options.mimeType = mimeType;

    try {
      recorder = new MediaRecorder(stream, options);
    } catch (error) {
      console.warn("Recorder options rejected, falling back to browser defaults.", error);
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = (event) => console.error("MediaRecorder error", event.error || event);
    recorder.onstop = finishRecording;

    recorder.start(1000);
    recordingStartedAt = Date.now();
    $("recordBtn").classList.add("recording");
    $("recordingBadge").classList.remove("hidden");
    $("recordHint").textContent = "Toca el botón para terminar";
    updateTimer();
    timerId = setInterval(updateTimer, 250);
  }

  function updateTimer() {
    const elapsed = Math.floor((Date.now() - recordingStartedAt) / 1000);
    $("recordTimer").textContent = formatDuration(elapsed);
    if (elapsed >= MAX_SECONDS && recorder?.state === "recording") stopRecording();
  }

  function stopRecording() {
    if (recorder?.state !== "recording") return;
    recorder.stop();
    clearInterval(timerId);
    timerId = null;
    $("recordBtn").classList.remove("recording");
    $("recordingBadge").classList.add("hidden");
    $("recordHint").textContent = "Preparando vista previa…";
  }

  function finishRecording() {
    try {
      const mimeType = recorder?.mimeType || chunks[0]?.type || "video/webm";
      recordedBlob = new Blob(chunks, { type: mimeType });
      if (!recordedBlob.size) throw new Error("La grabación no produjo datos.");

      stopStream();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      recordedUrl = URL.createObjectURL(recordedBlob);

      const preview = $("recordedPreview");
      preview.src = recordedUrl;
      preview.load();

      const seconds = Math.min(MAX_SECONDS, Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000)));
      $("recordingDuration").textContent = `Duración ${formatDuration(seconds)} · ${formatBytes(recordedBlob.size)}`;

      console.info("Recording ready", {
        bytes: recordedBlob.size,
        type: recordedBlob.type,
        requestedVideoBps: VIDEO_BITS_PER_SECOND,
        requestedAudioBps: AUDIO_BITS_PER_SECOND,
        actualVideoBps: recorder?.videoBitsPerSecond,
        actualAudioBps: recorder?.audioBitsPerSecond
      });

      showView("reviewView");
    } catch (error) {
      console.error("finishRecording failed", error);
      stopStream();
      alert(`No se pudo preparar el video. ${error.message}`);
      goHome();
    }
  }

  async function blobToBase64(blob) {
    // Use ArrayBuffer + btoa rather than DataURL splitting. This guarantees
    // the outgoing string contains only standard Base64 characters.
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const sliceSize = 0x8000;
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += sliceSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + sliceSize, bytes.length)));
    }
    return btoa(binary);
  }

  function validateBase64(base64) {
    if (!base64 || typeof base64 !== "string") throw new Error("No se generó Base64.");
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error("La conversión Base64 produjo caracteres inválidos.");
    if (base64.length % 4 !== 0) throw new Error("La conversión Base64 quedó incompleta.");
  }

  async function saveRecording() {
    if (!recordedBlob) return;
    showView("savingView");
    $("savingTitle").textContent = "Preparando video…";
    $("savingDetail").textContent = "Convirtiendo la grabación para enviarla a Google Drive.";

    try {
      const base64 = await blobToBase64(recordedBlob);
      validateBase64(base64);

      console.info("Upload payload", {
        rawBytes: recordedBlob.size,
        base64Chars: base64.length,
        estimatedBase64Bytes: new Blob([base64]).size
      });

      $("savingTitle").textContent = "Guardando en Google Drive…";
      $("savingDetail").textContent = "No cierres esta página hasta terminar.";

      const ext = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
      const result = await apiPost({
        action: "uploadVideo",
        question: currentQuestion,
        mimeType: recordedBlob.type || (ext === "mp4" ? "video/mp4" : "video/webm"),
        extension: ext,
        blobSize: recordedBlob.size,
        base64,
        recordedAt: new Date().toISOString()
      });

      renderSuccess(result.video);
      await loadVideos();
      cleanupRecording();
      toast("Video guardado en Drive");
    } catch (error) {
      console.error("saveRecording failed", error);
      alert(`No se pudo guardar el video. ${error.message}`);
      showView("reviewView");
    }
  }

  function renderSuccess(video) {
    $("successQuestion").textContent = video.question || currentQuestion;
    $("drivePlayer").src = video.previewUrl || "";
    $("openDriveBtn").href = video.driveUrl || "#";
    showView("successView");
  }

  function renderVideos(videos) {
    const list = $("memoryList");
    list.innerHTML = "";
    $("emptyMemories").style.display = videos.length ? "none" : "block";

    videos.forEach((video) => {
      const card = document.createElement("article");
      card.className = "memory-card";
      card.innerHTML = `
        <strong>${escapeHtml(video.question || "Recuerdo")}</strong>
        <small>${escapeHtml(formatDate(video.createdAt))}</small><br>
        <a href="${escapeAttribute(video.driveUrl || "#")}" target="_blank" rel="noopener">Abrir en Drive</a>
      `;
      list.appendChild(card);
    });
  }

  async function loadVideos() {
    try {
      const data = await apiGet({ action: "listVideos" });
      renderVideos(Array.isArray(data.videos) ? data.videos : []);
    } catch (error) {
      console.warn("Could not load video list", error);
      renderVideos([]);
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function cleanupRecording() {
    clearInterval(timerId);
    timerId = null;
    if (recorder?.state === "recording") {
      try { recorder.stop(); } catch (_) {}
    }
    recorder = null;
    chunks = [];
    stopStream();
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    recordedUrl = null;
    recordedBlob = null;
    $("recordBtn").classList.remove("recording");
    $("recordingBadge").classList.add("hidden");
    $("recordTimer").textContent = "00:00";
  }

  function goHome() {
    cleanupRecording();
    showView("homeView");
  }

  function wireEvents() {
    $("startCameraBtn").addEventListener("click", openCamera);
    $("anotherQuestionBtn").addEventListener("click", () => pickQuestion(true));
    $("cancelRecordBtn").addEventListener("click", goHome);
    $("reviewBackBtn").addEventListener("click", goHome);
    $("retakeBtn").addEventListener("click", openCamera);
    $("saveVideoBtn").addEventListener("click", saveRecording);
    $("successHomeBtn").addEventListener("click", goHome);
    $("recordAnotherBtn").addEventListener("click", openCamera);
    $("refreshBtn").addEventListener("click", async () => {
      await loadQuestions();
      await loadVideos();
      toast("Actualizado");
    });
    $("recordBtn").addEventListener("click", () => {
      if (recorder?.state === "recording") stopRecording();
      else startRecording();
    });
  }

  async function init() {
    wireEvents();
    setQuestion(currentQuestion);
    await Promise.allSettled([loadQuestions(), loadVideos()]);
    showView("homeView");
  }

  init();
})();
