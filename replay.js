"use strict";

// CPR Research System V2.3.1.1
// Mode 2 layout stabilization: keep V2.3.1 playback and CSV validation logic unchanged,
// and only add responsive display sizing for desktop/tablet/mobile playback.
// No upload, no MediaPipe, no skeleton drawing, no video/CSV synchronization.

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

  landmarksFileInput: document.getElementById("landmarksFileInput"),
  clearLandmarksBtn: document.getElementById("clearLandmarksBtn"),
  csvMiniStatus: document.getElementById("csvMiniStatus"),
  csvMiniStatusText: document.getElementById("csvMiniStatusText"),
  landmarkValidationBadge: document.getElementById("landmarkValidationBadge"),
  landmarkFileNameValue: document.getElementById("landmarkFileNameValue"),
  landmarkRowCountValue: document.getElementById("landmarkRowCountValue"),
  landmarkColumnCountValue: document.getElementById("landmarkColumnCountValue"),
  landmarkFrameRangeValue: document.getElementById("landmarkFrameRangeValue"),
  landmarkElapsedRangeValue: document.getElementById("landmarkElapsedRangeValue"),
  landmarkElapsedSpanValue: document.getElementById("landmarkElapsedSpanValue"),

  checkParse: document.getElementById("checkParse"),
  checkParseText: document.getElementById("checkParseText"),
  checkTimeColumns: document.getElementById("checkTimeColumns"),
  checkTimeColumnsText: document.getElementById("checkTimeColumnsText"),
  checkCoreLandmarks: document.getElementById("checkCoreLandmarks"),
  checkCoreLandmarksText: document.getElementById("checkCoreLandmarksText"),
  checkElapsedData: document.getElementById("checkElapsedData"),
  checkElapsedDataText: document.getElementById("checkElapsedDataText"),
  checkFrameIndex: document.getElementById("checkFrameIndex"),
  checkFrameIndexText: document.getElementById("checkFrameIndexText"),
  checkRowShape: document.getElementById("checkRowShape"),
  checkRowShapeText: document.getElementById("checkRowShapeText"),

  csvAppVersionValue: document.getElementById("csvAppVersionValue"),
  csvModelValue: document.getElementById("csvModelValue"),
  csvResolutionValue: document.getElementById("csvResolutionValue"),
  csvRequestedFpsValue: document.getElementById("csvRequestedFpsValue"),
  csvActualFpsValue: document.getElementById("csvActualFpsValue"),
  csvPoseCountValue: document.getElementById("csvPoseCountValue"),
  csvVideoTimeStartValue: document.getElementById("csvVideoTimeStartValue"),
  csvVideoTimeEndValue: document.getElementById("csvVideoTimeEndValue"),
};

let activeObjectUrl = null;
let activeFile = null;
let activeLandmarksFile = null;
let activeLandmarksData = null;

// Required for V2.3.1 to recognize a V2.2.7 landmarks CSV as usable for later replay.
const REQUIRED_TIME_COLUMNS = ["frame_index", "elapsed_sec", "video_time_sec"];
const CORE_LANDMARK_COLUMNS = [
  "left_shoulder_x", "left_shoulder_y", "left_shoulder_z", "left_shoulder_visibility",
  "right_shoulder_x", "right_shoulder_y", "right_shoulder_z", "right_shoulder_visibility",
  "left_elbow_x", "left_elbow_y", "left_elbow_z", "left_elbow_visibility",
  "right_elbow_x", "right_elbow_y", "right_elbow_z", "right_elbow_visibility",
  "left_wrist_x", "left_wrist_y", "left_wrist_z", "left_wrist_visibility",
  "right_wrist_x", "right_wrist_y", "right_wrist_z", "right_wrist_visibility",
];

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

