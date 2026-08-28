"use strict";

// CPR Research System V2.3.0
// Mode 2, Phase 1: local video loading and playback only.
// No file upload, no MediaPipe, no landmark processing in this version.

const els = {
  videoFileInput: document.getElementById("videoFileInput"),
  clearVideoBtn: document.getElementById("clearVideoBtn"),
  playbackRateSelect: document.getElementById("playbackRateSelect"),
  replayVideo: document.getElementById("replayVideo"),
  replayVideoCard: document.getElementById("replayVideoCard"),
  replayEmptyState: document.getElementById("replayEmptyState"),
  replayMessage: document.getElementById("replayMessage"),
  fileNameValue: document.getElementById("fileNameValue"),
  fileSizeValue: document.getElementById("fileSizeValue"),
  resolutionValue: document.getElementById("resolutionValue"),
  durationValue: document.getElementById("durationValue"),
  currentTimeValue: document.getElementById("currentTimeValue"),
  fileTypeValue: document.getElementById("fileTypeValue"),
};

let activeObjectUrl = null;
let activeFile = null;

function setMessage(message, type = "normal") {
  els.replayMessage.textContent = message;
  els.replayMessage.classList.toggle("replay-message-error", type === "error");
  els.replayMessage.classList.toggle("replay-message-ok", type === "ok");
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function formatTime(seconds, includeMilliseconds = false) {
  if (!Number.isFinite(seconds) || seconds < 0) return includeMilliseconds ? "00:00.000" : "—";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const wholeSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds - Math.floor(seconds)) * 1000);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(wholeSeconds).padStart(2, "0");
  const ms = String(milliseconds).padStart(3, "0");

  if (hours > 0) {
    return includeMilliseconds ? `${hh}:${mm}:${ss}.${ms}` : `${hh}:${mm}:${ss}`;
  }
  return includeMilliseconds ? `${mm}:${ss}.${ms}` : `${mm}:${ss}`;
}

function inferFileType(file) {
  if (file.type) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "webm") return "video/webm";
  if (extension === "mp4") return "video/mp4";
  return "未知格式";
}

function isSupportedSelection(file) {
  if (!file) return false;
  const extension = file.name.split(".").pop()?.toLowerCase();
  return file.type === "video/webm" || file.type === "video/mp4" || extension === "webm" || extension === "mp4";
}

function releaseObjectUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

function resetVideoInfo() {
  els.fileNameValue.textContent = "—";
  els.fileSizeValue.textContent = "—";
  els.resolutionValue.textContent = "—";
  els.durationValue.textContent = "—";
  els.currentTimeValue.textContent = "00:00.000";
  els.fileTypeValue.textContent = "—";
}

function resetPlayer({ preserveMessage = false } = {}) {
  els.replayVideo.pause();
  els.replayVideo.removeAttribute("src");
  els.replayVideo.load();
  releaseObjectUrl();
  activeFile = null;

  els.videoFileInput.value = "";
  els.clearVideoBtn.disabled = true;
  els.playbackRateSelect.disabled = true;
  els.playbackRateSelect.value = "1";
  els.replayVideo.playbackRate = 1;
  els.replayEmptyState.hidden = false;
  els.replayVideoCard.style.removeProperty("--video-aspect");
  resetVideoInfo();

  if (!preserveMessage) {
    setMessage("請選擇 V2.2.7 錄製的 webm 原始影片。");
  }
}

function loadSelectedVideo(file) {
  if (!isSupportedSelection(file)) {
    resetPlayer({ preserveMessage: true });
    setMessage("此版本僅支援 webm 或 mp4 影片。請重新選擇檔案。", "error");
    return;
  }

  els.replayVideo.pause();
  releaseObjectUrl();

  activeFile = file;
  activeObjectUrl = URL.createObjectURL(file);

  els.fileNameValue.textContent = file.name;
  els.fileSizeValue.textContent = formatFileSize(file.size);
  els.fileTypeValue.textContent = inferFileType(file);
  els.resolutionValue.textContent = "讀取中…";
  els.durationValue.textContent = "讀取中…";
  els.currentTimeValue.textContent = "00:00.000";

  els.replayEmptyState.hidden = true;
  els.clearVideoBtn.disabled = false;
  els.playbackRateSelect.disabled = false;
  els.playbackRateSelect.value = "1";
  els.replayVideo.playbackRate = 1;
  els.replayVideo.src = activeObjectUrl;
  els.replayVideo.load();

  setMessage(`已從本機選擇：${file.name}。正在讀取影片資訊。`);
}

els.videoFileInput.addEventListener("change", () => {
  const [file] = els.videoFileInput.files;
  if (!file) return;
  loadSelectedVideo(file);
});

els.clearVideoBtn.addEventListener("click", () => {
  resetPlayer();
});

els.playbackRateSelect.addEventListener("change", () => {
  const rate = Number(els.playbackRateSelect.value);
  if (Number.isFinite(rate) && rate > 0) {
    els.replayVideo.playbackRate = rate;
  }
});

els.replayVideo.addEventListener("loadedmetadata", () => {
  if (!activeFile) return;

  const width = els.replayVideo.videoWidth;
  const height = els.replayVideo.videoHeight;

  if (width > 0 && height > 0) {
    els.resolutionValue.textContent = `${width} × ${height}`;
    els.replayVideoCard.style.setProperty("--video-aspect", `${width} / ${height}`);
  } else {
    els.resolutionValue.textContent = "無法讀取";
  }

  els.durationValue.textContent = Number.isFinite(els.replayVideo.duration)
    ? formatTime(els.replayVideo.duration)
    : "瀏覽器未提供";

  setMessage(`影片已載入：${activeFile.name}。可使用影片下方原生控制列播放、暫停或拖曳時間。`, "ok");
});

els.replayVideo.addEventListener("durationchange", () => {
  if (Number.isFinite(els.replayVideo.duration)) {
    els.durationValue.textContent = formatTime(els.replayVideo.duration);
  }
});

els.replayVideo.addEventListener("timeupdate", () => {
  els.currentTimeValue.textContent = formatTime(els.replayVideo.currentTime, true);
});

els.replayVideo.addEventListener("seeked", () => {
  els.currentTimeValue.textContent = formatTime(els.replayVideo.currentTime, true);
});

els.replayVideo.addEventListener("ratechange", () => {
  const value = String(els.replayVideo.playbackRate);
  const optionExists = Array.from(els.playbackRateSelect.options).some((option) => option.value === value);
  if (optionExists) {
    els.playbackRateSelect.value = value;
  }
});

els.replayVideo.addEventListener("error", () => {
  if (!activeFile) return;
  els.resolutionValue.textContent = "讀取失敗";
  els.durationValue.textContent = "讀取失敗";
  setMessage("瀏覽器無法播放這個影片。請確認檔案未損壞，並優先使用 V2.2.7 直接下載的 webm 原始影片。", "error");
});

window.addEventListener("beforeunload", () => {
  releaseObjectUrl();
});

resetPlayer();
