import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";

const APP_VERSION = "CPR Research System V2.2.8.1";
const TASKS_VERSION = "@mediapipe/tasks-vision@0.10.35";
const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FULL_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";
const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 480;
const DEFAULT_FPS = 30;
let currentRequestedWidth = DEFAULT_WIDTH;
let currentRequestedHeight = DEFAULT_HEIGHT;
let currentRequestedQuality = "640x480x30";
const JUMP_THRESHOLD_PX = 25;
const QUALITY_MIN_VISIBILITY = 0.60;
const POSE_STALE_MS = 500;
const DEFAULT_PREP_COUNTDOWN_SEC = 0;
const AUTO_SIDE_SWITCH_MARGIN = 0.75;
const AUTO_SIDE_Z_MARGIN = 0.08;
const DISPLAY_SMOOTH_ALPHA = 0.34;

const POINTS = [
  "nose", "neck_mid",
  "left_shoulder", "right_shoulder",
  "left_elbow", "right_elbow",
  "left_wrist", "right_wrist",
  "left_hip", "right_hip"
];

const MP_INDEX = {
  nose: 0,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_hip: 23,
  right_hip: 24
};

const els = {
  subjectCode: document.getElementById("subjectCode"),
  testStage: document.getElementById("testStage"),
  durationSec: document.getElementById("durationSec"),
  prepCountdownSec: document.getElementById("prepCountdownSec"),
  cameraSelect: document.getElementById("cameraSelect"),
  refreshCamerasBtn: document.getElementById("refreshCamerasBtn"),
  trackedSideMode: document.getElementById("trackedSideMode"),
  mirrorDisplay: document.getElementById("mirrorDisplay"),
  qcprAvailable: document.getElementById("qcprAvailable"),
  qcprFields: document.getElementById("qcprFields"),
  qcprScore: document.getElementById("qcprScore"),
  qcprCompressionCount: document.getElementById("qcprCompressionCount"),
  qcprMeanDepthMm: document.getElementById("qcprMeanDepthMm"),
  qcprAdequateDepthPct: document.getElementById("qcprAdequateDepthPct"),
  qcprAdequateRecoilPct: document.getElementById("qcprAdequateRecoilPct"),
  qcprMeanRateCpm: document.getElementById("qcprMeanRateCpm"),
  qcprCompressionFractionPct: document.getElementById("qcprCompressionFractionPct"),
  qcprLongestPauseSec: document.getElementById("qcprLongestPauseSec"),
  qcprImproveRecoil: document.getElementById("qcprImproveRecoil"),
  qcprImproveRate: document.getElementById("qcprImproveRate"),
  qcprImproveDepth: document.getElementById("qcprImproveDepth"),
  qcprImproveOther: document.getElementById("qcprImproveOther"),
  qcprOtherNote: document.getElementById("qcprOtherNote"),
  video: document.getElementById("video"),
  videoCard: document.getElementById("videoCard"),
  canvas: document.getElementById("overlayCanvas"),
  recordStatus: document.getElementById("recordStatus"),
  timerDisplay: document.getElementById("timerDisplay"),
  sessionDisplay: document.getElementById("sessionDisplay"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  stopCameraBtn: document.getElementById("stopCameraBtn"),
  startTestBtn: document.getElementById("startTestBtn"),
  stopTestBtn: document.getElementById("stopTestBtn"),
  systemMessage: document.getElementById("systemMessage"),
  qualityStatus: document.getElementById("qualityStatus"),
  elbowStatus: document.getElementById("elbowStatus"),
  alignmentStatus: document.getElementById("alignmentStatus"),
  trunkStatus: document.getElementById("trunkStatus"),
  rateStatus: document.getElementById("rateStatus"),
  sideStatus: document.getElementById("sideStatus"),
  qualityCard: document.getElementById("qualityCard"),
  sideCard: document.getElementById("sideCard"),
  elbowCard: document.getElementById("elbowCard"),
  alignmentCard: document.getElementById("alignmentCard"),
  trunkCard: document.getElementById("trunkCard"),
  rateCard: document.getElementById("rateCard"),
  leftArmDiagnostic: document.getElementById("leftArmDiagnostic"),
  rightArmDiagnostic: document.getElementById("rightArmDiagnostic"),
  leftPrimaryBadge: document.getElementById("leftPrimaryBadge"),
  rightPrimaryBadge: document.getElementById("rightPrimaryBadge"),
  leftElbowAngle: document.getElementById("leftElbowAngle"),
  rightElbowAngle: document.getElementById("rightElbowAngle"),
  leftElbowState: document.getElementById("leftElbowState"),
  rightElbowState: document.getElementById("rightElbowState"),
  leftAlignmentState: document.getElementById("leftAlignmentState"),
  rightAlignmentState: document.getElementById("rightAlignmentState"),
  leftVisibility: document.getElementById("leftVisibility"),
  rightVisibility: document.getElementById("rightVisibility"),
  leftJump: document.getElementById("leftJump"),
  rightJump: document.getElementById("rightJump"),
  downloadRawBtn: document.getElementById("downloadRawBtn"),
  downloadLandmarksBtn: document.getElementById("downloadLandmarksBtn"),
  downloadMetricsBtn: document.getElementById("downloadMetricsBtn"),
  downloadMetadataBtn: document.getElementById("downloadMetadataBtn"),
  downloadZipBtn: document.getElementById("downloadZipBtn")
};

const ctx = els.canvas.getContext("2d");

let poseLandmarker = null;
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let rawVideoBlob = null;
let rawVideoExtension = "webm";
let rafId = null;
let lastVideoTime = -1;
let latestLandmarks = null;
let smoothedDisplayMap = null;
let latestPoseCount = 0;
let latestPoseTimestampMs = 0;
let lastRecordPointMap = null;
let lastDetectionMs = null;
let lastFramePerfMs = null;
let cameraSettings = null;
let selectedCameraLabel = "";
let selectedCameraShort = "";
let cameraStartRequestPerfMs = 0;
let cameraReadyPerfMs = 0;
let cameraReadyIso = "";
let firstPoseDetectedPerfMs = 0;
let firstPoseDetectedIso = "";

let isCameraRunning = false;
let isRecording = false;
let isPreparing = false;
let prepCountdownTimerId = null;
let autoTrackedSide = "right";
let sessionId = "";
let fileBase = "";
let recordingStartMs = 0;
let recordingStopMs = 0;
let recordingDurationSec = 120;
let selectedPrepCountdownSec = DEFAULT_PREP_COUNTDOWN_SEC;
let recordingRequestedPerfMs = 0;
let recordingStartIso = "";
let recordingFinalizedIso = "";
let firstRecordedLandmarkPerfMs = 0;
let firstRecordedLandmarkElapsedSec = null;
let recordingTimerId = null;
let frameIndex = 0;

let landmarkRows = [];
let metricRows = [];
let detectionMsValues = [];
let frameIntervalValues = [];
let poseFpsValues = [];
let signalWindow = [];
let elbowAngleWindow = [];
let leftDiagnosticElbowWindow = [];
let rightDiagnosticElbowWindow = [];
let shoulderYWindow = [];
let hipYWindow = [];
let currentMetrics = makeEmptyMetrics();
let finalMetadata = null;
let csvLandmarksBlob = null;
let csvMetricsBlob = null;
let metadataBlob = null;

function makeEmptyMetrics() {
  return {
    trackedSide: "auto",
    trackedSideReason: "待機",
    qualityStatus: "待機",
    elbowStatus: "待機",
    alignmentStatus: "待機",
    trunkStatus: "待機",
    rateStatus: "估算中",
    rateBpm: "",
    compressionSignalPx: "",
    compressionAmplitudePx: "",
    elbowAngleDeg: "",
    elbowAngleMeanDeg: "",
    elbowAngleSdDeg: "",
    shoulderWristOffsetPx: "",
    shoulderWristOffsetNorm: "",
    shoulderYAmplitudePx: "",
    hipYAmplitudePx: "",
    detectionQualityScore: ""
  };
}

function setMessage(text) {
  els.systemMessage.textContent = text;
}

function setStatus(card, labelEl, text, level = "") {
  labelEl.textContent = text;
  card.classList.remove("ok", "warn", "bad");
  if (level) card.classList.add(level);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function makeSessionId(d = new Date()) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function sanitizeFilePart(value, fallback) {
  const v = String(value || "").trim();
  if (!v) return fallback;
  return v.replace(/[\\/:*?"<>|\s]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || fallback;
}

function makeFileBase() {
  const subject = sanitizeFilePart(els.subjectCode.value, "NOID");
  const stage = sanitizeFilePart(els.testStage.value, "stage");
  return `${subject}_${stage}_${sessionId}`;
}

function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

function mean(arr) {
  const nums = arr.filter(Number.isFinite);
  if (!nums.length) return "";
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sd(arr) {
  const nums = arr.filter(Number.isFinite);
  if (nums.length < 2) return "";
  const m = mean(nums);
  return Math.sqrt(nums.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / (nums.length - 1));
}

function min(arr) {
  const nums = arr.filter(Number.isFinite);
  return nums.length ? Math.min(...nums) : "";
}

function max(arr) {
  const nums = arr.filter(Number.isFinite);
  return nums.length ? Math.max(...nums) : "";
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return "";
  const p = Math.pow(10, digits);
  return Math.round(value * p) / p;
}

function optionalNumber(el) {
  const raw = String(el?.value ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function isMobileOrTabletDevice() {
  const ua = navigator.userAgent || "";
  const touchMac = /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  return /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua) || touchMac;
}

function rearCameraScore(label = "") {
  const text = String(label).toLowerCase();
  if (!text) return 0;
  if (/(back|rear|environment|後置|後鏡頭|背面)/i.test(text)) return 4;
  if (/(main camera|主相機|wide back|ultra wide back|telephoto back)/i.test(text)) return 3;
  if (/(front|user|前置|前鏡頭|facetime)/i.test(text)) return -3;
  return 0;
}

function getOrientationSnapshot() {
  const orientationType = screen.orientation?.type || "";
  const orientationAngle = Number.isFinite(screen.orientation?.angle)
    ? screen.orientation.angle
    : (Number.isFinite(window.orientation) ? window.orientation : null);
  return {
    viewport_width: window.innerWidth || null,
    viewport_height: window.innerHeight || null,
    screen_width: screen.width || null,
    screen_height: screen.height || null,
    device_pixel_ratio: window.devicePixelRatio || 1,
    screen_orientation_type: orientationType || null,
    screen_orientation_angle: orientationAngle,
    video_orientation: cameraSettings?.width && cameraSettings?.height
      ? (cameraSettings.height > cameraSettings.width ? "portrait" : "landscape")
      : null
  };
}

function getQcprMetadata() {
  const available = els.qcprAvailable?.value === "yes";
  if (!available) return { available: false };

  const flags = [];
  if (els.qcprImproveRecoil?.checked) flags.push("recoil");
  if (els.qcprImproveRate?.checked) flags.push("rate");
  if (els.qcprImproveDepth?.checked) flags.push("depth");
  if (els.qcprImproveOther?.checked) flags.push("other");

  return {
    available: true,
    entry_method: "manual_from_laerdal_qcpr_app_result",
    score: optionalNumber(els.qcprScore),
    compression_count: optionalNumber(els.qcprCompressionCount),
    mean_depth_mm: optionalNumber(els.qcprMeanDepthMm),
    adequate_depth_pct: optionalNumber(els.qcprAdequateDepthPct),
    adequate_recoil_pct: optionalNumber(els.qcprAdequateRecoilPct),
    mean_rate_cpm: optionalNumber(els.qcprMeanRateCpm),
    compression_fraction_pct: optionalNumber(els.qcprCompressionFractionPct),
    longest_pause_sec: optionalNumber(els.qcprLongestPauseSec),
    improvement_flags: flags,
    other_note: String(els.qcprOtherNote?.value || "").trim() || null
  };
}

function updateQcprVisibility() {
  if (!els.qcprFields) return;
  els.qcprFields.hidden = els.qcprAvailable?.value !== "yes";
}

function resetQcprForNewSession() {
  if (els.qcprAvailable) els.qcprAvailable.value = "no";
  [
    els.qcprScore, els.qcprCompressionCount, els.qcprMeanDepthMm, els.qcprAdequateDepthPct,
    els.qcprAdequateRecoilPct, els.qcprMeanRateCpm, els.qcprCompressionFractionPct,
    els.qcprLongestPauseSec, els.qcprOtherNote
  ].filter(Boolean).forEach(el => { el.value = ""; });
  [els.qcprImproveRecoil, els.qcprImproveRate, els.qcprImproveDepth, els.qcprImproveOther]
    .filter(Boolean).forEach(el => { el.checked = false; });
  updateQcprVisibility();
}

function updateStartTestButtonLabel() {
  const prep = Number(els.prepCountdownSec?.value ?? DEFAULT_PREP_COUNTDOWN_SEC);
  els.startTestBtn.textContent = prep > 0
    ? `開始測試 / ${prep}秒倒數後錄影`
    : "開始測試 / 立即錄影";
}

function refreshMetadataAfterFormChange() {
  if (!rawVideoBlob || !recordingFinalizedIso || !finalMetadata) return;
  finalMetadata = {
    ...finalMetadata,
    metadata_updated_at: new Date().toISOString(),
    qcpr: getQcprMetadata()
  };
  metadataBlob = new Blob([JSON.stringify(finalMetadata, null, 2)], { type: "application/json;charset=utf-8" });
  enableDownloads();
}

function distance(a, b) {
  if (!a || !b || !Number.isFinite(a.px) || !Number.isFinite(b.px)) return "";
  return Math.hypot(a.px - b.px, a.py - b.py);
}

function angleDeg(a, b, c) {
  if (!a || !b || !c) return "";
  const bax = a.px - b.px;
  const bay = a.py - b.py;
  const bcx = c.px - b.px;
  const bcy = c.py - b.py;
  const mag1 = Math.hypot(bax, bay);
  const mag2 = Math.hypot(bcx, bcy);
  if (!mag1 || !mag2) return "";
  const cos = Math.max(-1, Math.min(1, (bax * bcx + bay * bcy) / (mag1 * mag2)));
  return Math.acos(cos) * 180 / Math.PI;
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r\t]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map(h => csvEscape(row[h])).join(","));
  }
  return "\ufeff" + lines.join("\n");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function getPointMap(landmarks) {
  const map = {};
  if (!landmarks) return map;

  for (const [name, idx] of Object.entries(MP_INDEX)) {
    const lm = landmarks[idx];
    if (!lm) continue;
    map[name] = {
      name,
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility ?? "",
      px: lm.x * els.canvas.width,
      py: lm.y * els.canvas.height
    };
  }

  const ls = map.left_shoulder;
  const rs = map.right_shoulder;
  if (ls && rs) {
    map.neck_mid = {
      name: "neck_mid",
      x: (ls.x + rs.x) / 2,
      y: (ls.y + rs.y) / 2,
      z: avgOptional(ls.z, rs.z),
      visibility: avgOptional(ls.visibility, rs.visibility),
      px: (ls.px + rs.px) / 2,
      py: (ls.py + rs.py) / 2
    };
  }
  return map;
}

function avgOptional(a, b) {
  if (Number.isFinite(a) && Number.isFinite(b)) return (a + b) / 2;
  if (Number.isFinite(a)) return a;
  if (Number.isFinite(b)) return b;
  return "";
}

function addSteps(pointMap, previousMap) {
  for (const name of POINTS) {
    const p = pointMap[name];
    if (!p) continue;
    const prev = previousMap?.[name];
    if (prev && Number.isFinite(prev.px) && Number.isFinite(prev.py)) {
      p.step_px = Math.hypot(p.px - prev.px, p.py - prev.py);
      p.jump = p.step_px > JUMP_THRESHOLD_PX ? 1 : 0;
    } else {
      p.step_px = "";
      p.jump = 0;
    }
  }
}

function sideVisibilityScore(pointMap, side) {
  const parts = ["shoulder", "elbow", "wrist", "hip"].map(part => pointMap[`${side}_${part}`]);
  return parts.reduce((sum, p) => {
    const vis = Number.isFinite(p?.visibility) ? p.visibility : 0;
    const inFrame = p && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 ? 0.15 : -0.25;
    return sum + vis + inFrame;
  }, 0);
}

function sideAverageZ(pointMap, side) {
  const parts = ["shoulder", "elbow", "wrist"].map(part => pointMap[`${side}_${part}`]);
  const vals = parts.map(p => p?.z).filter(Number.isFinite);
  if (!vals.length) return "";
  return mean(vals);
}

function scoreTrackedSide(pointMap, side) {
  const visibilityScore = sideVisibilityScore(pointMap, side);
  const avgZ = sideAverageZ(pointMap, side);
  const proximityScore = Number.isFinite(avgZ) ? -avgZ * 6 : 0;
  return visibilityScore + proximityScore;
}

function getSelectedSide(pointMap) {
  const mode = els.trackedSideMode.value;
  if (mode === "left" || mode === "right") {
    autoTrackedSide = mode;
    return mode;
  }

  const leftZ = sideAverageZ(pointMap, "left");
  const rightZ = sideAverageZ(pointMap, "right");
  const leftScore = scoreTrackedSide(pointMap, "left");
  const rightScore = scoreTrackedSide(pointMap, "right");

  let candidate;
  if (Number.isFinite(leftZ) && Number.isFinite(rightZ) && Math.abs(leftZ - rightZ) >= AUTO_SIDE_Z_MARGIN) {
    // MediaPipe z 值較小者通常較靠近鏡頭。
    candidate = leftZ < rightZ ? "left" : "right";
  } else {
    candidate = leftScore >= rightScore ? "left" : "right";
  }

  const candidateScore = candidate === "left" ? leftScore : rightScore;
  const currentScore = autoTrackedSide === "left" ? leftScore : rightScore;

  // 保留 V2.2.3 的遲滯邏輯，避免自動選手臂左右來回跳。
  if (!autoTrackedSide || !["left", "right"].includes(autoTrackedSide)) {
    autoTrackedSide = candidate;
  } else if (candidate !== autoTrackedSide && candidateScore > currentScore + AUTO_SIDE_SWITCH_MARGIN) {
    autoTrackedSide = candidate;
  } else if (candidate !== autoTrackedSide && Number.isFinite(leftZ) && Number.isFinite(rightZ) && Math.abs(leftZ - rightZ) >= AUTO_SIDE_Z_MARGIN * 1.8) {
    autoTrackedSide = candidate;
  }

  return autoTrackedSide;
}

function getTrackedSideReason(pointMap, trackedSide) {
  const mode = els.trackedSideMode.value;
  if (mode === "left") return "固定左側";
  if (mode === "right") return "固定右側";
  const leftZ = sideAverageZ(pointMap, "left");
  const rightZ = sideAverageZ(pointMap, "right");
  if (Number.isFinite(leftZ) && Number.isFinite(rightZ) && Math.abs(leftZ - rightZ) >= AUTO_SIDE_Z_MARGIN) {
    return "自動：鏡頭近側";
  }
  return "自動：較穩定側";
}

function sideMetricSnapshot(pointMap, side) {
  const S = pointMap[`${side}_shoulder`];
  const E = pointMap[`${side}_elbow`];
  const W = pointMap[`${side}_wrist`];
  const H = pointMap[`${side}_hip`];
  const elbowAngle = angleDeg(W, E, S);
  const torsoLen = distance(S, H);
  const shoulderWristOffsetPx = S && W ? Math.abs(S.px - W.px) : "";
  const shoulderWristOffsetNorm = Number.isFinite(shoulderWristOffsetPx) && Number.isFinite(torsoLen) && torsoLen > 0
    ? shoulderWristOffsetPx / torsoLen
    : "";
  const vis = [S, E, W, H].filter(Boolean).map(p => Number.isFinite(p.visibility) ? p.visibility : 0);
  return {
    elbowAngleDeg: round(elbowAngle, 2),
    shoulderWristOffsetPx: round(shoulderWristOffsetPx, 2),
    shoulderWristOffsetNorm: round(shoulderWristOffsetNorm, 4),
    minVisibility: round(vis.length ? Math.min(...vis) : "", 4),
    meanVisibility: round(vis.length ? mean(vis) : "", 4),
    avgZ: round(sideAverageZ(pointMap, side), 5),
    score: round(scoreTrackedSide(pointMap, side), 3)
  };
}

function computeSideDiagnostic(pointMap, side, now, window) {
  const S = pointMap[`${side}_shoulder`];
  const E = pointMap[`${side}_elbow`];
  const W = pointMap[`${side}_wrist`];
  const H = pointMap[`${side}_hip`];
  const snapshot = sideMetricSnapshot(pointMap, side);
  const elbowAngle = Number(snapshot.elbowAngleDeg);
  const minVis = Number(snapshot.minVisibility);
  const currentJumpCount = [S, E, W, H].filter(p => p?.jump === 1).length;

  updateRolling(window, { t: now, v: elbowAngle }, 3.0);
  const elbowValues = window.map(o => o.v).filter(Number.isFinite);
  const elbowMean = mean(elbowValues);
  const elbowSd = sd(elbowValues);

  let elbowStatus = "偵測不穩";
  let elbowLevel = "warn";
  if (minVis >= QUALITY_MIN_VISIBILITY && Number.isFinite(elbowAngle)) {
    if (elbowMean >= 165 && (!Number.isFinite(elbowSd) || elbowSd <= 12)) {
      elbowStatus = "穩定";
      elbowLevel = "ok";
    } else if (elbowMean < 160 || (Number.isFinite(elbowSd) && elbowSd > 18)) {
      elbowStatus = "可能彎曲";
      elbowLevel = "bad";
    } else {
      elbowStatus = "觀察中";
      elbowLevel = "warn";
    }
  }

  let alignmentStatus = "偵測不穩";
  let alignmentLevel = "warn";
  const shoulderWristOffsetNorm = Number(snapshot.shoulderWristOffsetNorm);
  if (minVis >= QUALITY_MIN_VISIBILITY && Number.isFinite(shoulderWristOffsetNorm)) {
    if (shoulderWristOffsetNorm <= 0.28) {
      alignmentStatus = "良好";
      alignmentLevel = "ok";
    } else if (shoulderWristOffsetNorm >= 0.40) {
      alignmentStatus = "偏移";
      alignmentLevel = "bad";
    } else {
      alignmentStatus = "觀察中";
      alignmentLevel = "warn";
    }
  }

  return {
    elbowAngleDeg: Number.isFinite(elbowAngle) ? elbowAngle : "",
    elbowStatus,
    elbowLevel,
    alignmentStatus,
    alignmentLevel,
    minVisibility: Number.isFinite(minVis) ? minVis : "",
    currentJumpCount
  };
}

function setDiagnosticLevel(card, level) {
  if (!card) return;
  card.classList.remove("ok", "warn", "bad");
  if (level) card.classList.add(level);
}

function updateBilateralDiagnosticDisplay(leftDiagnostic, rightDiagnostic, trackedSide) {
  const formatAngle = value => Number.isFinite(value) ? `${value.toFixed(1)}°` : "—";
  const formatVis = value => Number.isFinite(value) ? value.toFixed(2) : "—";
  const formatJump = value => Number.isFinite(value) ? String(value) : "—";

  if (els.leftElbowAngle) els.leftElbowAngle.textContent = formatAngle(leftDiagnostic.elbowAngleDeg);
  if (els.rightElbowAngle) els.rightElbowAngle.textContent = formatAngle(rightDiagnostic.elbowAngleDeg);
  if (els.leftElbowState) els.leftElbowState.textContent = leftDiagnostic.elbowStatus;
  if (els.rightElbowState) els.rightElbowState.textContent = rightDiagnostic.elbowStatus;
  if (els.leftAlignmentState) els.leftAlignmentState.textContent = leftDiagnostic.alignmentStatus;
  if (els.rightAlignmentState) els.rightAlignmentState.textContent = rightDiagnostic.alignmentStatus;
  if (els.leftVisibility) els.leftVisibility.textContent = formatVis(leftDiagnostic.minVisibility);
  if (els.rightVisibility) els.rightVisibility.textContent = formatVis(rightDiagnostic.minVisibility);
  if (els.leftJump) els.leftJump.textContent = formatJump(leftDiagnostic.currentJumpCount);
  if (els.rightJump) els.rightJump.textContent = formatJump(rightDiagnostic.currentJumpCount);

  const leftLevel = leftDiagnostic.elbowLevel;
  const rightLevel = rightDiagnostic.elbowLevel;
  setDiagnosticLevel(els.leftArmDiagnostic, leftLevel);
  setDiagnosticLevel(els.rightArmDiagnostic, rightLevel);

  if (els.leftPrimaryBadge) els.leftPrimaryBadge.hidden = trackedSide !== "left";
  if (els.rightPrimaryBadge) els.rightPrimaryBadge.hidden = trackedSide !== "right";
}

function computeMetrics(pointMap, elapsedSec, detectionMs, frameIntervalMs) {
  const trackedSide = getSelectedSide(pointMap);
  const trackedSideReason = getTrackedSideReason(pointMap, trackedSide);
  const leftSnapshot = sideMetricSnapshot(pointMap, "left");
  const rightSnapshot = sideMetricSnapshot(pointMap, "right");
  const diagnosticNow = isRecording ? elapsedSec : performance.now() / 1000;
  const leftDiagnostic = computeSideDiagnostic(pointMap, "left", diagnosticNow, leftDiagnosticElbowWindow);
  const rightDiagnostic = computeSideDiagnostic(pointMap, "right", diagnosticNow, rightDiagnosticElbowWindow);
  const S = pointMap[`${trackedSide}_shoulder`];
  const E = pointMap[`${trackedSide}_elbow`];
  const W = pointMap[`${trackedSide}_wrist`];
  const H = pointMap[`${trackedSide}_hip`];
  const now = elapsedSec;

  const elbowAngle = angleDeg(W, E, S);
  const torsoLen = distance(S, H);
  const shoulderWristOffsetPx = S && W ? Math.abs(S.px - W.px) : "";
  const shoulderWristOffsetNorm = Number.isFinite(shoulderWristOffsetPx) && Number.isFinite(torsoLen) && torsoLen > 0
    ? shoulderWristOffsetPx / torsoLen
    : "";

  const keypoints = [S, E, W, H].filter(Boolean);
  const visList = keypoints.map(p => Number.isFinite(p.visibility) ? p.visibility : 0);
  const minVis = visList.length ? Math.min(...visList) : 0;
  const currentJumpCount = [S, E, W, H].filter(p => p?.jump === 1).length;
  const outOfFrameCount = [S, E, W, H].filter(p => p && (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)).length;
  const poseAgeMs = performance.now() - latestPoseTimestampMs;

  let qualityStatus = "請調整角度";
  let qualityLevel = "warn";
  let detectionQualityScore = 0;
  if (latestPoseCount < 1 || !latestLandmarks || poseAgeMs > POSE_STALE_MS) {
    qualityStatus = "偵測不穩";
    qualityLevel = "bad";
  } else {
    detectionQualityScore = Math.max(0, Math.min(100, (minVis * 80) - (currentJumpCount * 12) - (outOfFrameCount * 15) + 20));
    if (minVis >= QUALITY_MIN_VISIBILITY && currentJumpCount === 0 && outOfFrameCount === 0) {
      qualityStatus = "良好";
      qualityLevel = "ok";
    } else if (minVis < 0.45 || outOfFrameCount >= 2) {
      qualityStatus = "請調整角度";
      qualityLevel = "bad";
    }
  }

  updateRolling(elbowAngleWindow, { t: now, v: elbowAngle }, 3.0);
  const elbowValues = elbowAngleWindow.map(o => o.v).filter(Number.isFinite);
  const elbowMean = mean(elbowValues);
  const elbowSd = sd(elbowValues);

  let elbowStatus = "偵測不穩";
  let elbowLevel = "warn";
  if (minVis >= QUALITY_MIN_VISIBILITY && Number.isFinite(elbowAngle)) {
    if (elbowMean >= 165 && (!Number.isFinite(elbowSd) || elbowSd <= 12)) {
      elbowStatus = "穩定";
      elbowLevel = "ok";
    } else if (elbowMean < 160 || (Number.isFinite(elbowSd) && elbowSd > 18)) {
      elbowStatus = "可能彎曲";
      elbowLevel = "bad";
    } else {
      elbowStatus = "觀察中";
      elbowLevel = "warn";
    }
  }

  let alignmentStatus = "偵測不穩";
  let alignmentLevel = "warn";
  if (minVis >= QUALITY_MIN_VISIBILITY && Number.isFinite(shoulderWristOffsetNorm)) {
    if (shoulderWristOffsetNorm <= 0.28) {
      alignmentStatus = "良好";
      alignmentLevel = "ok";
    } else if (shoulderWristOffsetNorm >= 0.40) {
      alignmentStatus = "偏移";
      alignmentLevel = "bad";
    } else {
      alignmentStatus = "觀察中";
      alignmentLevel = "warn";
    }
  }

  if (Number.isFinite(S?.py)) updateRolling(shoulderYWindow, { t: now, v: S.py }, 6.0);
  if (Number.isFinite(H?.py)) updateRolling(hipYWindow, { t: now, v: H.py }, 6.0);
  const shoulderAmp = percentileRange(shoulderYWindow.map(o => o.v), 0.10, 0.90);
  const hipAmp = percentileRange(hipYWindow.map(o => o.v), 0.10, 0.90);

  const compressionSignal = computeCompressionSignal(S, W);
  if (Number.isFinite(compressionSignal)) updateRolling(signalWindow, { t: now, v: compressionSignal }, 12.0);
  const rateBpm = estimateRateBpm(signalWindow);
  const compressionAmp = percentileRange(signalWindow.map(o => o.v), 0.10, 0.90);

  let trunkStatus = "偵測不穩";
  let trunkLevel = "warn";
  if (minVis >= QUALITY_MIN_VISIBILITY && Number.isFinite(shoulderAmp) && Number.isFinite(hipAmp)) {
    if (shoulderAmp >= 8 && hipAmp <= shoulderAmp * 0.85) {
      trunkStatus = "有";
      trunkLevel = "ok";
    } else if (shoulderAmp < 5) {
      trunkStatus = "不足";
      trunkLevel = "bad";
    } else {
      trunkStatus = "觀察中";
      trunkLevel = "warn";
    }
  }

  let rateStatus = "估算中";
  let rateLevel = "warn";
  if (Number.isFinite(rateBpm)) {
    rateStatus = `${Math.round(rateBpm)} 次/分鐘`;
    if (rateBpm >= 100 && rateBpm <= 120) rateLevel = "ok";
    else rateLevel = "bad";
  }

  currentMetrics = {
    trackedSide,
    trackedSideReason,
    leftElbowAngleDeg: leftSnapshot.elbowAngleDeg,
    rightElbowAngleDeg: rightSnapshot.elbowAngleDeg,
    leftMinVisibility: leftSnapshot.minVisibility,
    rightMinVisibility: rightSnapshot.minVisibility,
    leftMeanVisibility: leftSnapshot.meanVisibility,
    rightMeanVisibility: rightSnapshot.meanVisibility,
    leftArmZ: leftSnapshot.avgZ,
    rightArmZ: rightSnapshot.avgZ,
    leftSideScore: leftSnapshot.score,
    rightSideScore: rightSnapshot.score,
    leftShoulderWristOffsetNorm: leftSnapshot.shoulderWristOffsetNorm,
    rightShoulderWristOffsetNorm: rightSnapshot.shoulderWristOffsetNorm,
    qualityStatus,
    qualityLevel,
    elbowStatus,
    elbowLevel,
    alignmentStatus,
    alignmentLevel,
    trunkStatus,
    trunkLevel,
    rateStatus,
    rateLevel,
    rateBpm: round(rateBpm, 2),
    compressionSignalPx: round(compressionSignal, 2),
    compressionAmplitudePx: round(compressionAmp, 2),
    elbowAngleDeg: round(elbowAngle, 2),
    elbowAngleMeanDeg: round(elbowMean, 2),
    elbowAngleSdDeg: round(elbowSd, 2),
    shoulderWristOffsetPx: round(shoulderWristOffsetPx, 2),
    shoulderWristOffsetNorm: round(shoulderWristOffsetNorm, 4),
    shoulderYAmplitudePx: round(shoulderAmp, 2),
    hipYAmplitudePx: round(hipAmp, 2),
    detectionQualityScore: round(detectionQualityScore, 1),
    detectionMs: round(detectionMs, 2),
    frameIntervalMs: round(frameIntervalMs, 2),
    poseFpsCurrent: Number.isFinite(frameIntervalMs) && frameIntervalMs > 0 ? round(1000 / frameIntervalMs, 2) : "",
    minVisibility: round(minVis, 4),
    currentJumpCount,
    outOfFrameCount
  };

  setStatus(els.qualityCard, els.qualityStatus, qualityStatus, qualityLevel);
  const sideLabel = trackedSide === "right" ? "右側" : "左側";
  if (els.sideCard && els.sideStatus) setStatus(els.sideCard, els.sideStatus, `${sideLabel}｜${trackedSideReason.replace("自動：", "")}`, "ok");
  setStatus(els.elbowCard, els.elbowStatus, elbowStatus, elbowLevel);
  setStatus(els.alignmentCard, els.alignmentStatus, alignmentStatus, alignmentLevel);
  setStatus(els.trunkCard, els.trunkStatus, trunkStatus, trunkLevel);
  setStatus(els.rateCard, els.rateStatus, rateStatus, rateLevel);
  updateBilateralDiagnosticDisplay(leftDiagnostic, rightDiagnostic, trackedSide);

  return currentMetrics;
}

function computeCompressionSignal(S, W) {
  if (Number.isFinite(S?.py) && Number.isFinite(W?.py)) return (0.65 * W.py) + (0.35 * S.py);
  if (Number.isFinite(W?.py)) return W.py;
  if (Number.isFinite(S?.py)) return S.py;
  return "";
}

function updateRolling(arr, item, seconds) {
  if (!Number.isFinite(item.v)) return;
  arr.push(item);
  const minT = item.t - seconds;
  while (arr.length && arr[0].t < minT) arr.shift();
}

function percentileRange(values, lo = 0.10, hi = 0.90) {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (nums.length < 5) return "";
  const q = (p) => {
    const idx = Math.min(nums.length - 1, Math.max(0, Math.floor(p * (nums.length - 1))));
    return nums[idx];
  };
  return q(hi) - q(lo);
}

function estimateRateBpm(window) {
  const pts = window.filter(p => Number.isFinite(p.v));
  if (pts.length < 90) return "";
  const values = pts.map(p => p.v);
  const amp = percentileRange(values, 0.10, 0.90);
  if (!Number.isFinite(amp) || amp < 5) return "";

  const smooth = movingAverage(values, 5);
  const threshold = Math.min(12, Math.max(3, amp * 0.18));
  const peaks = [];
  let lastPeakT = -Infinity;
  for (let i = 2; i < smooth.length - 2; i++) {
    const v = smooth[i];
    if (v > smooth[i - 1] && v >= smooth[i + 1] && v > smooth[i - 2] && v >= smooth[i + 2]) {
      const localMin = Math.min(...smooth.slice(Math.max(0, i - 8), Math.min(smooth.length, i + 9)));
      const prominence = v - localMin;
      const t = pts[i].t;
      if (prominence >= threshold && t - lastPeakT >= 0.32) {
        peaks.push(t);
        lastPeakT = t;
      }
    }
  }
  if (peaks.length < 4) return "";
  const duration = peaks[peaks.length - 1] - peaks[0];
  if (duration <= 0) return "";
  const bpm = ((peaks.length - 1) / duration) * 60;
  if (bpm < 40 || bpm > 180) return "";
  return bpm;
}

function movingAverage(values, n) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - Math.floor(n / 2)); j <= Math.min(values.length - 1, i + Math.floor(n / 2)); j++) {
      sum += values[j];
      count++;
    }
    out.push(sum / count);
  }
  return out;
}

