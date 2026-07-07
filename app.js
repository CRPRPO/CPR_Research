// ==========================================
// CPR 研究用網頁系統 V2.0.0
// 使用純 HTML、CSS、JavaScript + MediaPipe Pose
// ==========================================

let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;
let timerInterval = null;
let prepInterval = null;
let recordingTimeout = null;
let isRecording = false;
let isPreparing = false;
let currentRecordingDuration = 120000;
let lastRecordingLabel = '120s';
let audioContext = null;
let currentRecorderMimeType = '尚未錄影';

let pose = null;
let poseRunning = false;
let poseRafId = null;
let lastPoseTime = 0;
let poseFrameCount = 0;
let poseFpsLastTime = 0;
let poseFps = 0;

const RECORDING_LENGTHS = { '30': 30000, '60': 60000, '120': 120000 };
const PREP_COUNTDOWN_SECONDS = 10;

const QUALITY_MODES = {
    auto: { label: '自動模式', constraints: {} },
    '640x480_30': { label: '640 × 480 / 30fps', constraints: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } } },
    '1280x720_30': { label: '1280 × 720 / 30fps', constraints: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } }
};

const subjectCodeInput = document.getElementById('subjectCode');
const testPhaseSelect = document.getElementById('testPhase');
const cameraSelect = document.getElementById('cameraSelect');
const qualityModeSelect = document.getElementById('qualityMode');
const refreshCamerasBtn = document.getElementById('refreshCamerasBtn');
const startCameraBtn = document.getElementById('startCameraBtn');
const stopCameraBtn = document.getElementById('stopCameraBtn');
const startRecordingBtn = document.getElementById('startRecordingBtn');
const stopRecordingBtn = document.getElementById('stopRecordingBtn');
const downloadBtn = document.getElementById('downloadBtn');
const videoPreview = document.getElementById('videoPreview');
const videoCanvas = document.getElementById('videoCanvas');
const canvasCtx = videoCanvas.getContext('2d');
const videoStatusOverlay = document.getElementById('videoStatusOverlay');
const videoTimerOverlay = document.getElementById('videoTimerOverlay');
const preCountdownOverlay = document.getElementById('preCountdownOverlay');
const timerDisplay = document.getElementById('timerDisplay');
const prepCountdownDisplay = document.getElementById('prepCountdown');
const recordingLengthInputs = document.querySelectorAll('input[name="recordingLength"]');
const timerSizeInputs = document.querySelectorAll('input[name="timerSize"]');
const showSkeletonCheckbox = document.getElementById('showSkeleton');
const cameraStatus = document.getElementById('cameraStatus');
const recordingStatus = document.getElementById('recordingStatus');
const downloadStatus = document.getElementById('downloadStatus');

const diagCameraLabel = document.getElementById('diagCameraLabel');
const diagRequestedMode = document.getElementById('diagRequestedMode');
const diagResolution = document.getElementById('diagResolution');
const diagFrameRate = document.getElementById('diagFrameRate');
const diagAspectRatio = document.getElementById('diagAspectRatio');
const diagMimeType = document.getElementById('diagMimeType');
const diagPoseStatus = document.getElementById('diagPoseStatus');
const diagPoseFps = document.getElementById('diagPoseFps');
const diagCapabilities = document.getElementById('diagCapabilities');
const diagRecommendation = document.getElementById('diagRecommendation');

function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status-message ${type}`;
}

function formatTime(milliseconds) {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function generateFilename(subjectCode, testPhase, lengthLabel) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${subjectCode}_${testPhase}_${lengthLabel}_${year}${month}${date}_${hours}${minutes}.webm`;
}

function getSelectedRecordingLength() {
    const checkedInput = Array.from(recordingLengthInputs).find(input => input.checked);
    return checkedInput ? checkedInput.value : '120';
}

function getSelectedRecordingLabel() {
    return `${getSelectedRecordingLength()}s`;
}

function getSelectedRecordingDuration() {
    return RECORDING_LENGTHS[getSelectedRecordingLength()] || RECORDING_LENGTHS['120'];
}

function getSelectedTimerSize() {
    const checkedInput = Array.from(timerSizeInputs).find(input => input.checked);
    return checkedInput ? checkedInput.value : 'large';
}

function applyTimerSize() {
    videoTimerOverlay.classList.remove('timer-normal', 'timer-large');
    videoTimerOverlay.classList.add(getSelectedTimerSize() === 'normal' ? 'timer-normal' : 'timer-large');
}

