import {
  PoseLandmarker,
  FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;
let timerInterval = null;
let prepInterval = null;
let recordingTimeout = null;
let isRecording = false;
let isPreparing = false;
let audioContext = null;
let currentDuration = 120000;
let lastRecordingLabel = "120s";
let currentMimeType = "尚未錄影";

let poseLandmarker = null;
let poseRunning = false;
let rafId = null;
let lastVideoTime = -1;
let poseFrameCount = 0;
let poseFpsStart = 0;

const $ = (id) => document.getElementById(id);

const els = {
  subjectCode: $("subjectCode"),
  testPhase: $("testPhase"),
  cameraSelect: $("cameraSelect"),
  qualityMode: $("qualityMode"),
  refreshCamerasBtn: $("refreshCamerasBtn"),
  startCameraBtn: $("startCameraBtn"),
  stopCameraBtn: $("stopCameraBtn"),
  startRecordingBtn: $("startRecordingBtn"),
  stopRecordingBtn: $("stopRecordingBtn"),
  downloadBtn: $("downloadBtn"),
  video: $("videoPreview"),
  canvas: $("outputCanvas"),
  showSkeleton: $("showSkeleton"),
  statusOverlay: $("videoStatusOverlay"),
  timerOverlay: $("videoTimerOverlay"),
  prepOverlay: $("preCountdownOverlay"),
  timerDisplay: $("timerDisplay"),
  prepCountdown: $("prepCountdown"),
  cameraStatus: $("cameraStatus"),
  recordingStatus: $("recordingStatus"),
  downloadStatus: $("downloadStatus"),
  diagCameraLabel: $("diagCameraLabel"),
  diagRequestedMode: $("diagRequestedMode"),
  diagResolution: $("diagResolution"),
  diagFrameRate: $("diagFrameRate"),
  diagAspectRatio: $("diagAspectRatio"),
  diagMimeType: $("diagMimeType"),
  diagPoseEngine: $("diagPoseEngine"),
  diagPoseStatus: $("diagPoseStatus"),
  diagPoseFps: $("diagPoseFps"),
  diagRecordSource: $("diagRecordSource"),
  diagDetails: $("diagDetails"),
  diagRecommendation: $("diagRecommendation")
};

const ctx = els.canvas.getContext("2d");

const RECORDING_LENGTHS = { "30": 30000, "60": 60000, "120": 120000 };
const QUALITY_MODES = {
  auto: { label: "自動模式", constraints: {} },
  "640x480_30": { label: "640 × 480 / 30fps", constraints: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } } },
  "960x540_30": { label: "960 × 540 / 30fps", constraints: { width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30, max: 30 } } },
  "1280x720_30": { label: "1280 × 720 / 30fps", constraints: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } }
};

function status(el, msg, type = "info") {
  el.textContent = msg;
  el.className = `status-message ${type}`;
}

function setText(el, value) {
  if (el) el.textContent = value;
}