function makeLandmarkRow(elapsedSec, videoTimeSec, pointMap, detectionMs, frameIntervalMs, timing = {}) {
  const row = {
    app_version: APP_VERSION,
    frame_index: frameIndex,
    timestamp_iso: new Date().toISOString(),
    elapsed_sec: round(elapsedSec, 4),
    video_time_sec: round(videoTimeSec, 4),
    phase: "recording",
    model_key: "full",
    model_label: "Pose Landmarker Full",
    requested_quality: currentRequestedQuality,
    requested_width: currentRequestedWidth,
    requested_height: currentRequestedHeight,
    requested_fps: DEFAULT_FPS,
    actual_width: cameraSettings?.width || "",
    actual_height: cameraSettings?.height || "",
    actual_frame_rate: cameraSettings?.frameRate || "",
    camera_label: selectedCameraLabel,
    camera_device_short: selectedCameraShort,
    pose_count: latestPoseCount,
    detection_ms: round(detectionMs, 3),
    frame_interval_ms: round(frameIntervalMs, 3),
    pose_fps_current: Number.isFinite(frameIntervalMs) && frameIntervalMs > 0 ? round(1000 / frameIntervalMs, 3) : "",
    jump_threshold_px: JUMP_THRESHOLD_PX,
    video_time_sec_observed: round(timing.observedVideoTimeSec, 4),
    frame_observed_elapsed_sec: Number.isFinite(timing.frameObservedPerfMs) ? round((timing.frameObservedPerfMs - recordingStartMs) / 1000, 4) : "",
    detection_start_elapsed_sec: Number.isFinite(timing.detectionStartPerfMs) ? round((timing.detectionStartPerfMs - recordingStartMs) / 1000, 4) : "",
    detection_end_elapsed_sec: Number.isFinite(timing.detectionEndPerfMs) ? round((timing.detectionEndPerfMs - recordingStartMs) / 1000, 4) : "",
    result_logged_elapsed_sec: Number.isFinite(timing.resultLoggedPerfMs) ? round((timing.resultLoggedPerfMs - recordingStartMs) / 1000, 4) : round(elapsedSec, 4)
  };

  for (const name of POINTS) {
    const p = pointMap[name];
    row[`${name}_x`] = round(p?.x, 6);
    row[`${name}_y`] = round(p?.y, 6);
    row[`${name}_z`] = round(p?.z, 6);
    row[`${name}_visibility`] = round(p?.visibility, 6);
    row[`${name}_px`] = round(p?.px, 3);
    row[`${name}_py`] = round(p?.py, 3);
    row[`${name}_step_px`] = round(p?.step_px, 3);
    row[`${name}_jump`] = p?.jump ?? "";
  }

  row.left_upper_arm_px = round(distance(pointMap.left_shoulder, pointMap.left_elbow), 3);
  row.left_forearm_px = round(distance(pointMap.left_elbow, pointMap.left_wrist), 3);
  row.right_upper_arm_px = round(distance(pointMap.right_shoulder, pointMap.right_elbow), 3);
  row.right_forearm_px = round(distance(pointMap.right_elbow, pointMap.right_wrist), 3);
  row.shoulder_width_px = round(distance(pointMap.left_shoulder, pointMap.right_shoulder), 3);
  row.nose_to_neck_px = round(distance(pointMap.nose, pointMap.neck_mid), 3);

  return row;
}