function getSelectedQualityModeKey() {
    return qualityModeSelect.value || '1280x720_30';
}

function getSelectedQualityMode() {
    return QUALITY_MODES[getSelectedQualityModeKey()] || QUALITY_MODES['1280x720_30'];
}

function ensureAudioContext() {
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioContext = new AudioContextClass();
    }
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
}

function playTone(startTime, frequency, duration) {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startTime);
    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.4, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
}

function playFinishBeep() {
    try {
        ensureAudioContext();
        if (!audioContext) return;
        const now = audioContext.currentTime;
        playTone(now, 880, 0.18);
        playTone(now + 0.28, 880, 0.18);
        playTone(now + 0.56, 1046, 0.24);
    } catch (error) {
        console.warn('提示音播放失敗:', error);
    }
}

function resetDiagnostics() {
    diagCameraLabel.textContent = '尚未啟動';
    diagRequestedMode.textContent = getSelectedQualityMode().label;
    diagResolution.textContent = '尚未啟動';
    diagFrameRate.textContent = '尚未啟動';
    diagAspectRatio.textContent = '尚未啟動';
    diagMimeType.textContent = currentRecorderMimeType || '尚未錄影';
    diagPoseStatus.textContent = '尚未啟動';
    diagPoseFps.textContent = '尚未啟動';
    diagCapabilities.textContent = '啟動攝影機後顯示。不同瀏覽器與攝影機支援程度不同。';
    diagRecommendation.textContent = 'V2.0.0 先測骨架是否穩定顯示，再進一步做角度與頻率判斷。';
}

function safeRound(value, decimals = 2) {
    if (typeof value !== 'number') return '未提供';
    return Number(value.toFixed(decimals));
}

function formatRange(capability) {
    if (!capability) return '未提供';
    if (Array.isArray(capability)) return capability.join(', ');
    if (typeof capability === 'object') {
        const min = capability.min !== undefined ? capability.min : '?';
        const max = capability.max !== undefined ? capability.max : '?';
        return `${min} – ${max}`;
    }
    return String(capability);
}

function summarizeCapabilities(capabilities) {
    if (!capabilities) return '此瀏覽器或攝影機未提供 capabilities。';
    const lines = [];
    lines.push(`width: ${formatRange(capabilities.width)}`);
    lines.push(`height: ${formatRange(capabilities.height)}`);
    lines.push(`frameRate: ${formatRange(capabilities.frameRate)}`);
    if (capabilities.aspectRatio) lines.push(`aspectRatio: ${formatRange(capabilities.aspectRatio)}`);
    if (capabilities.facingMode) lines.push(`facingMode: ${formatRange(capabilities.facingMode)}`);
    return lines.join('\\n');
}

function updateDiagnosticsFromTrack(track) {
    if (!track) {
        resetDiagnostics();
        return;
    }
    const settings = track.getSettings ? track.getSettings() : {};
    const capabilities = track.getCapabilities ? track.getCapabilities() : null;
    const label = track.label || '未提供名稱';
    const width = settings.width || '未提供';
    const height = settings.height || '未提供';
    const frameRate = settings.frameRate !== undefined ? `${safeRound(settings.frameRate, 2)} fps` : '未提供';
    const aspectRatio = settings.aspectRatio !== undefined ? safeRound(settings.aspectRatio, 3) : (settings.width && settings.height ? safeRound(settings.width / settings.height, 3) : '未提供');

    diagCameraLabel.textContent = label;
    diagRequestedMode.textContent = getSelectedQualityMode().label;
    diagResolution.textContent = `${width} × ${height}`;
    diagFrameRate.textContent = frameRate;
    diagAspectRatio.textContent = String(aspectRatio);
    diagMimeType.textContent = currentRecorderMimeType || '尚未錄影';
    diagCapabilities.textContent = summarizeCapabilities(capabilities);

    if (settings.frameRate && settings.frameRate < 24) {
        diagRecommendation.textContent = '目前實際幀率低於 24fps。建議改測 640×480/30fps 或自動模式。';
    } else if (settings.frameRate && settings.frameRate >= 29) {
        diagRecommendation.textContent = '目前幀率接近 30fps，適合測骨架穩定度。若仍閃爍，請檢查曝光、防閃爍 60Hz 與室內 LED 燈。';
    } else {
        diagRecommendation.textContent = '請觀察肩、肘、腕、髖骨架點是否穩定，尤其是手腕與手肘是否跳動。';
    }
}