function fmtTime(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function selectedDuration() {
  const value = document.querySelector('input[name="recordingLength"]:checked')?.value || "120";
  return RECORDING_LENGTHS[value] || 120000;
}

function selectedLabel() {
  const value = document.querySelector('input[name="recordingLength"]:checked')?.value || "120";
  return `${value}s`;
}

function selectedQuality() {
  return QUALITY_MODES[els.qualityMode.value] || QUALITY_MODES["960x540_30"];
}

function updateTimerSize() {
  const size = document.querySelector('input[name="timerSize"]:checked')?.value || "large";
  els.timerOverlay.classList.remove("timer-normal", "timer-large");
  els.timerOverlay.classList.add(size === "normal" ? "timer-normal" : "timer-large");
}

function updateStatusOverlay(text) {
  els.statusOverlay.textContent = text;
  els.statusOverlay.classList.remove("status-idle", "status-preparing", "status-recording", "status-complete", "status-camera-off");
  if (text === "待機") els.statusOverlay.classList.add("status-idle");
  else if (text === "預備中") els.statusOverlay.classList.add("status-preparing");
  else if (text.includes("錄製中")) els.statusOverlay.classList.add("status-recording");
  else if (text.includes("錄製完成")) els.statusOverlay.classList.add("status-complete");
  else if (text.includes("未啟動")) els.statusOverlay.classList.add("status-camera-off");
}

function setPrep(text) {
  if (text) {
    els.prepOverlay.textContent = text;
    els.prepOverlay.classList.remove("hidden");
  } else {
    els.prepOverlay.textContent = "";
    els.prepOverlay.classList.add("hidden");
  }
}

function setCanvasSize() {
  const w = els.video.videoWidth || 960;
  const h = els.video.videoHeight || 540;
  if (w <= 0 || h <= 0) return false;
  if (els.canvas.width !== w || els.canvas.height !== h) {
    els.canvas.width = w;
    els.canvas.height = h;
  }
  return true;
}

function drawBase() {
  if (!setCanvasSize()) return;
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  if (els.video.readyState >= 2) {
    ctx.drawImage(els.video, 0, 0, els.canvas.width, els.canvas.height);
  }
}

function drawLandmark(lm, color, label) {
  const x = lm.x * els.canvas.width;
  const y = lm.y * els.canvas.height;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  ctx.font = "18px Arial";
  ctx.fillStyle = "#fff";
  ctx.fillText(label, x + 10, y - 8);
}

function drawLine(a, b, color) {
  ctx.beginPath();
  ctx.moveTo(a.x * els.canvas.width, a.y * els.canvas.height);
  ctx.lineTo(b.x * els.canvas.width, b.y * els.canvas.height);
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function ok(lm) {
  return lm && (lm.visibility === undefined || lm.visibility >= 0.35);
}

function drawSide(lms, side, color) {
  const idx = side === "L" ? { s: 11, e: 13, w: 15, h: 23 } : { s: 12, e: 14, w: 16, h: 24 };
  const s = lms[idx.s], e = lms[idx.e], w = lms[idx.w], h = lms[idx.h];
  if (ok(w) && ok(e)) drawLine(w, e, color);
  if (ok(e) && ok(s)) drawLine(e, s, color);
  if (ok(s) && ok(h)) drawLine(s, h, color);
  if (ok(s)) drawLandmark(s, color, `${side}肩`);
  if (ok(e)) drawLandmark(e, color, `${side}肘`);
  if (ok(w)) drawLandmark(w, color, `${side}腕`);
  if (ok(h)) drawLandmark(h, color, `${side}髖`);
}

function drawPose(results) {
  if (!els.showSkeleton.checked) return;
  const lms = results?.landmarks?.[0];
  if (!lms) {
    setText(els.diagPoseStatus, "未偵測到人體");
    return;
  }
  setText(els.diagPoseStatus, "已偵測到人體骨架");
  drawSide(lms, "L", "#00e5ff");
  drawSide(lms, "R", "#ffeb3b");
}

function showCapabilities(track) {
  const s = track.getSettings ? track.getSettings() : {};
  const c = track.getCapabilities ? track.getCapabilities() : {};
  setText(els.diagCameraLabel, track.label || "未提供名稱");
  setText(els.diagRequestedMode, selectedQuality().label);
  setText(els.diagResolution, `${s.width || "未提供"} × ${s.height || "未提供"}`);
  setText(els.diagFrameRate, s.frameRate ? `${Number(s.frameRate.toFixed(2))} fps` : "未提供");
  setText(els.diagAspectRatio, s.aspectRatio ? Number(s.aspectRatio.toFixed(3)) : (s.width && s.height ? Number((s.width / s.height).toFixed(3)) : "未提供"));
  setText(els.diagDetails, [
    `width: ${c.width ? `${c.width.min} – ${c.width.max}` : "未提供"}`,
    `height: ${c.height ? `${c.height.min} – ${c.height.max}` : "未提供"}`,
    `frameRate: ${c.frameRate ? `${c.frameRate.min} – ${c.frameRate.max}` : "未提供"}`,
    `facingMode: ${Array.isArray(c.facingMode) ? c.facingMode.join(", ") : "未提供"}`
  ].join("\\n"));
}

async function refreshCameraList() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter(d => d.kind === "videoinput");
    const current = els.cameraSelect.value;
    els.cameraSelect.innerHTML = "";
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "預設攝影機（優先後鏡頭 / 外接鏡頭）";
    els.cameraSelect.appendChild(def);
    videos.forEach((d, i) => {
      const o = document.createElement("option");
      o.value = d.deviceId;
      o.textContent = d.label || `攝影機 ${i + 1}`;
      els.cameraSelect.appendChild(o);
    });
    if (current && Array.from(els.cameraSelect.options).some(o => o.value === current)) els.cameraSelect.value = current;
    status(els.cameraStatus, videos.length ? `✓ 已找到 ${videos.length} 個攝影機來源` : "尚未偵測到攝影機。", videos.length ? "success" : "info");
  } catch (e) {
    status(els.cameraStatus, `✗ 取得攝影機清單失敗: ${e.message}`, "error");
  }
}