function makeMetricsRow(elapsedSec, videoTimeSec, metrics) {
  return {
    app_version: APP_VERSION,
    frame_index: frameIndex,
    timestamp_iso: new Date().toISOString(),
    elapsed_sec: round(elapsedSec, 4),
    video_time_sec: round(videoTimeSec, 4),
    session_id: sessionId,
    file_base: fileBase,
    subject_code: sanitizeFilePart(els.subjectCode.value, "NOID"),
    test_stage: els.testStage.value,
    tracked_side: metrics.trackedSide,
    tracked_side_reason: metrics.trackedSideReason,
    left_elbow_angle_deg: metrics.leftElbowAngleDeg,
    right_elbow_angle_deg: metrics.rightElbowAngleDeg,
    left_min_visibility: metrics.leftMinVisibility,
    right_min_visibility: metrics.rightMinVisibility,
    left_mean_visibility: metrics.leftMeanVisibility,
    right_mean_visibility: metrics.rightMeanVisibility,
    left_arm_z: metrics.leftArmZ,
    right_arm_z: metrics.rightArmZ,
    left_side_score: metrics.leftSideScore,
    right_side_score: metrics.rightSideScore,
    left_shoulder_wrist_offset_norm: metrics.leftShoulderWristOffsetNorm,
    right_shoulder_wrist_offset_norm: metrics.rightShoulderWristOffsetNorm,
    quality_status: metrics.qualityStatus,
    elbow_status: metrics.elbowStatus,
    alignment_status: metrics.alignmentStatus,
    trunk_status: metrics.trunkStatus,
    rate_status: metrics.rateStatus,
    rate_bpm: metrics.rateBpm,
    compression_signal_px: metrics.compressionSignalPx,
    compression_amplitude_px: metrics.compressionAmplitudePx,
    wrist_y_px: round(getCurrentSidePoint("wrist")?.py, 3),
    shoulder_y_px: round(getCurrentSidePoint("shoulder")?.py, 3),
    hip_y_px: round(getCurrentSidePoint("hip")?.py, 3),
    elbow_angle_deg: metrics.elbowAngleDeg,
    elbow_angle_mean_deg: metrics.elbowAngleMeanDeg,
    elbow_angle_sd_deg: metrics.elbowAngleSdDeg,
    shoulder_wrist_offset_px: metrics.shoulderWristOffsetPx,
    shoulder_wrist_offset_norm: metrics.shoulderWristOffsetNorm,
    shoulder_y_amplitude_px: metrics.shoulderYAmplitudePx,
    hip_y_amplitude_px: metrics.hipYAmplitudePx,
    detection_quality_score: metrics.detectionQualityScore,
    min_visibility: metrics.minVisibility,
    current_jump_count: metrics.currentJumpCount,
    out_of_frame_count: metrics.outOfFrameCount,
    detection_ms: metrics.detectionMs,
    frame_interval_ms: metrics.frameIntervalMs,
    pose_fps_current: metrics.poseFpsCurrent
  };
}