function formatSeconds(value, digits = 4) {
  return Number.isFinite(value) ? `${value.toFixed(digits)} s` : "—";
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

// V2.3.1.1: display-only sizing.
// Keep the whole source frame visible, avoid unnecessary upscaling, and cap playback
// height so later canvas overlays can share the same stable display rectangle.
function updateReplayDisplayGeometry() {
  const sourceWidth = els.replayVideo.videoWidth;
  const sourceHeight = els.replayVideo.videoHeight;

  if (!(sourceWidth > 0 && sourceHeight > 0)) {
    els.replayVideoCard.style.removeProperty("--replay-display-max-width");
    els.replayVideoCard.removeAttribute("data-video-orientation");
    return;
  }

  const aspect = sourceWidth / sourceHeight;
  const viewportWidth = Math.max(window.innerWidth || 0, 320);
  const viewportHeight = Math.max(window.innerHeight || 0, 480);

  let heightFraction = 0.58;
  let absoluteHeightCap = 650;

  if (viewportWidth <= 560) {
    heightFraction = 0.52;
    absoluteHeightCap = 520;
  } else if (viewportWidth <= 980) {
    heightFraction = 0.55;
    absoluteHeightCap = 600;
  }

  const maxDisplayHeight = Math.min(viewportHeight * heightFraction, absoluteHeightCap);
  const maxWidthFromHeight = maxDisplayHeight * aspect;
  const desktopWidthCap = viewportWidth > 980 ? 1040 : viewportWidth;

  // Do not enlarge beyond the source video's native width. CSS can still scale down
  // when the page or device is narrower than this cap.
  const displayMaxWidth = Math.max(160, Math.min(sourceWidth, maxWidthFromHeight, desktopWidthCap));

  els.replayVideoCard.style.setProperty("--replay-display-max-width", `${displayMaxWidth.toFixed(1)}px`);
  els.replayVideoCard.dataset.videoOrientation = aspect > 1.05
    ? "landscape"
    : aspect < 0.95
      ? "portrait"
      : "square";
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
  els.replayVideoCard.style.removeProperty("--replay-display-max-width");
  els.replayVideoCard.removeAttribute("data-video-orientation");
  resetVideoInfo();

  if (!preserveMessage) {
    setMessage("可先選擇影片，也可直接載入 V2.2.7 產生的 landmarks.csv。");
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

  setMessage(`已從本機選擇影片：${file.name}。正在讀取影片資訊。`);
}

// CSV parser with support for quoted fields, commas inside quotes, CRLF/LF and UTF-8 BOM.
function parseCsv(text) {
  const cleanText = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i += 1) {
    const char = cleanText[i];

    if (inQuotes) {
      if (char === '"') {
        if (cleanText[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error("CSV 含有未結束的雙引號欄位。");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
    rows.push(row);
  }

  while (rows.length > 0 && rows[rows.length - 1].every((value) => value.trim() === "")) {
    rows.pop();
  }

  if (rows.length === 0) {
    throw new Error("CSV 是空白檔案。");
  }

  const headers = rows[0].map((value) => value.trim());
  if (headers.length === 0 || headers.every((value) => value === "")) {
    throw new Error("找不到 CSV 標題列。");
  }

  const dataRows = rows.slice(1);
  return { headers, dataRows };
}

function getColumnIndex(headers, name) {
  return headers.indexOf(name);
}

function getNumericColumn(dataRows, headers, name) {
  const index = getColumnIndex(headers, name);
  if (index < 0) return [];
  return dataRows.map((row) => Number(row[index])).filter((value) => Number.isFinite(value));
}

function getFirstValue(dataRows, headers, name) {
  const index = getColumnIndex(headers, name);
  if (index < 0 || dataRows.length === 0) return "";
  return (dataRows[0][index] ?? "").trim();
}

function countRowsWhereNumericGreaterThan(dataRows, headers, name, threshold) {
  const index = getColumnIndex(headers, name);
  if (index < 0) return null;
  let count = 0;
  for (const row of dataRows) {
    const value = Number(row[index]);
    if (Number.isFinite(value) && value > threshold) count += 1;
  }
  return count;
}

function isNonDecreasing(values) {
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] < values[i - 1]) return false;
  }
  return true;
}

function isSequentialIntegers(values) {
  if (values.length === 0) return false;
  for (let i = 0; i < values.length; i += 1) {
    if (!Number.isInteger(values[i])) return false;
    if (i > 0 && values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}

function setValidationCheck(container, textElement, state, text) {
  container.dataset.state = state;
  const icon = container.querySelector(".validation-icon");
  if (icon) {
    icon.textContent = state === "pass" ? "✓" : state === "fail" ? "✕" : "—";
  }
  textElement.textContent = text;
}

function setCsvOverallState(state, text) {
  els.landmarkValidationBadge.dataset.state = state;
  els.landmarkValidationBadge.textContent = text;
  els.csvMiniStatus.dataset.state = state;
  els.csvMiniStatusText.textContent = text;
}

function resetLandmarkValidation({ preserveMessage = false } = {}) {
  activeLandmarksFile = null;
  activeLandmarksData = null;
  els.landmarksFileInput.value = "";
  els.clearLandmarksBtn.disabled = true;

  els.landmarkFileNameValue.textContent = "—";
  els.landmarkRowCountValue.textContent = "—";
  els.landmarkColumnCountValue.textContent = "—";
  els.landmarkFrameRangeValue.textContent = "—";
  els.landmarkElapsedRangeValue.textContent = "—";
  els.landmarkElapsedSpanValue.textContent = "—";

  els.csvAppVersionValue.textContent = "—";
  els.csvModelValue.textContent = "—";
  els.csvResolutionValue.textContent = "—";
  els.csvRequestedFpsValue.textContent = "—";
  els.csvActualFpsValue.textContent = "—";
  els.csvPoseCountValue.textContent = "—";
  els.csvVideoTimeStartValue.textContent = "—";
  els.csvVideoTimeEndValue.textContent = "—";

  setCsvOverallState("idle", "尚未載入");
  setValidationCheck(els.checkParse, els.checkParseText, "idle", "等待載入");
  setValidationCheck(els.checkTimeColumns, els.checkTimeColumnsText, "idle", "等待載入");
  setValidationCheck(els.checkCoreLandmarks, els.checkCoreLandmarksText, "idle", "等待載入");
  setValidationCheck(els.checkElapsedData, els.checkElapsedDataText, "idle", "等待載入");
  setValidationCheck(els.checkFrameIndex, els.checkFrameIndexText, "idle", "等待載入");
  setValidationCheck(els.checkRowShape, els.checkRowShapeText, "idle", "等待載入");

  if (!preserveMessage) {
    setMessage("CSV 已清除。可重新選擇 V2.2.7 產生的 landmarks.csv。");
  }
}

function validateLandmarksCsv(file, parsed) {
  const { headers, dataRows } = parsed;
  const headerSet = new Set(headers);
  const duplicateHeaders = headers.filter((name, index) => name && headers.indexOf(name) !== index);
  const malformedRows = dataRows.filter((row) => row.length !== headers.length).length;
  const missingTimeColumns = REQUIRED_TIME_COLUMNS.filter((name) => !headerSet.has(name));
  const missingCoreColumns = CORE_LANDMARK_COLUMNS.filter((name) => !headerSet.has(name));

  const frameValues = getNumericColumn(dataRows, headers, "frame_index");
  const elapsedValues = getNumericColumn(dataRows, headers, "elapsed_sec");
  const videoTimeValues = getNumericColumn(dataRows, headers, "video_time_sec");

  const elapsedAllNumeric = dataRows.length > 0 && elapsedValues.length === dataRows.length;
  const elapsedOrdered = elapsedAllNumeric && isNonDecreasing(elapsedValues);
  const frameAllNumeric = dataRows.length > 0 && frameValues.length === dataRows.length;
  const frameSequential = frameAllNumeric && isSequentialIntegers(frameValues);

  const parsePass = headers.length > 0 && dataRows.length > 0 && duplicateHeaders.length === 0;
  const timeColumnsPass = missingTimeColumns.length === 0;
  const coreLandmarksPass = missingCoreColumns.length === 0;
  const elapsedPass = elapsedAllNumeric && elapsedOrdered;
  const framePass = frameAllNumeric && frameSequential;
  const rowShapePass = malformedRows === 0;

  setValidationCheck(
    els.checkParse,
    els.checkParseText,
    parsePass ? "pass" : "fail",
    parsePass
      ? `成功辨識 ${headers.length} 個欄位與 ${dataRows.length} 筆資料`
      : duplicateHeaders.length > 0
        ? `發現重複欄位：${duplicateHeaders.slice(0, 3).join(", ")}`
        : "CSV 缺少標題列或資料列"
  );

  setValidationCheck(
    els.checkTimeColumns,
    els.checkTimeColumnsText,
    timeColumnsPass ? "pass" : "fail",
    timeColumnsPass ? "已找到 frame_index、elapsed_sec、video_time_sec" : `缺少：${missingTimeColumns.join(", ")}`
  );

  setValidationCheck(
    els.checkCoreLandmarks,
    els.checkCoreLandmarksText,
    coreLandmarksPass ? "pass" : "fail",
    coreLandmarksPass ? `肩、肘、腕左右側 x/y/z/visibility 共 ${CORE_LANDMARK_COLUMNS.length} 欄完整` : `缺少 ${missingCoreColumns.length} 個必要欄位`
  );

  setValidationCheck(
    els.checkElapsedData,
    els.checkElapsedDataText,
    elapsedPass ? "pass" : "fail",
    elapsedPass ? `${elapsedValues.length}/${dataRows.length} 筆為有效數值，且時間單調遞增` : `有效數值 ${elapsedValues.length}/${dataRows.length}；${elapsedOrdered ? "順序正常" : "順序異常"}`
  );

  setValidationCheck(
    els.checkFrameIndex,
    els.checkFrameIndexText,
    framePass ? "pass" : "fail",
    framePass ? `${frameValues[0]} → ${frameValues[frameValues.length - 1]}，連續無跳號` : `有效數值 ${frameValues.length}/${dataRows.length}；未確認連續`
  );

  setValidationCheck(
    els.checkRowShape,
    els.checkRowShapeText,
    rowShapePass ? "pass" : "fail",
    rowShapePass ? `全部 ${dataRows.length} 筆資料欄位數一致` : `${malformedRows} 筆資料的欄位數與標題列不一致`
  );

  const allPass = parsePass && timeColumnsPass && coreLandmarksPass && elapsedPass && framePass && rowShapePass;

  els.landmarkFileNameValue.textContent = file.name;
  els.landmarkRowCountValue.textContent = dataRows.length.toLocaleString("zh-TW");
  els.landmarkColumnCountValue.textContent = headers.length.toLocaleString("zh-TW");

  if (frameValues.length > 0) {
    els.landmarkFrameRangeValue.textContent = `${frameValues[0]} → ${frameValues[frameValues.length - 1]}`;
  } else {
    els.landmarkFrameRangeValue.textContent = "無法讀取";
  }

  if (elapsedValues.length > 0) {
    const firstElapsed = elapsedValues[0];
    const lastElapsed = elapsedValues[elapsedValues.length - 1];
    els.landmarkElapsedRangeValue.textContent = `${firstElapsed.toFixed(4)} → ${lastElapsed.toFixed(4)} s`;
    els.landmarkElapsedSpanValue.textContent = formatSeconds(lastElapsed - firstElapsed, 4);
  } else {
    els.landmarkElapsedRangeValue.textContent = "無法讀取";
    els.landmarkElapsedSpanValue.textContent = "無法讀取";
  }

  const actualWidth = getFirstValue(dataRows, headers, "actual_width");
  const actualHeight = getFirstValue(dataRows, headers, "actual_height");
  const posePositiveCount = countRowsWhereNumericGreaterThan(dataRows, headers, "pose_count", 0);

  els.csvAppVersionValue.textContent = getFirstValue(dataRows, headers, "app_version") || "—";
  els.csvModelValue.textContent = getFirstValue(dataRows, headers, "model_label") || getFirstValue(dataRows, headers, "model_key") || "—";
  els.csvResolutionValue.textContent = actualWidth && actualHeight ? `${actualWidth} × ${actualHeight}` : "—";
  els.csvRequestedFpsValue.textContent = getFirstValue(dataRows, headers, "requested_fps") || "—";
  els.csvActualFpsValue.textContent = getFirstValue(dataRows, headers, "actual_frame_rate") || "—";
  els.csvPoseCountValue.textContent = posePositiveCount === null ? "—" : `${posePositiveCount.toLocaleString("zh-TW")} / ${dataRows.length.toLocaleString("zh-TW")}`;
  els.csvVideoTimeStartValue.textContent = videoTimeValues.length > 0 ? formatSeconds(videoTimeValues[0], 4) : "—";
  els.csvVideoTimeEndValue.textContent = videoTimeValues.length > 0 ? formatSeconds(videoTimeValues[videoTimeValues.length - 1], 4) : "—";

  return {
    allPass,
    headers,
    dataRows,
    frameValues,
    elapsedValues,
    videoTimeValues,
  };
}

async function loadLandmarksCsv(file) {
  const extension = file?.name.split(".").pop()?.toLowerCase();
  if (!file || extension !== "csv") {
    resetLandmarkValidation({ preserveMessage: true });
    setCsvOverallState("fail", "讀取失敗");
    setMessage("請選擇 .csv 格式的 landmarks 檔案。", "error");
    return;
  }

  activeLandmarksFile = file;
  els.clearLandmarksBtn.disabled = false;
  setCsvOverallState("loading", "讀取中…");
  els.landmarkFileNameValue.textContent = file.name;
  setMessage(`正在從本機讀取 CSV：${file.name}`);

  try {
    const text = await file.text();
    const parsed = parseCsv(text);
    const validation = validateLandmarksCsv(file, parsed);
    activeLandmarksData = validation;

    if (validation.allPass) {
      setCsvOverallState("pass", "讀取成功｜PASS");
      setMessage(`Landmarks CSV 已成功讀取並通過 V2.3.1 結構驗證：${file.name}`, "ok");
    } else {
      setCsvOverallState("fail", "已讀取｜需檢查");
      setMessage(`CSV 已讀取，但部分 V2.3.1 驗證項目未通過。請查看下方紅色項目。`, "error");
    }
  } catch (error) {
    activeLandmarksData = null;
    setCsvOverallState("fail", "讀取失敗");
    setValidationCheck(els.checkParse, els.checkParseText, "fail", error?.message || "無法解析 CSV");
    setMessage(`CSV 讀取失敗：${error?.message || "未知錯誤"}`, "error");
  }
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

els.landmarksFileInput.addEventListener("change", () => {
  const [file] = els.landmarksFileInput.files;
  if (!file) return;
  loadLandmarksCsv(file);
});

els.clearLandmarksBtn.addEventListener("click", () => {
  resetLandmarkValidation();
});

els.replayVideo.addEventListener("loadedmetadata", () => {
  if (!activeFile) return;

  const width = els.replayVideo.videoWidth;
  const height = els.replayVideo.videoHeight;

  if (width > 0 && height > 0) {
    els.resolutionValue.textContent = `${width} × ${height}`;
    els.replayVideoCard.style.setProperty("--video-aspect", `${width} / ${height}`);
    updateReplayDisplayGeometry();
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

window.addEventListener("resize", () => {
  if (activeFile) updateReplayDisplayGeometry();
});

window.addEventListener("beforeunload", () => {
  releaseObjectUrl();
});

resetPlayer();
resetLandmarkValidation({ preserveMessage: true });
