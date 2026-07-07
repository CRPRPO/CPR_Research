// ==========================================
// CPR 研究用網頁系統 V1.0.9
// 使用純 HTML、CSS、JavaScript
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

const RECORDING_LENGTHS = { '30': 30000, '60': 60000, '120': 120000 };
const PREP_COUNTDOWN_SECONDS = 10;

const QUALITY_MODES = {
    auto: { label: '自動模式', constraints: {} },
    '640x480_30': { label: '640 × 480 / 30fps', constraints: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } } },
    '800x600_30': { label: '800 × 600 / 30fps', constraints: { width: { ideal: 800 }, height: { ideal: 600 }, frameRate: { ideal: 30, max: 30 } } },
    '1280x720_20': { label: '1280 × 720 / 20fps', constraints: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 20, max: 20 } } },
    '1280x720_30': { label: '1280 × 720 / 30fps', constraints: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } },
    '1920x1080_25': { label: '1920 × 1080 / 25fps', constraints: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 25, max: 25 } } }
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
const videoStatusOverlay = document.getElementById('videoStatusOverlay');
const videoTimerOverlay = document.getElementById('videoTimerOverlay');
const preCountdownOverlay = document.getElementById('preCountdownOverlay');
const timerDisplay = document.getElementById('timerDisplay');
const prepCountdownDisplay = document.getElementById('prepCountdown');
const recordingLengthInputs = document.querySelectorAll('input[name="recordingLength"]');
const timerSizeInputs = document.querySelectorAll('input[name="timerSize"]');
const cameraStatus = document.getElementById('cameraStatus');
const recordingStatus = document.getElementById('recordingStatus');
const downloadStatus = document.getElementById('downloadStatus');

const diagCameraLabel = document.getElementById('diagCameraLabel');
const diagRequestedMode = document.getElementById('diagRequestedMode');
const diagResolution = document.getElementById('diagResolution');
const diagFrameRate = document.getElementById('diagFrameRate');
const diagAspectRatio = document.getElementById('diagAspectRatio');
const diagMimeType = document.getElementById('diagMimeType');
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
    if (!videoTimerOverlay) return;
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
    diagCapabilities.textContent = '啟動攝影機後顯示。不同瀏覽器與攝影機支援程度不同。';
    diagRecommendation.textContent = '若外接鏡頭閃爍，請先測 640×480/30fps，再測自動模式。';
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
    if (capabilities.focusMode) lines.push(`focusMode: ${formatRange(capabilities.focusMode)}`);
    if (capabilities.exposureMode) lines.push(`exposureMode: ${formatRange(capabilities.exposureMode)}`);
    if (capabilities.whiteBalanceMode) lines.push(`whiteBalanceMode: ${formatRange(capabilities.whiteBalanceMode)}`);
    if (capabilities.zoom) lines.push(`zoom: ${formatRange(capabilities.zoom)}`);
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
    updateDiagnosticRecommendation(settings);
}

function updateDiagnosticRecommendation(settings) {
    const width = settings.width;
    const height = settings.height;
    const frameRate = settings.frameRate;
    let advice = '影像穩定性優先於最高解析度。請以 30 秒測試比較閃爍與掉幀。';
    if (frameRate && frameRate < 24) {
        advice = '目前實際幀率低於 24fps。若要分析每秒約 2 次按壓，建議改測 640×480/30fps 或自動模式。';
    } else if (frameRate && frameRate >= 29 && width >= 640) {
        advice = '目前幀率接近 30fps，適合先做 CPR 頻率與姿勢偵測測試。若仍有閃爍，請檢查曝光、防閃爍 60Hz 與室內 LED 燈。';
    } else if (width >= 1280 && height >= 720) {
        advice = '目前解析度足夠。若畫面閃爍或延遲，請測 640×480/30fps 是否更穩。';
    }
    diagRecommendation.textContent = advice;
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

        if (videoInputs.length === 0) {
            showStatus(cameraStatus, '尚未偵測到攝影機。請確認攝影機已連接，並允許瀏覽器使用攝影機。', 'info');
        } else {
            showStatus(cameraStatus, `✓ 已找到 ${videoInputs.length} 個攝影機來源`, 'success');
        }
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

async function startCamera() {
    try {
        if (mediaStream) stopCamera();
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: buildVideoConstraints(), audio: false });
        videoPreview.srcObject = mediaStream;
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
        showStatus(cameraStatus, '✓ 攝影機已啟動', 'success');

        await refreshCameraList();
        cameraSelect.disabled = true;
    } catch (error) {
        console.error('無法啟動攝影機:', error);
        showStatus(cameraStatus, `✗ 錯誤: ${error.message}`, 'error');
    }
}

function stopCamera() {
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

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const blobType = mediaRecorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunks, { type: blobType });
        window.recordedBlob = blob;
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
    recordingTimeout = setTimeout(() => {
        if (isRecording) stopRecording();
    }, currentRecordingDuration);
}

function resetPreparation() {
    if (prepInterval) {
        clearInterval(prepInterval);
        prepInterval = null;
    }
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
    if (prepInterval) {
        clearInterval(prepInterval);
        prepInterval = null;
    }
    if (recordingTimeout) {
        clearTimeout(recordingTimeout);
        recordingTimeout = null;
    }
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    const wasRecording = isRecording;
    isRecording = false;
    isPreparing = false;
    recordingStartTime = null;
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
    if (!videoStatusOverlay) return;
    videoStatusOverlay.textContent = text;
    videoStatusOverlay.classList.remove('status-idle', 'status-preparing', 'status-recording', 'status-complete', 'status-camera-off');
    if (text === '待機') videoStatusOverlay.classList.add('status-idle');
    else if (text === '預備中') videoStatusOverlay.classList.add('status-preparing');
    else if (text.includes('錄製中')) videoStatusOverlay.classList.add('status-recording');
    else if (text.includes('錄製完成')) videoStatusOverlay.classList.add('status-complete');
    else if (text === '攝影機未啟動') videoStatusOverlay.classList.add('status-camera-off');
}

function updateTimerOverlay(text) {
    if (videoTimerOverlay) videoTimerOverlay.textContent = text;
}

function updatePreCountdownOverlay(text) {
    if (!preCountdownOverlay) return;
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

recordingLengthInputs.forEach(input => {
    input.addEventListener('change', () => {
        if (!isRecording && !isPreparing) {
            const duration = getSelectedRecordingDuration();
            updateTimerOverlay(formatTime(duration));
            timerDisplay.textContent = formatTime(duration);
        }
    });
});

timerSizeInputs.forEach(input => {
    input.addEventListener('change', () => {
        if (!isRecording && !isPreparing) applyTimerSize();
    });
});

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
    showStatus(cameraStatus, '請啟動攝影機。若要使用外接 USB 攝影機，請先插上後按「重新整理攝影機清單」。', 'info');
    showStatus(recordingStatus, '準備就緒', 'info');
    showStatus(downloadStatus, '', 'info');
    refreshCameraList();
});

console.log('CPR 研究用網頁系統 V1.0.9 已載入');