function getCurrentSidePoint(part) {
  if (!latestLandmarks) return null;
  const pm = getPointMap(latestLandmarks);
  const side = currentMetrics.trackedSide === "right" ? "right" : "left";
  return pm[`${side}_${part}`];
}

function landmarkHeaders() {
  const base = [
    "app_version", "frame_index", "timestamp_iso", "elapsed_sec", "video_time_sec", "phase",
    "model_key", "model_label", "requested_quality", "requested_width", "requested_height", "requested_fps",
    "actual_width", "actual_height", "actual_frame_rate", "camera_label", "camera_device_short",
    "pose_count", "detection_ms", "frame_interval_ms", "pose_fps_current", "jump_threshold_px",
    "video_time_sec_observed", "frame_observed_elapsed_sec", "detection_start_elapsed_sec",
    "detection_end_elapsed_sec", "result_logged_elapsed_sec"
  ];
  for (const name of POINTS) {
    base.push(`${name}_x`, `${name}_y`, `${name}_z`, `${name}_visibility`, `${name}_px`, `${name}_py`, `${name}_step_px`, `${name}_jump`);
  }
  base.push("left_upper_arm_px", "left_forearm_px", "right_upper_arm_px", "right_forearm_px", "shoulder_width_px", "nose_to_neck_px");
  return base;
}