async function refreshCameraList() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        showStatus(cameraStatus, '✗ 此瀏覽器不支援攝影機清單功能', 'error');
        return;
    }
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        const currentValue = cameraSelect.value;
        cameraSelect.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '預設攝影機（優先後鏡頭 / 外接鏡頭）';
        cameraSelect.appendChild(defaultOption);

        videoInputs.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `攝影機 ${index + 1}`;
            cameraSelect.appendChild(option);
        });

        if (currentValue && Array.from(cameraSelect.options).some(option => option.value === currentValue)) {
            cameraSelect.value = currentValue;
        }

        showStatus(cameraStatus, videoInputs.length ? `✓ 已找到 ${videoInputs.length} 個攝影機來源` : '尚未偵測到攝影機。請確認攝影機已連接，並允許瀏覽器使用攝影機。', videoInputs.length ? 'success' : 'info');
    } catch (error) {
        console.error('取得攝影機清單失敗:', error);
        showStatus(cameraStatus, `✗ 取得攝影機清單失敗: ${error.message}`, 'error');
    }
}

function buildVideoConstraints() {
    const selectedDeviceId = cameraSelect.value;
    const selectedMode = getSelectedQualityMode();
    const constraints = { ...selectedMode.constraints };
    if (selectedDeviceId) {
        constraints.deviceId = { exact: selectedDeviceId };
    } else {
        constraints.facingMode = { ideal: 'environment' };
    }
    return constraints;
}

async function initPose() {
    if (pose) return pose;
    if (!window.Pose) {
        throw new Error('MediaPipe Pose 尚未載入，請確認網路連線或 CDN 是否可用。');
    }
    pose = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    pose.onResults(onPoseResults);
    return pose;
}

function resizeCanvasToVideo() {
    const width = videoPreview.videoWidth || 1280;
    const height = videoPreview.videoHeight || 720;
    if (videoCanvas.width !== width || videoCanvas.height !== height) {
        videoCanvas.width = width;
        videoCanvas.height = height;
    }
}

function startPoseLoop() {
    if (poseRunning) return;
    poseRunning = true;
    poseFrameCount = 0;
    poseFpsLastTime = performance.now();
    diagPoseStatus.textContent = '骨架偵測啟動中';

    const loop = async () => {
        if (!poseRunning || !mediaStream) return;
        if (videoPreview.readyState >= 2) {
            try {
                resizeCanvasToVideo();
                await pose.send({ image: videoPreview });
                poseFrameCount++;
                const now = performance.now();
                if (now - poseFpsLastTime >= 1000) {
                    poseFps = poseFrameCount / ((now - poseFpsLastTime) / 1000);
                    diagPoseFps.textContent = `${safeRound(poseFps, 1)} fps`;
                    poseFrameCount = 0;
                    poseFpsLastTime = now;
                }
            } catch (error) {
                console.warn('MediaPipe 偵測錯誤:', error);
                diagPoseStatus.textContent = '骨架偵測錯誤';
            }
        }
        poseRafId = requestAnimationFrame(loop);
    };
    loop();
}

function stopPoseLoop() {
    poseRunning = false;
    if (poseRafId) cancelAnimationFrame(poseRafId);
    poseRafId = null;
    clearCanvas();
    diagPoseStatus.textContent = '骨架偵測已停止';
    diagPoseFps.textContent = '尚未啟動';
}

function clearCanvas() {
    canvasCtx.clearRect(0, 0, videoCanvas.width, videoCanvas.height);
}

function drawPoint(lm, color, label) {
    const x = lm.x * videoCanvas.width;
    const y = lm.y * videoCanvas.height;
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 9, 0, Math.PI * 2);
    canvasCtx.fillStyle = color;
    canvasCtx.fill();
    canvasCtx.lineWidth = 3;
    canvasCtx.strokeStyle = '#ffffff';
    canvasCtx.stroke();
    if (label) {
        canvasCtx.font = '20px Arial';
        canvasCtx.fillStyle = '#ffffff';
        canvasCtx.fillText(label, x + 10, y - 10);
    }
}

function drawLine(a, b, color) {
    const ax = a.x * videoCanvas.width;
    const ay = a.y * videoCanvas.height;
    const bx = b.x * videoCanvas.width;
    const by = b.y * videoCanvas.height;
    canvasCtx.beginPath();
    canvasCtx.moveTo(ax, ay);
    canvasCtx.lineTo(bx, by);
    canvasCtx.lineWidth = 7;
    canvasCtx.strokeStyle = color;
    canvasCtx.stroke();
}