function buildVideoConstraints() {
  const constraints = { ...selectedQuality().constraints };
  if (els.cameraSelect.value) constraints.deviceId = { exact: els.cameraSelect.value };
  else constraints.facingMode = { ideal: "environment" };
  return constraints;
}

async function initPoseLandmarker() {
  if (poseLandmarker) return poseLandmarker;
  setText(els.diagPoseStatus, "MediaPipe Tasks Vision 載入中...");
  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm");
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
  setText(els.diagPoseStatus, "MediaPipe Tasks Vision 已載入");
  return poseLandmarker;
}

async function startCamera() {
  try {
    if (mediaStream) stopCamera();
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: buildVideoConstraints(), audio: false });
    els.video.srcObject = mediaStream;
    await els.video.play();

    await new Promise(resolve => {
      if (els.video.videoWidth > 0 && els.video.videoHeight > 0) resolve();
      else els.video.onloadedmetadata = resolve;
    });

    setCanvasSize();
    drawBase();
    showCapabilities(mediaStream.getVideoTracks()[0]);

    els.startCameraBtn.disabled = true;
    els.stopCameraBtn.disabled = false;
    els.startRecordingBtn.disabled = false;
    els.cameraSelect.disabled = true;
    els.qualityMode.disabled = true;

    updateStatusOverlay("待機");
    els.timerOverlay.textContent = fmtTime(selectedDuration());
    setPrep("");
    updateTimerSize();

    status(els.cameraStatus, "✓ 攝影機已啟動，正在啟動 MediaPipe Tasks Vision", "success");
    await initPoseLandmarker();
    startPoseLoop();
    await refreshCameraList();
    els.cameraSelect.disabled = true;
  } catch (e) {
    console.error(e);
    status(els.cameraStatus, `✗ 錯誤: ${e.message}`, "error");
    setText(els.diagPoseStatus, "骨架啟動失敗");
    setText(els.diagDetails, String(e.stack || e.message || e));
  }
}

function startPoseLoop() {
  if (poseRunning) return;
  poseRunning = true;
  poseFrameCount = 0;
  poseFpsStart = performance.now();
  lastVideoTime = -1;

  const loop = () => {
    if (!poseRunning || !mediaStream || !poseLandmarker) return;

    if (els.video.readyState >= 2 && els.video.videoWidth > 0 && els.video.videoHeight > 0) {
      drawBase();

      if (els.video.currentTime !== lastVideoTime) {
        lastVideoTime = els.video.currentTime;
        try {
          const results = poseLandmarker.detectForVideo(els.video, performance.now());
          drawPose(results);
          poseFrameCount++;
          const now = performance.now();
          if (now - poseFpsStart >= 1000) {
            setText(els.diagPoseFps, `${Number((poseFrameCount / ((now - poseFpsStart) / 1000)).toFixed(1))} fps`);
            poseFrameCount = 0;
            poseFpsStart = now;
          }
        } catch (e) {
          console.warn("PoseLandmarker 偵測錯誤:", e);
          setText(els.diagPoseStatus, "骨架偵測錯誤");
          setText(els.diagDetails, String(e.stack || e.message || e));
        }
      }
    }
    rafId = requestAnimationFrame(loop);
  };
  loop();
}

function stopPoseLoop() {
  poseRunning = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  setText(els.diagPoseStatus, "骨架偵測已停止");
  setText(els.diagPoseFps, "尚未啟動");
}