function metricsHeaders() {
  return [
    "app_version", "frame_index", "timestamp_iso", "elapsed_sec", "video_time_sec", "session_id", "file_base",
    "subject_code", "test_stage", "tracked_side", "tracked_side_reason",
    "left_elbow_angle_deg", "right_elbow_angle_deg",
    "left_min_visibility", "right_min_visibility", "left_mean_visibility", "right_mean_visibility",
    "left_arm_z", "right_arm_z", "left_side_score", "right_side_score",
    "left_shoulder_wrist_offset_norm", "right_shoulder_wrist_offset_norm",
    "quality_status", "elbow_status", "alignment_status", "trunk_status", "rate_status", "rate_bpm",
    "compression_signal_px", "compression_amplitude_px", "wrist_y_px", "shoulder_y_px", "hip_y_px",
    "elbow_angle_deg", "elbow_angle_mean_deg", "elbow_angle_sd_deg",
    "shoulder_wrist_offset_px", "shoulder_wrist_offset_norm", "shoulder_y_amplitude_px", "hip_y_amplitude_px",
    "detection_quality_score", "min_visibility", "current_jump_count", "out_of_frame_count",
    "detection_ms", "frame_interval_ms", "pose_fps_current"
  ];
}

function drawFrame() {
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
  if (els.video.readyState >= 2) {
    if (els.mirrorDisplay?.value === "on") {
      ctx.save();
      ctx.translate(els.canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(els.video, 0, 0, els.canvas.width, els.canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(els.video, 0, 0, els.canvas.width, els.canvas.height);
    }
  } else {
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);
  }

  if (latestLandmarks && performance.now() - latestPoseTimestampMs <= POSE_STALE_MS) {
    drawSkeleton(latestLandmarks);
  }
}

function mirrorX(px) {
  return els.mirrorDisplay?.value === "on" && Number.isFinite(px) ? els.canvas.width - px : px;
}

function getSmoothedDisplayMap(pointMap) {
  const out = {};
  for (const name of POINTS) {
    const p = pointMap[name];
    if (!p) continue;
    const prev = smoothedDisplayMap?.[name];
    const clone = { ...p };
    if (prev && Number.isFinite(prev.px) && Number.isFinite(prev.py) && Number.isFinite(p.px) && Number.isFinite(p.py)) {
      clone.px = (DISPLAY_SMOOTH_ALPHA * p.px) + ((1 - DISPLAY_SMOOTH_ALPHA) * prev.px);
      clone.py = (DISPLAY_SMOOTH_ALPHA * p.py) + ((1 - DISPLAY_SMOOTH_ALPHA) * prev.py);
      clone.x = clone.px / els.canvas.width;
      clone.y = clone.py / els.canvas.height;
    }
    out[name] = clone;
  }
  smoothedDisplayMap = out;
  return out;
}

function drawSkeleton(landmarks) {
  const rawPm = getPointMap(landmarks);
  const side = getSelectedSide(rawPm);
  const pm = getSmoothedDisplayMap(rawPm);

  // 先畫軀幹與髖部，讓 CPR 姿勢分析需要的 shoulder-hip linkage 更明顯。
  drawLine(pm.left_shoulder, pm.right_shoulder, "rgba(255,255,255,0.62)", 3);
  drawLine(pm.left_hip, pm.right_hip, "rgba(52, 211, 153, 0.90)", 4);
  drawLine(pm.left_shoulder, pm.left_hip, "rgba(52, 211, 153, 0.55)", 3);
  drawLine(pm.right_shoulder, pm.right_hip, "rgba(52, 211, 153, 0.55)", 3);

  drawSide(pm, "left", side === "left" ? "#22d3ee" : "rgba(34, 211, 238, 0.42)");
  drawSide(pm, "right", side === "right" ? "#facc15" : "rgba(250, 204, 21, 0.42)");

  drawPoint(pm.left_hip, "#34d399", 8, "LH");
  drawPoint(pm.right_hip, "#34d399", 8, "RH");
  drawPoint(pm.nose, "#fb7185", 5, "nose");
  drawPoint(pm.neck_mid, "#ffffff", 5, "neck");
}

function drawSide(pm, side, color) {
  const S = pm[`${side}_shoulder`];
  const E = pm[`${side}_elbow`];
  const W = pm[`${side}_wrist`];
  const H = pm[`${side}_hip`];
  drawLine(S, E, color, 5);
  drawLine(E, W, color, 5);
  drawLine(S, H, color, 4);
  drawPoint(S, color, 6, `${side[0].toUpperCase()}S`);
  drawPoint(E, color, 6, `${side[0].toUpperCase()}E`);
  drawPoint(W, color, 6, `${side[0].toUpperCase()}W`);
  drawPoint(H, color, 6, `${side[0].toUpperCase()}H`);
}

function drawLine(a, b, color, width) {
  if (!a || !b) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(mirrorX(a.px), a.py);
  ctx.lineTo(mirrorX(b.px), b.py);
  ctx.stroke();
  ctx.restore();
}

function drawPoint(p, color, radius, label) {
  if (!p) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const dx = mirrorX(p.px);
  ctx.arc(dx, p.py, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (label) {
    ctx.font = "bold 13px Arial";
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(dx + 7, p.py - 18, 34, 18);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, dx + 10, p.py - 5);
  }
  ctx.restore();
}

async function loadModel() {
  if (poseLandmarker) return;
  setMessage("正在載入 MediaPipe Full 模型，第一次載入可能需要數秒。");
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: FULL_MODEL_URL, delegate: "GPU" },
    runningMode: "VIDEO",
    numPoses: 1,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5
  });
}

