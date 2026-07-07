// ==========================================
// CPR 研究用網頁系統 V1.0.8
// 使用純 HTML、CSS、JavaScript
// ==========================================

// ===== 全局變數 =====
let mediaStream = null;                // 攝影機媒體流
let mediaRecorder = null;              // 媒體錄製器
let recordedChunks = [];               // 存放錄製的視頻分片
let recordingStartTime = null;         // 錄製開始時間
let timerInterval = null;              // 計時器區間 ID
let prepInterval = null;               // 預備倒數區間 ID
let recordingTimeout = null;           // 正式錄製自動停止定時
let isRecording = false;               // 是否正在錄製中
let isPreparing = false;               // 是否正在預備倒數中
let currentRecordingDuration = 120000; // 當前選擇的錄影時長
let lastRecordingLabel = '120s';       // 上一次錄製的時長標籤
let audioContext = null;               // 完成提示音使用，不會錄進影片

// 錄影長度設定
const RECORDING_LENGTHS = {
    '30': 30000,
    '60': 60000,
    '120': 120000
};

// 預備倒數秒數
const PREP_COUNTDOWN_SECONDS = 10;

// ===== 取得 DOM 元素 =====
const subjectCodeInput = document.getElementById('subjectCode');
const testPhaseSelect = document.getElementById('testPhase');
const cameraSelect = document.getElementById('cameraSelect');
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

// ===== 工具函數 =====
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

    if (getSelectedTimerSize() === 'normal') {
        videoTimerOverlay.classList.add('timer-normal');
    } else {
        videoTimerOverlay.classList.add('timer-large');
    }
}

// ===== 完成提示音 =====
// 此聲音只由瀏覽器播放，不會錄進影片，因為 getUserMedia 設定 audio: false。
function ensureAudioContext() {
    if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioContext = new AudioContextClass();
        }
    }

    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
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

// ===== 攝影機清單與選擇 =====
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

    const baseConstraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 }
    };

    if (selectedDeviceId) {
        return {
            ...baseConstraints,
            deviceId: { exact: selectedDeviceId }
        };
    }

    return {
        ...baseConstraints,
        facingMode: { ideal: 'environment' }
    };
}

// ===== 攝影機 =====
async function startCamera() {
    try {
        if (mediaStream) {
            stopCamera();
        }

        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: buildVideoConstraints(),
            audio: false
        });

        videoPreview.srcObject = mediaStream;

        startCameraBtn.disabled = true;
        stopCameraBtn.disabled = false;
        startRecordingBtn.disabled = false;
        cameraSelect.disabled = true;

        updateStatusOverlay('待機');
        updateTimerOverlay(formatTime(getSelectedRecordingDuration()));
        updatePreCountdownOverlay('');
        applyTimerSize();

        showStatus(cameraStatus, '✓ 攝影機已啟動', 'success');

        // 取得權限後再刷新一次，這時瀏覽器通常會顯示較完整的裝置名稱。
        await refreshCameraList();
        cameraSelect.disabled = true;
    } catch (error) {
        console.error('無法啟動攝影機:', error);
        showStatus(cameraStatus, `✗ 錯誤: ${error.message}`, 'error');
    }
}

function stopCamera() {
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }

    videoPreview.srcObject = null;
    mediaStream = null;

    if (isRecording || isPreparing) {
        stopRecording();
    }

    startCameraBtn.disabled = false;
    stopCameraBtn.disabled = true;
    startRecordingBtn.disabled = true;
    stopRecordingBtn.disabled = true;
    cameraSelect.disabled = false;

    updateStatusOverlay('攝影機未啟動');
    updateTimerOverlay('00:00');
    updatePreCountdownOverlay('');

    showStatus(cameraStatus, '✓ 攝影機已停止', 'info');
}

// ===== 錄製 =====
function startRecording() {
    if (isPreparing || isRecording) {
        return;
    }

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

        setTimeout(() => {
            beginRecording();
        }, 350);
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

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8';
    }

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
    }

    try {
        mediaRecorder = new MediaRecorder(mediaStream, options);
    } catch (error) {
        console.warn('指定 MIME type 建立 MediaRecorder 失敗，改用預設設定:', error);
        mediaRecorder = new MediaRecorder(mediaStream);
    }

    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
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
        if (isRecording) {
            stopRecording();
        }
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
    if (!isRecording && !isPreparing) {
        return;
    }

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

    if (wasRecording) {
        showStatus(recordingStatus, '✓ 錄製已停止', 'success');
    } else {
        showStatus(recordingStatus, '準備就緒', 'info');
    }
}

// ===== 更新倒數計時器 =====
function updateTimer() {
    if (!recordingStartTime || !isRecording) {
        return;
    }

    const elapsed = Date.now() - recordingStartTime;
    const remaining = Math.max(0, currentRecordingDuration - elapsed);

    timerDisplay.textContent = formatTime(remaining);
    updateTimerOverlay(formatTime(remaining));
}

// ===== 攝影機畫面疊加資訊 =====
function updateStatusOverlay(text) {
    if (!videoStatusOverlay) return;

    videoStatusOverlay.textContent = text;

    videoStatusOverlay.classList.remove(
        'status-idle',
        'status-preparing',
        'status-recording',
        'status-complete',
        'status-camera-off'
    );

    if (text === '待機') {
        videoStatusOverlay.classList.add('status-idle');
    } else if (text === '預備中') {
        videoStatusOverlay.classList.add('status-preparing');
    } else if (text.includes('錄製中')) {
        videoStatusOverlay.classList.add('status-recording');
    } else if (text.includes('錄製完成')) {
        videoStatusOverlay.classList.add('status-complete');
    } else if (text === '攝影機未啟動') {
        videoStatusOverlay.classList.add('status-camera-off');
    }
}

function updateTimerOverlay(text) {
    if (videoTimerOverlay) {
        videoTimerOverlay.textContent = text;
    }
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

// ===== 下載影片 =====
function downloadVideo() {
    if (!window.recordedBlob) {
        showStatus(downloadStatus, '✗ 沒有可下載的影片', 'error');
        return;
    }

    const filename = generateFilename(
        subjectCodeInput.value.trim(),
        testPhaseSelect.value,
        lastRecordingLabel
    );

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

// ===== 事件監聽 =====
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
        if (!isRecording && !isPreparing) {
            applyTimerSize();
        }
    });
});

if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', refreshCameraList);
}

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    timerDisplay.textContent = formatTime(getSelectedRecordingDuration());
    prepCountdownDisplay.textContent = '準備就緒';

    updateStatusOverlay('待機');
    updateTimerOverlay(formatTime(getSelectedRecordingDuration()));
    updatePreCountdownOverlay('');
    applyTimerSize();

    showStatus(cameraStatus, '請啟動攝影機。若要使用外接 USB 攝影機，請先插上後按「重新整理攝影機清單」。', 'info');
    showStatus(recordingStatus, '準備就緒', 'info');
    showStatus(downloadStatus, '', 'info');

    refreshCameraList();
});

console.log('CPR 研究用網頁系統 V1.0.8 已載入');