function stopCamera() {
  stopPoseLoop();
  if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  mediaStream = null;
  els.video.srcObject = null;
  if (isRecording || isPreparing) stopRecording();
  els.startCameraBtn.disabled = false;
  els.stopCameraBtn.disabled = true;
  els.startRecordingBtn.disabled = true;
  els.stopRecordingBtn.disabled = true;
  els.cameraSelect.disabled = false;
  els.qualityMode.disabled = false;
  updateStatusOverlay("攝影機未啟動");
  els.timerOverlay.textContent = "00:00";
  setPrep("");
  status(els.cameraStatus, "✓ 攝影機已停止", "info");
}

function ensureAudioContext() {
  if (!audioContext) {
    const A = window.AudioContext || window.webkitAudioContext;
    if (A) audioContext = new A();
  }
  if (audioContext && audioContext.state === "suspended") audioContext.resume();
}

function playFinishBeep() {
  try {
    ensureAudioContext();
    if (!audioContext) return;
    const now = audioContext.currentTime;
    [0, .28, .56].forEach((offset, i) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.frequency.value = i === 2 ? 1046 : 880;
      gain.gain.setValueAtTime(.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(.4, now + offset + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, now + offset + .2);
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.start(now + offset);
      osc.stop(now + offset + .22);
    });
  } catch {}
}

function startRecording() {
  if (isPreparing || isRecording) return;
  if (!els.subjectCode.value.trim()) { status(els.recordingStatus, "✗ 請輸入受試者代碼", "error"); return; }
  if (!els.testPhase.value) { status(els.recordingStatus, "✗ 請選擇測驗階段", "error"); return; }
  if (!mediaStream) { status(els.recordingStatus, "✗ 攝影機尚未啟動", "error"); return; }

  ensureAudioContext();
  currentDuration = selectedDuration();
  lastRecordingLabel = selectedLabel();

  els.subjectCode.disabled = true;
  els.testPhase.disabled = true;
  document.querySelectorAll('input[name="recordingLength"],input[name="timerSize"]').forEach(i => i.disabled = true);
  els.stopCameraBtn.disabled = true;
  els.startRecordingBtn.disabled = true;
  els.stopRecordingBtn.disabled = true;
  els.downloadBtn.disabled = true;

  let prep = 10;
  isPreparing = true;
  updateStatusOverlay("預備中");
  els.timerOverlay.textContent = fmtTime(currentDuration);
  setPrep(String(prep));
  els.prepCountdown.textContent = String(prep);
  status(els.recordingStatus, "● 預備倒數中...", "info");

  prepInterval = setInterval(() => {
    prep -= 1;
    if (prep > 0) {
      setPrep(String(prep));
      els.prepCountdown.textContent = String(prep);
    } else {
      clearInterval(prepInterval);
      prepInterval = null;
      setPrep("開始");
      els.prepCountdown.textContent = "開始";
      setTimeout(beginRecording, 350);
    }
  }, 1000);
}

function beginRecording() {
  recordedChunks = [];
  const fps = Math.round(mediaStream.getVideoTracks()[0].getSettings().frameRate || 30);
  const recordStream = els.canvas.captureStream(Math.max(15, Math.min(30, fps)));
  let options = { mimeType: "video/webm;codecs=vp9" };
  if (!MediaRecorder.isTypeSupported(options.mimeType)) options.mimeType = "video/webm;codecs=vp8";
  if (!MediaRecorder.isTypeSupported(options.mimeType)) options.mimeType = "video/webm";

  try { mediaRecorder = new MediaRecorder(recordStream, options); }
  catch { mediaRecorder = new MediaRecorder(recordStream); }

  currentMimeType = mediaRecorder.mimeType || options.mimeType || "瀏覽器預設";
  setText(els.diagMimeType, currentMimeType);

  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    window.recordedBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "video/webm" });
    els.downloadBtn.disabled = false;
    updateStatusOverlay("✓ 錄製完成");
    els.timerOverlay.textContent = "00:00";
    setPrep("");
    status(els.recordingStatus, "✓ 骨架疊圖影片錄製已完成", "success");
    status(els.downloadStatus, "✓ 可以下載骨架疊圖影片", "success");
    playFinishBeep();
  };

  mediaRecorder.start();
  recordingStartTime = Date.now();
  isRecording = true;
  isPreparing = false;
  els.stopRecordingBtn.disabled = false;
  els.timerDisplay.classList.add("recording");
  updateStatusOverlay("● 錄製中");
  els.timerOverlay.textContent = fmtTime(currentDuration);
  setPrep("");
  els.prepCountdown.textContent = "";
  status(els.recordingStatus, "● 錄製骨架疊圖影片中...", "info");

  updateTimer();
  timerInterval = setInterval(updateTimer, 100);
  recordingTimeout = setTimeout(() => { if (isRecording) stopRecording(); }, currentDuration);
}