async function refreshCameras() {
  const previous = els.cameraSelect.value;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter(d => d.kind === "videoinput");
    const mobileOrTablet = isMobileOrTabletDevice();
    const orderedVideos = mobileOrTablet
      ? [...videos].sort((a, b) => rearCameraScore(b.label) - rearCameraScore(a.label))
      : videos;

    els.cameraSelect.innerHTML = "";
    if (!videos.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "找不到攝影機，請先允許權限";
      els.cameraSelect.appendChild(opt);
      return;
    }

    if (mobileOrTablet) {
      const autoRear = document.createElement("option");
      autoRear.value = "__environment__";
      autoRear.textContent = "★ 自動：後鏡頭優先 (Back Camera)";
      els.cameraSelect.appendChild(autoRear);
    }

    orderedVideos.forEach((device, idx) => {
      const opt = document.createElement("option");
      opt.value = device.deviceId;
      const label = device.label || `攝影機 ${idx + 1}`;
      const rearMark = mobileOrTablet && rearCameraScore(device.label) > 0 ? "★ " : "";
      opt.textContent = `${rearMark}${label}`;
      els.cameraSelect.appendChild(opt);
    });

    if (previous === "__environment__" && mobileOrTablet) {
      els.cameraSelect.value = "__environment__";
    } else if (previous && videos.some(d => d.deviceId === previous)) {
      els.cameraSelect.value = previous;
    } else if (mobileOrTablet) {
      els.cameraSelect.value = "__environment__";
    }
  } catch (err) {
    setMessage(`讀取攝影機清單失敗：${err.message}`);
  }
}


function shouldRequestPortraitCamera() {
  return isMobileOrTabletDevice() && window.matchMedia("(orientation: portrait)").matches;
}

function applyVideoCardAspect(width, height) {
  if (!els.videoCard || !width || !height) return;
  els.videoCard.style.setProperty("--video-aspect", `${width} / ${height}`);
  els.videoCard.classList.toggle("video-portrait", height > width);
  els.videoCard.classList.toggle("video-landscape", width >= height);
}

async function startCameraAndModel() {
  try {
    cameraStartRequestPerfMs = performance.now();
    cameraReadyPerfMs = 0;
    cameraReadyIso = "";
    firstPoseDetectedPerfMs = 0;
    firstPoseDetectedIso = "";
    els.startCameraBtn.disabled = true;
    setMessage("正在啟動攝影機與模型...");

    // 先要求一次權限，讓瀏覽器提供攝影機名稱。若已授權，此步驟會很快。
    if (!els.cameraSelect.value) {
      const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      temp.getTracks().forEach(t => t.stop());
      await refreshCameras();
    }

    await loadModel();

    const selectedCameraChoice = els.cameraSelect.value;
    const selectedDeviceId = selectedCameraChoice && selectedCameraChoice !== "__environment__"
      ? selectedCameraChoice
      : "";
    const portraitRequest = shouldRequestPortraitCamera();
    currentRequestedWidth = portraitRequest ? 480 : DEFAULT_WIDTH;
    currentRequestedHeight = portraitRequest ? 640 : DEFAULT_HEIGHT;
    currentRequestedQuality = `${currentRequestedWidth}x${currentRequestedHeight}x${DEFAULT_FPS}`;
    const videoConstraints = {
      width: { ideal: currentRequestedWidth },
      height: { ideal: currentRequestedHeight },
      frameRate: { ideal: DEFAULT_FPS, max: DEFAULT_FPS },
      aspectRatio: { ideal: currentRequestedWidth / currentRequestedHeight }
    };
    if (selectedDeviceId) {
      videoConstraints.deviceId = { exact: selectedDeviceId };
    } else if (selectedCameraChoice === "__environment__" || isMobileOrTabletDevice()) {
      videoConstraints.facingMode = { ideal: "environment" };
    }

    if (mediaStream) stopCameraOnly();
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
    els.video.srcObject = mediaStream;
    await els.video.play();

    const track = mediaStream.getVideoTracks()[0];
    cameraSettings = track.getSettings();
    cameraReadyPerfMs = performance.now();
    cameraReadyIso = new Date().toISOString();
    selectedCameraLabel = track.label || "";
    selectedCameraShort = cameraSettings?.deviceId ? `${cameraSettings.deviceId.slice(0, 6)}…${cameraSettings.deviceId.slice(-4)}` : "";

    els.canvas.width = cameraSettings.width || currentRequestedWidth;
    els.canvas.height = cameraSettings.height || currentRequestedHeight;
    applyVideoCardAspect(els.canvas.width, els.canvas.height);

    await refreshCameras();
    if (cameraSettings?.deviceId && [...els.cameraSelect.options].some(o => o.value === cameraSettings.deviceId)) {
      els.cameraSelect.value = cameraSettings.deviceId;
    }

    isCameraRunning = true;
    els.stopCameraBtn.disabled = false;
    els.startTestBtn.disabled = false;
    els.recordStatus.textContent = "攝影機已啟動";
    const portraitMessage = cameraSettings.width < cameraSettings.height
      ? (shouldRequestPortraitCamera() ? "｜手機直式錄影版面" : "｜直向畫面，電腦研究錄影建議改橫式構圖")
      : "";
    setMessage(`已啟動：${selectedCameraLabel || "攝影機"}｜要求 ${currentRequestedQuality}｜實際 ${cameraSettings.width}×${cameraSettings.height} / ${cameraSettings.frameRate || "?"}fps${portraitMessage}`);

    startLoop();
  } catch (err) {
    els.startCameraBtn.disabled = false;
    setMessage(`啟動失敗：${err.message}。若選外接鏡頭仍跳回內建鏡頭，請重新整理清單後再選一次。`);
  }
}

function startLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  lastVideoTime = -1;
  lastFramePerfMs = null;
  smoothedDisplayMap = null;

  const loop = () => {
    if (!isCameraRunning || !poseLandmarker || !mediaStream) return;

    let pointMap = null;
    let detectionMs = lastDetectionMs;
    let frameIntervalMs = "";

    if (els.video.readyState >= 2 && els.video.videoWidth > 0 && els.video.videoHeight > 0) {
      if (els.video.currentTime !== lastVideoTime) {
        const nowPerf = performance.now();
        const frameObservedPerfMs = nowPerf;
        const observedVideoTimeSec = els.video.currentTime;
        frameIntervalMs = Number.isFinite(lastFramePerfMs) ? nowPerf - lastFramePerfMs : "";
        lastFramePerfMs = nowPerf;
        lastVideoTime = observedVideoTimeSec;

        const detectionStartPerfMs = performance.now();
        let detectionEndPerfMs = detectionStartPerfMs;
        try {
          const result = poseLandmarker.detectForVideo(els.video, nowPerf);
          detectionEndPerfMs = performance.now();
          detectionMs = detectionEndPerfMs - detectionStartPerfMs;
          lastDetectionMs = detectionMs;
          latestPoseCount = result.landmarks?.length || 0;
          if (latestPoseCount > 0) {
            latestLandmarks = result.landmarks[0];
            latestPoseTimestampMs = detectionEndPerfMs;
            if (!firstPoseDetectedPerfMs) {
              firstPoseDetectedPerfMs = detectionEndPerfMs;
              firstPoseDetectedIso = new Date().toISOString();
            }
          }
        } catch (err) {
          detectionEndPerfMs = performance.now();
          console.warn("MediaPipe detectForVideo failed:", err);
          latestPoseCount = 0;
        }

        if (latestLandmarks) {
          pointMap = getPointMap(latestLandmarks);
          addSteps(pointMap, lastRecordPointMap);
          const resultLoggedPerfMs = performance.now();
          const elapsedSec = isRecording ? (resultLoggedPerfMs - recordingStartMs) / 1000 : 0;
          if (isRecording) {
            collectRecordFrame(
              pointMap,
              elapsedSec,
              els.video.currentTime,
              detectionMs,
              frameIntervalMs,
              {
                frameObservedPerfMs,
                observedVideoTimeSec,
                detectionStartPerfMs,
                detectionEndPerfMs,
                resultLoggedPerfMs
              }
            );
          } else {
            computeMetrics(pointMap, elapsedSec, detectionMs, frameIntervalMs);
          }
          lastRecordPointMap = pointMap;
        }
      }
      drawFrame();
    }
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}

