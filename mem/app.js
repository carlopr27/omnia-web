(() => {
  const CONFIG = window.REMENTO_CONFIG || {};
  const API_URL = CONFIG.API_URL || "";
  const MAX_SECONDS = Number(CONFIG.MAX_RECORDING_SECONDS || 180);

  // Fallback only. The normal source of questions is the Google Sheet "Questions".
  const FALLBACK_QUESTIONS = [
    { id: "Q001", question: "¿Cuál es uno de tus primeros recuerdos de infancia?", active: true, featured: true, sortOrder: 1 },
    { id: "Q002", question: "¿Cómo era la casa donde creciste?", active: true, featured: false, sortOrder: 2 },
    { id: "Q003", question: "¿Qué recuerdas con más cariño de tus abuelos?", active: true, featured: false, sortOrder: 3 }
  ];

  const $ = (id) => document.getElementById(id);
  const views = [...document.querySelectorAll(".view")];

  let currentQuestion = "";
  let questions = [...FALLBACK_QUESTIONS];
  let stream = null;
  let recorder = null;
  let chunks = [];
  let recordedBlob = null;
  let recordedUrl = null;
  let recordingStartedAt = 0;
  let timerId = null;
  let currentMemory = null;
  let memories = [];
  let isFamilyView = false;

  function showView(id) {
    views.forEach(v => v.classList.toggle("active", v.id === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function pickQuestion(forceDifferent = false) {
    const active = questions.filter(q => q.active !== false && String(q.question || "").trim());
    const pool = active.length ? active : FALLBACK_QUESTIONS;

    let selected;
    if (!forceDifferent) {
      selected = pool.find(q => q.featured) || pool[0];
    } else {
      const alternatives = pool.filter(q => q.question !== currentQuestion);
      const source = alternatives.length ? alternatives : pool;
      selected = source[Math.floor(Math.random() * source.length)];
    }

    currentQuestion = selected?.question || "Cuéntame un recuerdo importante para ti.";
    $("questionText").textContent = currentQuestion;
    $("recordQuestionText").textContent = currentQuestion;
    $("reviewQuestionText").textContent = currentQuestion;
  }

  async function loadQuestions() {
    try {
      const result = await apiGet({ action: "listQuestions" });
      if (Array.isArray(result.questions) && result.questions.length) {
        questions = result.questions;
      }
    } catch (err) {
      console.warn("Using fallback questions because Questions sheet could not be loaded:", err);
    }
    pickQuestion(false);
  }

  function formatDuration(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function chooseMimeType() {
    const candidates = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4"
    ];
    return candidates.find(type => window.MediaRecorder && MediaRecorder.isTypeSupported(type)) || "";
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert("Este navegador no soporta grabación desde la web. Prueba con una versión reciente de Safari o Chrome.");
      return;
    }

    showView("recordView");
    $("recordBtn").disabled = true;
    $("recordHint").textContent = "Preparando cámara…";

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      $("cameraPreview").srcObject = stream;
      $("cameraPlaceholder").classList.add("hidden");
      $("recordBtn").disabled = false;
      $("recordHint").textContent = `Máximo ${Math.round(MAX_SECONDS / 60)} minutos`;
    } catch (err) {
      console.error(err);
      $("recordHint").textContent = "No pudimos acceder a cámara o micrófono.";
      alert("Necesitamos permiso de cámara y micrófono para grabar el recuerdo.");
    }
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    $("cameraPreview").srcObject = null;
  }

  function startRecording() {
    if (!stream) return;
    chunks = [];
    const mimeType = chooseMimeType();
    const options = {
      videoBitsPerSecond: 520000,
      audioBitsPerSecond: 64000
    };
    if (mimeType) options.mimeType = mimeType;

    recorder = new MediaRecorder(stream, options);
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
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
    const seconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
    $("recordTimer").textContent = formatDuration(seconds);
    if (seconds >= MAX_SECONDS && recorder?.state === "recording") stopRecording();
  }

  function stopRecording() {
    if (recorder?.state === "recording") recorder.stop();
    clearInterval(timerId);
    timerId = null;
    $("recordBtn").classList.remove("recording");
    $("recordingBadge").classList.add("hidden");
  }

  function finishRecording() {
    try {
      const mimeType = recorder?.mimeType || chunks[0]?.type || "video/webm";
      recordedBlob = new Blob(chunks, { type: mimeType });

      if (!recordedBlob.size) {
        throw new Error("La grabación terminó sin datos de video.");
      }

      // Stop the live camera only after MediaRecorder has finished producing the file.
      stopStream();

      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      recordedUrl = URL.createObjectURL(recordedBlob);

      const preview = $("recordedPreview");
      preview.src = recordedUrl;
      preview.load();

      const seconds = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000));
      $("recordingDuration").textContent = `Duración ${formatDuration(seconds)}`;

      showView("reviewView");
    } catch (err) {
      console.error("Error al preparar la grabación:", err);
      stopStream();
      alert(`No se pudo preparar el video grabado. ${err.message}`);
      goHome();
    }
  }

  async function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || "");
        resolve(result.includes(",") ? result.split(",")[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function apiPost(payload) {
    ensureApiConfigured();
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Error en Apps Script");
    return data;
  }

  async function apiGet(params) {
    ensureApiConfigured();
    const url = new URL(API_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set("_", Date.now().toString());
    const response = await fetch(url.toString(), { redirect: "follow", cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || "Error en Apps Script");
    return data;
  }

  function ensureApiConfigured() {
    if (!API_URL || API_URL.includes("PASTE_YOUR")) {
      throw new Error("Primero pega el URL /exec de Apps Script en config.js");
    }
  }

  async function saveRecording() {
    if (!recordedBlob) return;
    showView("savingView");
    $("savingTitle").textContent = "Subiendo tu video a Google Drive…";
    $("savingDetail").textContent = "No cierres esta página hasta terminar.";

    try {
      const base64 = await blobToBase64(recordedBlob);
      const ext = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
      const result = await apiPost({
        action: "uploadMemory",
        question: currentQuestion,
        mimeType: recordedBlob.type || (ext === "mp4" ? "video/mp4" : "video/webm"),
        extension: ext,
        base64,
        recordedAt: new Date().toISOString()
      });

      recordedBlob = null;
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      recordedUrl = null;
      await loadMemory(result.memory.id, false);
      await loadLibrary();
      toast("Recuerdo guardado en Drive");
    } catch (err) {
      console.error(err);
      alert(`No se pudo guardar el video. ${err.message}`);
      showView("reviewView");
    }
  }

  function makeDefaultTitle(memory) {
    return memory.title?.trim() || "Recuerdo sin título";
  }

  function renderLibrary() {
    const grid = $("memoryGrid");
    grid.innerHTML = "";
    $("memoryCount").textContent = memories.length ? `${memories.length} ${memories.length === 1 ? "recuerdo" : "recuerdos"}` : "";
    $("libraryState").style.display = memories.length ? "none" : "block";

    memories.forEach(memory => {
      const card = document.createElement("article");
      card.className = "memory-card";
      card.innerHTML = `
        <div class="memory-thumb"><span>▶ Video</span></div>
        <div class="memory-card-body">
          <h3>${escapeHtml(makeDefaultTitle(memory))}</h3>
          <p>${escapeHtml(memory.question || "")}</p>
          <p style="margin-top:10px">${escapeHtml(formatDate(memory.createdAt))}</p>
        </div>`;
      card.addEventListener("click", () => loadMemory(memory.id, false));
      grid.appendChild(card);
    });
  }

  async function loadLibrary() {
    try {
      const result = await apiGet({ action: "listMemories" });
      memories = result.memories || [];
      renderLibrary();
    } catch (err) {
      console.error(err);
      $("libraryState").style.display = "block";
      $("libraryState").textContent = err.message;
    }
  }

  async function loadMemory(id, familyMode) {
    isFamilyView = !!familyMode;
    document.body.classList.toggle("family-view", isFamilyView);
    showView("savingView");
    $("savingTitle").textContent = "Abriendo recuerdo…";
    $("savingDetail").textContent = "";

    try {
      const result = await apiGet({ action: "getMemory", id });
      currentMemory = result.memory;
      renderMemory(currentMemory);
      showView("memoryView");
    } catch (err) {
      console.error(err);
      alert(`No se pudo abrir el recuerdo. ${err.message}`);
      goHome();
    }
  }

  function renderMemory(memory) {
    $("memoryDate").textContent = formatDate(memory.createdAt).toUpperCase();
    $("memoryTitle").textContent = makeDefaultTitle(memory);
    $("memoryQuestion").textContent = `“${memory.question || ""}”`;
    $("drivePlayer").src = memory.previewUrl || "";

    const story = (memory.story || "").trim();
    const transcript = (memory.transcript || "").trim();
    $("storyRead").textContent = story || "Aún no hay una historia escrita.";
    $("storyRead").classList.toggle("empty-copy", !story);
    $("transcriptRead").textContent = transcript || "Aún no hay una transcripción.";
    $("transcriptRead").classList.toggle("empty-copy", !transcript);

    $("titleInput").value = memory.title || "";
    $("storyInput").value = memory.story || "";
    $("transcriptInput").value = memory.transcript || "";
    $("textSaveStatus").textContent = "";
  }

  async function saveText() {
    if (!currentMemory) return;
    $("saveTextBtn").disabled = true;
    $("textSaveStatus").textContent = "Guardando…";
    try {
      const result = await apiPost({
        action: "updateMemoryText",
        id: currentMemory.id,
        title: $("titleInput").value.trim(),
        story: $("storyInput").value.trim(),
        transcript: $("transcriptInput").value.trim()
      });
      currentMemory = result.memory;
      renderMemory(currentMemory);
      $("textSaveStatus").textContent = "Guardado";
      await loadLibrary();
    } catch (err) {
      console.error(err);
      $("textSaveStatus").textContent = "Error al guardar";
      alert(err.message);
    } finally {
      $("saveTextBtn").disabled = false;
    }
  }

  async function shareMemory() {
    if (!currentMemory) return;
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("memory", currentMemory.id);
    url.searchParams.set("view", "family");
    try {
      await navigator.clipboard.writeText(url.toString());
      toast("Link familiar copiado");
    } catch {
      window.prompt("Copia este link:", url.toString());
    }
  }

  function setTab(tab) {
    const story = tab === "story";
    $("storyTab").classList.toggle("active", story);
    $("transcriptTab").classList.toggle("active", !story);
    $("storyPanel").classList.toggle("active", story);
    $("transcriptPanel").classList.toggle("active", !story);
  }

  function formatDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat("es-MX", { day:"numeric", month:"long", year:"numeric" }).format(d);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[c]));
  }

  function goHome() {
    stopRecording();
    stopStream();
    document.body.classList.remove("family-view");
    isFamilyView = false;
    currentMemory = null;
    const clean = new URL(window.location.href);
    clean.search = "";
    history.replaceState({}, "", clean.toString());
    showView("homeView");
    loadLibrary();
  }

  function wireEvents() {
    $("anotherQuestionBtn").addEventListener("click", () => pickQuestion(true));
    $("startCameraBtn").addEventListener("click", openCamera);
    $("cancelRecordBtn").addEventListener("click", goHome);
    $("homeBtn").addEventListener("click", goHome);
    $("refreshBtn").addEventListener("click", async () => {
      await loadQuestions();
      await loadLibrary();
      toast("Preguntas y recuerdos actualizados");
    });

    $("recordBtn").addEventListener("click", () => {
      if (recorder?.state === "recording") stopRecording();
      else startRecording();
    });

    $("reviewBackBtn").addEventListener("click", openCamera);
    $("retakeBtn").addEventListener("click", openCamera);
    $("saveVideoBtn").addEventListener("click", saveRecording);
    $("memoryBackBtn").addEventListener("click", goHome);
    $("shareBtn").addEventListener("click", shareMemory);
    $("saveTextBtn").addEventListener("click", saveText);
    $("storyTab").addEventListener("click", () => setTab("story"));
    $("transcriptTab").addEventListener("click", () => setTab("transcript"));
  }

  async function init() {
    wireEvents();
    await loadQuestions();
    const params = new URLSearchParams(window.location.search);
    const memoryId = params.get("memory");
    const familyMode = params.get("view") === "family";
    if (memoryId) await loadMemory(memoryId, familyMode);
    else {
      showView("homeView");
      await loadLibrary();
    }
  }

  init();
})();