function validLm(lm) {
    return lm && (lm.visibility === undefined || lm.visibility >= 0.35);
}

function drawSide(landmarks, side, color) {
    const idx = side === 'L'
        ? { shoulder: 11, elbow: 13, wrist: 15, hip: 23 }
        : { shoulder: 12, elbow: 14, wrist: 16, hip: 24 };
    const shoulder = landmarks[idx.shoulder];
    const elbow = landmarks[idx.elbow];
    const wrist = landmarks[idx.wrist];
    const hip = landmarks[idx.hip];

    if (validLm(wrist) && validLm(elbow)) drawLine(wrist, elbow, color);
    if (validLm(elbow) && validLm(shoulder)) drawLine(elbow, shoulder, color);
    if (validLm(shoulder) && validLm(hip)) drawLine(shoulder, hip, color);

    if (validLm(shoulder)) drawPoint(shoulder, color, `${side}肩`);
    if (validLm(elbow)) drawPoint(elbow, color, `${side}肘`);
    if (validLm(wrist)) drawPoint(wrist, color, `${side}腕`);
    if (validLm(hip)) drawPoint(hip, color, `${side}髖`);
}

function onPoseResults(results) {
    clearCanvas();
    if (!showSkeletonCheckbox.checked) {
        diagPoseStatus.textContent = '骨架顯示關閉';
        return;
    }
    if (!results.poseLandmarks) {
        diagPoseStatus.textContent = '未偵測到人體';
        return;
    }
    diagPoseStatus.textContent = '已偵測到人體骨架';
    drawSide(results.poseLandmarks, 'L', '#00e5ff');
    drawSide(results.poseLandmarks, 'R', '#ffeb3b');
}

async function startCamera() {
    try {
        if (mediaStream) stopCamera();
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: buildVideoConstraints(), audio: false });
        videoPreview.srcObject = mediaStream;
        await new Promise(resolve => {
            if (videoPreview.readyState >= 1) resolve();
            else videoPreview.onloadedmetadata = resolve;
        });
        resizeCanvasToVideo();

        startCameraBtn.disabled = true;
        stopCameraBtn.disabled = false;
        startRecordingBtn.disabled = false;
        cameraSelect.disabled = true;
        qualityModeSelect.disabled = true;

        updateStatusOverlay('待機');
        updateTimerOverlay(formatTime(getSelectedRecordingDuration()));
        updatePreCountdownOverlay('');
        applyTimerSize();

        const track = mediaStream.getVideoTracks()[0];
        updateDiagnosticsFromTrack(track);
        showStatus(cameraStatus, '✓ 攝影機已啟動，MediaPipe 骨架偵測準備中', 'success');

        await initPose();
        startPoseLoop();

        await refreshCameraList();
        cameraSelect.disabled = true;
    } catch (error) {
        console.error('無法啟動攝影機或骨架偵測:', error);
        showStatus(cameraStatus, `✗ 錯誤: ${error.message}`, 'error');
    }
}

function stopCamera() {
    stopPoseLoop();
    if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
    videoPreview.srcObject = null;
    mediaStream = null;
    if (isRecording || isPreparing) stopRecording();
    startCameraBtn.disabled = false;
    stopCameraBtn.disabled = true;
    startRecordingBtn.disabled = true;
    stopRecordingBtn.disabled = true;
    cameraSelect.disabled = false;
    qualityModeSelect.disabled = false;
    updateStatusOverlay('攝影機未啟動');
    updateTimerOverlay('00:00');
    updatePreCountdownOverlay('');
    resetDiagnostics();
    showStatus(cameraStatus, '✓ 攝影機已停止', 'info');
}