function collectRecordFrame(pointMap, elapsedSec, videoTimeSec, detectionMs, frameIntervalMs, timing = {}) {
  if (elapsedSec < 0) return;
  if (!firstRecordedLandmarkPerfMs) {
    firstRecordedLandmarkPerfMs = timing.resultLoggedPerfMs || performance.now();
    firstRecordedLandmarkElapsedSec = elapsedSec;
  }
  const metrics = computeMetrics(pointMap, elapsedSec, detectionMs, frameIntervalMs);
  landmarkRows.push(makeLandmarkRow(elapsedSec, videoTimeSec, pointMap, detectionMs, frameIntervalMs, timing));
  metricRows.push(makeMetricsRow(elapsedSec, videoTimeSec, metrics));
  if (Number.isFinite(detectionMs)) detectionMsValues.push(detectionMs);
  if (Number.isFinite(frameIntervalMs)) {
    frameIntervalValues.push(frameIntervalMs);
    poseFpsValues.push(1000 / frameIntervalMs);
  }
  frameIndex++;
}

function getSupportedMimeType() {
  const candidates = [
    { mime: "video/webm;codecs=vp8", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
    { mime: "video/mp4;codecs=h264", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" }
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: "", ext: "webm" };
}

function startTest() {
  if (!mediaStream || !isCameraRunning) {
    setMessage("請先開啟攝影機與模型。");
    return;
  }
  if (isRecording || isPreparing) return;

  if (recordingFinalizedIso) resetQcprForNewSession();

  sessionId = makeSessionId(new Date());
  fileBase = makeFileBase();
  recordingDurationSec = Number(els.durationSec.value || 120);
  selectedPrepCountdownSec = Number(els.prepCountdownSec?.value ?? DEFAULT_PREP_COUNTDOWN_SEC);
  recordingRequestedPerfMs = performance.now();
  firstRecordedLandmarkPerfMs = 0;
  firstRecordedLandmarkElapsedSec = null;
  autoTrackedSide = "right";
  lastRecordPointMap = null;

  isPreparing = true;
  els.recordStatus.textContent = selectedPrepCountdownSec > 0 ? "準備倒數" : "準備開始";
  els.sessionDisplay.textContent = fileBase;
  els.startTestBtn.disabled = true;
  els.stopTestBtn.disabled = false;
  els.durationSec.disabled = true;
  if (els.prepCountdownSec) els.prepCountdownSec.disabled = true;
  els.subjectCode.disabled = true;
  els.testStage.disabled = true;

  if (selectedPrepCountdownSec <= 0) {
    els.timerDisplay.textContent = formatTime(recordingDurationSec);
    setMessage("準備倒數 0 秒：立即開始錄影與資料紀錄。");
    beginRecordingSession();
    return;
  }

  let remain = selectedPrepCountdownSec;
  els.timerDisplay.textContent = formatTime(remain);
  setMessage(`準備倒數 ${remain} 秒。倒數期間不錄影、不記錄資料，請受試者就定位。`);

  clearInterval(prepCountdownTimerId);
  prepCountdownTimerId = setInterval(() => {
    remain -= 1;
    els.timerDisplay.textContent = formatTime(remain);
    els.recordStatus.textContent = `準備 ${remain}`;
    setMessage(`準備倒數 ${remain} 秒。倒數結束後自動開始錄影。`);
    if (remain <= 0) {
      clearInterval(prepCountdownTimerId);
      prepCountdownTimerId = null;
      beginRecordingSession();
    }
  }, 1000);
}


function beginRecordingSession() {
  if (!isPreparing) return;
  isPreparing = false;

  recordingStartMs = performance.now();
  recordingStartIso = new Date().toISOString();
  recordingStopMs = 0;
  recordingFinalizedIso = "";
  frameIndex = 0;
  landmarkRows = [];
  metricRows = [];
  detectionMsValues = [];
  frameIntervalValues = [];
  poseFpsValues = [];
  signalWindow = [];
  elbowAngleWindow = [];
  leftDiagnosticElbowWindow = [];
  rightDiagnosticElbowWindow = [];
  shoulderYWindow = [];
  hipYWindow = [];
  recordedChunks = [];
  rawVideoBlob = null;
  finalMetadata = null;
  csvLandmarksBlob = null;
  csvMetricsBlob = null;
  metadataBlob = null;
  lastRecordPointMap = null;
  disableDownloads();

  const mime = getSupportedMimeType();
  rawVideoExtension = mime.ext;
  mediaRecorder = new MediaRecorder(mediaStream, mime.mime ? { mimeType: mime.mime } : undefined);
  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) recordedChunks.push(event.data);
  };
  mediaRecorder.onstop = finalizeFiles;
  mediaRecorder.start(1000);

  isRecording = true;
  els.recordStatus.textContent = "● 錄影中";
  els.timerDisplay.textContent = formatTime(recordingDurationSec);
  setMessage("測試與錄影進行中。原始影片與骨架資料會分開保存。");

  updateTimer();
  recordingTimerId = setInterval(updateTimer, 250);
}

function updateTimer() {
  const elapsed = (performance.now() - recordingStartMs) / 1000;
  const remain = recordingDurationSec - elapsed;
  els.timerDisplay.textContent = formatTime(remain);
  if (isRecording && remain <= 0) stopTest();
}

function stopTest() {
  if (isPreparing) {
    isPreparing = false;
    clearInterval(prepCountdownTimerId);
    prepCountdownTimerId = null;
    els.timerDisplay.textContent = formatTime(Number(els.durationSec.value || 120));
    els.recordStatus.textContent = "待機";
    els.stopTestBtn.disabled = true;
    els.startTestBtn.disabled = false;
    els.durationSec.disabled = false;
    if (els.prepCountdownSec) els.prepCountdownSec.disabled = false;
    els.subjectCode.disabled = false;
    els.testStage.disabled = false;
    setMessage("準備倒數已取消。");
    return;
  }

  if (!isRecording) return;
  isRecording = false;
  recordingStopMs = performance.now();
  clearInterval(recordingTimerId);
  recordingTimerId = null;
  els.timerDisplay.textContent = "00:00";
  els.recordStatus.textContent = "處理檔案中";
  els.stopTestBtn.disabled = true;
  els.durationSec.disabled = false;
  if (els.prepCountdownSec) els.prepCountdownSec.disabled = false;
  els.subjectCode.disabled = false;
  els.testStage.disabled = false;
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  } else {
    finalizeFiles();
  }
}

function finalizeFiles() {
  recordingFinalizedIso = new Date().toISOString();
  rawVideoBlob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || "video/webm" });
  const landmarksCsv = toCsv(landmarkHeaders(), landmarkRows);
  const metricsCsv = toCsv(metricsHeaders(), metricRows);
  csvLandmarksBlob = new Blob([landmarksCsv], { type: "text/csv;charset=utf-8" });
  csvMetricsBlob = new Blob([metricsCsv], { type: "text/csv;charset=utf-8" });
  finalMetadata = buildMetadata();
  metadataBlob = new Blob([JSON.stringify(finalMetadata, null, 2)], { type: "application/json;charset=utf-8" });
  enableDownloads();
  els.recordStatus.textContent = "✓ 錄製完成";
  els.startTestBtn.disabled = false;
  setMessage(`檔案已建立：${fileBase}。可單獨下載，也可一鍵下載 ZIP。`);
}