function stopRecording() {
  if (!isRecording && !isPreparing) return;
  if (prepInterval) clearInterval(prepInterval);
  if (recordingTimeout) clearTimeout(recordingTimeout);
  if (timerInterval) clearInterval(timerInterval);
  prepInterval = null;
  recordingTimeout = null;
  timerInterval = null;

  const wasRecording = isRecording;
  isRecording = false;
  isPreparing = false;
  recordingStartTime = null;
  els.timerDisplay.textContent = "00:00";
  els.timerDisplay.classList.remove("recording");
  els.prepCountdown.textContent = "";
  setPrep("");

  if (wasRecording && mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  else {
    updateStatusOverlay("待機");
    els.timerOverlay.textContent = fmtTime(selectedDuration());
  }

  els.startRecordingBtn.disabled = !mediaStream;
  els.stopRecordingBtn.disabled = true;
  els.subjectCode.disabled = false;
  els.testPhase.disabled = false;
  document.querySelectorAll('input[name="recordingLength"],input[name="timerSize"]').forEach(i => i.disabled = false);
  els.stopCameraBtn.disabled = false;
}

function updateTimer() {
  if (!recordingStartTime || !isRecording) return;
  const remain = Math.max(0, currentDuration - (Date.now() - recordingStartTime));
  els.timerDisplay.textContent = fmtTime(remain);
  els.timerOverlay.textContent = fmtTime(remain);
}

function downloadVideo() {
  if (!window.recordedBlob) { status(els.downloadStatus, "✗ 沒有可下載的影片", "error"); return; }
  const now = new Date();
  const p = n => String(n).padStart(2, "0");
  const filename = `${els.subjectCode.value.trim()}_${els.testPhase.value}_${lastRecordingLabel}_skeleton_${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}.webm`;
  const url = URL.createObjectURL(window.recordedBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  status(els.downloadStatus, `✓ 正在下載: ${filename}`, "success");
}

els.refreshCamerasBtn.addEventListener("click", refreshCameraList);
els.startCameraBtn.addEventListener("click", startCamera);
els.stopCameraBtn.addEventListener("click", stopCamera);
els.startRecordingBtn.addEventListener("click", startRecording);
els.stopRecordingBtn.addEventListener("click", stopRecording);
els.downloadBtn.addEventListener("click", downloadVideo);
els.qualityMode.addEventListener("change", () => {
  setText(els.diagRequestedMode, selectedQuality().label);
  if (mediaStream) status(els.cameraStatus, "畫質模式已變更，請停止攝影機後重新啟動才會套用。", "info");
});
document.querySelectorAll('input[name="recordingLength"]').forEach(i => i.addEventListener("change", () => {
  const d = selectedDuration();
  els.timerDisplay.textContent = fmtTime(d);
  els.timerOverlay.textContent = fmtTime(d);
}));
document.querySelectorAll('input[name="timerSize"]').forEach(i => i.addEventListener("change", updateTimerSize));
if (navigator.mediaDevices?.addEventListener) navigator.mediaDevices.addEventListener("devicechange", refreshCameraList);

document.addEventListener("DOMContentLoaded", () => {
  updateTimerSize();
  els.timerDisplay.textContent = fmtTime(selectedDuration());
  els.timerOverlay.textContent = fmtTime(selectedDuration());
  updateStatusOverlay("待機");
  setPrep("");
  status(els.cameraStatus, "請啟動攝影機。V2.0.4 使用 MediaPipe Tasks Vision PoseLandmarker。", "info");
  status(els.recordingStatus, "準備就緒", "info");
  status(els.downloadStatus, "", "info");
  refreshCameraList();
});