function startRecording() {
    if (isPreparing || isRecording) return;
    if (!subjectCodeInput.value.trim()) {
        showStatus(recordingStatus, '✗ 請輸入受試者代碼', 'error');
        return;
    }
    if (!testPhaseSelect.value) {
        showStatus(recordingStatus, '✗ 請選擇測驗階段', 'error');
        return;
    }
    if (!mediaStream) {
        showStatus(recordingStatus, '✗ 攝影機尚未啟動', 'error');
        return;
    }
    ensureAudioContext();
    applyTimerSize();
    currentRecordingDuration = getSelectedRecordingDuration();
    lastRecordingLabel = getSelectedRecordingLabel();

    subjectCodeInput.disabled = true;
    testPhaseSelect.disabled = true;
    recordingLengthInputs.forEach(input => input.disabled = true);
    timerSizeInputs.forEach(input => input.disabled = true);
    stopCameraBtn.disabled = true;
    startRecordingBtn.disabled = true;
    stopRecordingBtn.disabled = true;
    downloadBtn.disabled = true;

    let prepSeconds = PREP_COUNTDOWN_SECONDS;
    updateStatusOverlay('預備中');
    updateTimerOverlay(formatTime(currentRecordingDuration));
    updatePreCountdownOverlay(String(prepSeconds));
    isPreparing = true;
    prepCountdownDisplay.textContent = String(prepSeconds);
    showStatus(recordingStatus, '● 預備倒數中...', 'info');
    showStatus(downloadStatus, '', 'info');

    prepInterval = setInterval(() => {
        prepSeconds -= 1;
        if (prepSeconds > 0) {
            prepCountdownDisplay.textContent = String(prepSeconds);
            updatePreCountdownOverlay(String(prepSeconds));
            return;
        }
        clearInterval(prepInterval);
        prepInterval = null;
        prepCountdownDisplay.textContent = '開始';
        updatePreCountdownOverlay('開始');
        setTimeout(() => beginRecording(), 350);
    }, 1000);
}

function beginRecording() {
    if (!mediaStream) {
        showStatus(recordingStatus, '✗ 攝影機不可用，無法開始錄製', 'error');
        resetPreparation();
        return;
    }
    recordedChunks = [];
    const options = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options.mimeType = 'video/webm;codecs=vp8';
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options.mimeType = 'video/webm';

    try {
        mediaRecorder = new MediaRecorder(mediaStream, options);
    } catch (error) {
        console.warn('指定 MIME type 建立 MediaRecorder 失敗，改用預設設定:', error);
        mediaRecorder = new MediaRecorder(mediaStream);
    }

    currentRecorderMimeType = mediaRecorder.mimeType || options.mimeType || '瀏覽器預設';
    diagMimeType.textContent = currentRecorderMimeType;

    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const blobType = mediaRecorder.mimeType || 'video/webm';
        window.recordedBlob = new Blob(recordedChunks, { type: blobType });
        downloadBtn.disabled = false;
        updateStatusOverlay('✓ 錄製完成');
        updateTimerOverlay('00:00');
        updatePreCountdownOverlay('');
        showStatus(recordingStatus, '✓ 錄製已完成', 'success');
        showStatus(downloadStatus, '✓ 可以下載影片', 'success');
        playFinishBeep();
    };

    mediaRecorder.start();
    recordingStartTime = Date.now();
    isRecording = true;
    isPreparing = false;
    stopRecordingBtn.disabled = false;
    timerDisplay.classList.add('recording');
    updateStatusOverlay('● 錄製中');
    updateTimerOverlay(formatTime(currentRecordingDuration));
    updatePreCountdownOverlay('');
    prepCountdownDisplay.textContent = '';
    showStatus(recordingStatus, '● 錄製中...', 'info');
    updateTimer();
    timerInterval = setInterval(updateTimer, 100);
    recordingTimeout = setTimeout(() => { if (isRecording) stopRecording(); }, currentRecordingDuration);
}

function resetPreparation() {
    if (prepInterval) clearInterval(prepInterval);
    prepInterval = null;
    isPreparing = false;
    prepCountdownDisplay.textContent = '';
    updatePreCountdownOverlay('');
    subjectCodeInput.disabled = false;
    testPhaseSelect.disabled = false;
    recordingLengthInputs.forEach(input => input.disabled = false);
    timerSizeInputs.forEach(input => input.disabled = false);
    stopCameraBtn.disabled = false;
    startRecordingBtn.disabled = !mediaStream;
}

function stopRecording() {
    if (!isRecording && !isPreparing) return;
    if (prepInterval) clearInterval(prepInterval);
    if (recordingTimeout) clearTimeout(recordingTimeout);
    if (timerInterval) clearInterval(timerInterval);
    prepInterval = null; recordingTimeout = null; timerInterval = null;

    const wasRecording = isRecording;
    isRecording = false; isPreparing = false; recordingStartTime = null;
    timerDisplay.textContent = '00:00';
    timerDisplay.classList.remove('recording');
    prepCountdownDisplay.textContent = '';
    updatePreCountdownOverlay('');

    if (wasRecording && mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    } else {
        updateStatusOverlay('待機');
        updateTimerOverlay(formatTime(getSelectedRecordingDuration()));
    }

    startRecordingBtn.disabled = !mediaStream;
    stopRecordingBtn.disabled = true;
    subjectCodeInput.disabled = false;
    testPhaseSelect.disabled = false;
    recordingLengthInputs.forEach(input => input.disabled = false);
    timerSizeInputs.forEach(input => input.disabled = false);
    stopCameraBtn.disabled = false;
    showStatus(recordingStatus, wasRecording ? '✓ 錄製已停止' : '準備就緒', wasRecording ? 'success' : 'info');
}