function buildMetadata() {
  const durationActualSec = recordingStopMs ? (recordingStopMs - recordingStartMs) / 1000 : recordingDurationSec;
  const orientation = getOrientationSnapshot();
  const mobileOrTablet = isMobileOrTabletDevice();
  const firstPoseAfterCameraReadyMs = cameraReadyPerfMs && firstPoseDetectedPerfMs
    ? firstPoseDetectedPerfMs - cameraReadyPerfMs
    : null;
  const cameraReadyBeforeRecordRequestSec = cameraReadyPerfMs && recordingRequestedPerfMs
    ? (recordingRequestedPerfMs - cameraReadyPerfMs) / 1000
    : null;
  const firstPoseWarmupBeforeRecordingSec = firstPoseDetectedPerfMs && recordingStartMs && firstPoseDetectedPerfMs <= recordingStartMs
    ? (recordingStartMs - firstPoseDetectedPerfMs) / 1000
    : null;
  const firstRecordedLandmarkAfterStartMs = firstRecordedLandmarkPerfMs && recordingStartMs
    ? firstRecordedLandmarkPerfMs - recordingStartMs
    : null;

  return {
    status: "finished",
    app_version: APP_VERSION,
    tasks_version: TASKS_VERSION,
    generated_at: recordingFinalizedIso || new Date().toISOString(),
    metadata_updated_at: new Date().toISOString(),
    session_id: sessionId,
    file_base: fileBase,
    subject_code: sanitizeFilePart(els.subjectCode.value, "NOID"),
    test_stage: els.testStage.value,
    duration_sec_requested: recordingDurationSec,
    duration_sec_actual: round(durationActualSec, 3),
    prep_countdown_sec: selectedPrepCountdownSec,
    mode: "live_recording",
    video_recording: {
      raw_video_filename: `${fileBase}_raw.${rawVideoExtension}`,
      audio: false,
      mime_type: rawVideoBlob?.type || "",
      size_bytes: rawVideoBlob?.size || 0
    },
    camera: {
      requested_quality: currentRequestedQuality,
      requested_width: currentRequestedWidth,
      requested_height: currentRequestedHeight,
      requested_fps: DEFAULT_FPS,
      mobile_or_tablet: mobileOrTablet,
      preferred_facing_mode: mobileOrTablet ? "environment" : "user_selected",
      actual_facing_mode: cameraSettings?.facingMode || null,
      actual_settings: cameraSettings,
      camera_label: selectedCameraLabel,
      camera_device_short: selectedCameraShort
    },
    display: {
      mirror_display: els.mirrorDisplay?.value === "on",
      ...orientation
    },
    timing: {
      camera_ready_iso: cameraReadyIso || null,
      first_pose_detected_iso: firstPoseDetectedIso || null,
      recording_start_iso: recordingStartIso || null,
      camera_start_request_to_ready_ms: cameraStartRequestPerfMs && cameraReadyPerfMs
        ? round(cameraReadyPerfMs - cameraStartRequestPerfMs, 3)
        : null,
      first_pose_after_camera_ready_ms: Number.isFinite(firstPoseAfterCameraReadyMs)
        ? round(firstPoseAfterCameraReadyMs, 3)
        : null,
      camera_ready_before_record_request_sec: Number.isFinite(cameraReadyBeforeRecordRequestSec)
        ? round(cameraReadyBeforeRecordRequestSec, 4)
        : null,
      record_request_to_record_start_ms: recordingRequestedPerfMs && recordingStartMs
        ? round(recordingStartMs - recordingRequestedPerfMs, 3)
        : null,
      first_pose_warmup_before_recording_sec: Number.isFinite(firstPoseWarmupBeforeRecordingSec)
        ? round(firstPoseWarmupBeforeRecordingSec, 4)
        : null,
      first_recorded_landmark_after_record_start_ms: Number.isFinite(firstRecordedLandmarkAfterStartMs)
        ? round(firstRecordedLandmarkAfterStartMs, 3)
        : null,
      first_recorded_landmark_elapsed_sec: Number.isFinite(firstRecordedLandmarkElapsedSec)
        ? round(firstRecordedLandmarkElapsedSec, 4)
        : null,
      timing_note: "V2.2.8 adds frame-observed and detection start/end elapsed timestamps to landmarks.csv for latency diagnosis; existing elapsed_sec behavior is preserved for backward comparison."
    },
    qcpr: getQcprMetadata(),
    model: {
      model_key: "full",
      model_label: "Pose Landmarker Full",
      model_url: FULL_MODEL_URL,
      wasm_root: WASM_ROOT,
      min_detection_confidence: 0.5,
      min_tracking_confidence: 0.5,
      num_poses: 1
    },
    analysis: {
      tracked_side_mode: els.trackedSideMode.value,
      jump_threshold_px: JUMP_THRESHOLD_PX,
      landmark_row_count: landmarkRows.length,
      posture_metric_row_count: metricRows.length,
      pose_fps_mean: round(mean(poseFpsValues), 3),
      pose_fps_min: round(min(poseFpsValues), 3),
      pose_fps_max: round(max(poseFpsValues), 3),
      detection_ms_mean: round(mean(detectionMsValues), 3),
      detection_ms_min: round(min(detectionMsValues), 3),
      detection_ms_max: round(max(detectionMsValues), 3),
      frame_interval_ms_mean: round(mean(frameIntervalValues), 3),
      compression_depth_note: "compression_signal_px and compression_amplitude_px are image displacement indicators only; they are not centimeter depth measurements."
    },
    user_agent: navigator.userAgent
  };
}


function enableDownloads() {
  els.downloadRawBtn.disabled = !rawVideoBlob;
  els.downloadLandmarksBtn.disabled = !csvLandmarksBlob;
  els.downloadMetricsBtn.disabled = !csvMetricsBlob;
  els.downloadMetadataBtn.disabled = !metadataBlob;
  els.downloadZipBtn.disabled = !(rawVideoBlob && csvLandmarksBlob && csvMetricsBlob && metadataBlob);
}

function disableDownloads() {
  els.downloadRawBtn.disabled = true;
  els.downloadLandmarksBtn.disabled = true;
  els.downloadMetricsBtn.disabled = true;
  els.downloadMetadataBtn.disabled = true;
  els.downloadZipBtn.disabled = true;
}

async function downloadZip() {
  if (!window.JSZip) {
    setMessage("JSZip 尚未載入，請檢查網路後重新整理頁面。");
    return;
  }
  if (!rawVideoBlob || !csvLandmarksBlob || !csvMetricsBlob || !metadataBlob) return;
  const zip = new JSZip();
  const folder = zip.folder(fileBase);
  folder.file(`${fileBase}_raw.${rawVideoExtension}`, rawVideoBlob);
  folder.file(`${fileBase}_landmarks.csv`, csvLandmarksBlob);
  folder.file(`${fileBase}_posture_metrics.csv`, csvMetricsBlob);
  folder.file(`${fileBase}_metadata.json`, metadataBlob);
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${fileBase}.zip`);
}

function stopCameraOnly() {
  if (prepCountdownTimerId) clearInterval(prepCountdownTimerId);
  prepCountdownTimerId = null;
  isPreparing = false;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  isCameraRunning = false;
  latestLandmarks = null;
  smoothedDisplayMap = null;
  latestPoseCount = 0;
  ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
}

function stopCamera() {
  if (isRecording || isPreparing) stopTest();
  stopCameraOnly();
  els.startCameraBtn.disabled = false;
  els.stopCameraBtn.disabled = true;
  els.startTestBtn.disabled = true;
  els.stopTestBtn.disabled = true;
  els.recordStatus.textContent = "待機";
  setMessage("攝影機已停止。");
}

function initEvents() {
  els.refreshCamerasBtn.addEventListener("click", async () => {
    try {
      const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      temp.getTracks().forEach(t => t.stop());
    } catch (_) {}
    await refreshCameras();
    setMessage("攝影機清單已重新整理。請選擇要使用的鏡頭後再啟動。");
  });
  els.startCameraBtn.addEventListener("click", startCameraAndModel);
  els.stopCameraBtn.addEventListener("click", stopCamera);
  els.prepCountdownSec?.addEventListener("change", updateStartTestButtonLabel);
  els.qcprAvailable?.addEventListener("change", () => {
    updateQcprVisibility();
    refreshMetadataAfterFormChange();
  });
  [
    els.qcprScore, els.qcprCompressionCount, els.qcprMeanDepthMm, els.qcprAdequateDepthPct,
    els.qcprAdequateRecoilPct, els.qcprMeanRateCpm, els.qcprCompressionFractionPct,
    els.qcprLongestPauseSec, els.qcprImproveRecoil, els.qcprImproveRate, els.qcprImproveDepth,
    els.qcprImproveOther, els.qcprOtherNote
  ].filter(Boolean).forEach(el => {
    el.addEventListener("input", refreshMetadataAfterFormChange);
    el.addEventListener("change", refreshMetadataAfterFormChange);
  });
  els.startTestBtn.addEventListener("click", startTest);
  els.stopTestBtn.addEventListener("click", stopTest);
  els.downloadRawBtn.addEventListener("click", () => downloadBlob(rawVideoBlob, `${fileBase}_raw.${rawVideoExtension}`));
  els.downloadLandmarksBtn.addEventListener("click", () => downloadBlob(csvLandmarksBlob, `${fileBase}_landmarks.csv`));
  els.downloadMetricsBtn.addEventListener("click", () => downloadBlob(csvMetricsBlob, `${fileBase}_posture_metrics.csv`));
  els.downloadMetadataBtn.addEventListener("click", () => downloadBlob(metadataBlob, `${fileBase}_metadata.json`));
  els.downloadZipBtn.addEventListener("click", downloadZip);
  window.addEventListener("beforeunload", () => {
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
  });
}

async function init() {
  initEvents();
  updateQcprVisibility();
  updateStartTestButtonLabel();
  await refreshCameras();
  els.timerDisplay.textContent = formatTime(Number(els.durationSec.value || 120));
  setStatus(els.qualityCard, els.qualityStatus, "待機", "");
  if (els.sideCard && els.sideStatus) setStatus(els.sideCard, els.sideStatus, "待機", "");
  setStatus(els.elbowCard, els.elbowStatus, "待機", "");
  setStatus(els.alignmentCard, els.alignmentStatus, "待機", "");
  setStatus(els.trunkCard, els.trunkStatus, "待機", "");
  setStatus(els.rateCard, els.rateStatus, "估算中", "");
}

init();