function updateTimer() {
    if (!recordingStartTime || !isRecording) return;
    const elapsed = Date.now() - recordingStartTime;
    const remaining = Math.max(0, currentRecordingDuration - elapsed);
    timerDisplay.textContent = formatTime(remaining);
    updateTimerOverlay(formatTime(remaining));
}

function updateStatusOverlay(text) {
    videoStatusOverlay.textContent = text;
    videoStatusOverlay.classList.remove('status-idle', 'status-preparing', 'status-recording', 'status-complete', 'status-camera-off');
    if (text === '待機') videoStatusOverlay.classList.add('status-idle');
    else if (text === '預備中') videoStatusOverlay.classList.add('status-preparing');
    else if (text.includes('錄製中')) videoStatusOverlay.classList.add('status-recording');
    else if (text.includes('錄製完成')) videoStatusOverlay.classList.add('status-complete');
    else if (text === '攝影機未啟動') videoStatusOverlay.classList.add('status-camera-off');
}

function updateTimerOverlay(text) { videoTimerOverlay.textContent = text; }

function updatePreCountdownOverlay(text) {
    if (text && String(text).trim() !== '') {
        preCountdownOverlay.textContent = text;
        preCountdownOverlay.classList.remove('hidden');
    } else {
        preCountdownOverlay.textContent = '';
        preCountdownOverlay.classList.add('hidden');
    }
}

function downloadVideo() {
    if (!window.recordedBlob) {
        showStatus(downloadStatus, '✗ 沒有可下載的影片', 'error');
        return;
    }
    const filename = generateFilename(subjectCodeInput.value.trim(), testPhaseSelect.value, lastRecordingLabel);
    const url = URL.createObjectURL(window.recordedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showStatus(downloadStatus, `✓ 正在下載: ${filename}`, 'success');
}

refreshCamerasBtn.addEventListener('click', refreshCameraList);
startCameraBtn.addEventListener('click', startCamera);
stopCameraBtn.addEventListener('click', stopCamera);
startRecordingBtn.addEventListener('click', startRecording);
stopRecordingBtn.addEventListener('click', stopRecording);
downloadBtn.addEventListener('click', downloadVideo);
showSkeletonCheckbox.addEventListener('change', () => { if (!showSkeletonCheckbox.checked) clearCanvas(); });

recordingLengthInputs.forEach(input => {
    input.addEventListener('change', () => {
        if (!isRecording && !isPreparing) {
            const duration = getSelectedRecordingDuration();
            updateTimerOverlay(formatTime(duration));
            timerDisplay.textContent = formatTime(duration);
        }
    });
});

timerSizeInputs.forEach(input => input.addEventListener('change', () => { if (!isRecording && !isPreparing) applyTimerSize(); }));

qualityModeSelect.addEventListener('change', () => {
    if (!isRecording && !isPreparing) {
        diagRequestedMode.textContent = getSelectedQualityMode().label;
        if (mediaStream) showStatus(cameraStatus, '畫質模式已變更，請停止攝影機後重新啟動才會套用。', 'info');
    }
});

if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', refreshCameraList);
}

document.addEventListener('DOMContentLoaded', () => {
    timerDisplay.textContent = formatTime(getSelectedRecordingDuration());
    prepCountdownDisplay.textContent = '準備就緒';
    updateStatusOverlay('待機');
    updateTimerOverlay(formatTime(getSelectedRecordingDuration()));
    updatePreCountdownOverlay('');
    applyTimerSize();
    resetDiagnostics();
    showStatus(cameraStatus, '請啟動攝影機。V2.0.0 會載入 MediaPipe 並顯示肩、肘、腕、髖骨架。', 'info');
    showStatus(recordingStatus, '準備就緒', 'info');
    showStatus(downloadStatus, '', 'info');
    refreshCameraList();
});

console.log('CPR 研究用網頁系統 V2.0.0 已載入');
