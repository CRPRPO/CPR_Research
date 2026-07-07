// ==========================================
// CPR 研究用網頁系統 V1.0.7
// 使用純 HTML、CSS、JavaScript
// ==========================================

// ===== 全局變數 =====
let mediaStream = null;               // 攝影機媒體流
let mediaRecorder = null;             // 媒體錄製器
let recordedChunks = [];              // 存放錄製的視頻分片
let recordingStartTime = null;        // 錄製開始時間
let timerInterval = null;             // 計時器區間 ID
let prepInterval = null;              // 預備倒數區間 ID
let recordingTimeout = null;          // 正式錄製自動停止定時
let isRecording = false;              // 是否正在錄製中
let isPreparing = false;              // 是否正在預備倒數中
let currentRecordingDuration = 120000; // 當前選擇的錄影時長
let lastRecordingLabel = '120s';      // 上一次錄製的時長標籤
let audioContext = null;              // 完成提示音使用，不會錄進影片

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
const cameraStatus = document.getElementById('cameraStatus');
const recordingStatus = document.getElementById('recordingStatus');
const downloadStatus = document.getElementById('downloadStatus');

// ===== 工具函數：顯示狀態訊息 =====
function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status-message ${type}`;
}

// ===== 工具函數：格式化時間 =====
function formatTime(milliseconds) {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ===== 工具函數：生成檔案名稱 =====
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

// ===== 攝影機 =====
async function startCamera() {
    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
                facingMode: { ideal: 'environment' }
            },
            audio: false
        });
        
        videoPreview.srcObject = mediaStream;
        
        startCameraBtn.disabled = true;
        stopCameraBtn.disabled = false;
        startRecordingBtn.disabled = false;

        updateStatusOverlay('待機');
        updateTimerOverlay(formatTime(getSelectedRecordingDuration()));
        updatePreCountdownOverlay('');

        showStatus(cameraStatus, '✓ 攝影機已啟動', 'success');
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

    // 使用者按鈕操作時先啟用 AudioContext，讓結束提示音能正常播放
    ensureAudioContext();

    currentRecordingDuration = getSelectedRecordingDuration();
    lastRecordingLabel = getSelectedRecordingLabel();

    subjectCodeInput.disabled = true;
    testPhaseSelect.disabled = true;
    recordingLengthInputs.forEach(input => input.disabled = true);
    stopCameraBtn.disabled = true;
    startRecordingBtn.disabled = true;
    stopRecordingBtn.disabled = true;
    downloadBtn.disabled = true;

    // 開始 10 秒預備倒數
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

    mediaRecorder = new MediaRecorder(mediaStream, options);
    
    mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
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
startCameraBtn.addEventListener('click', startCamera);
stopCameraBtn.addEventListener('click', stopCamera);
startRecordingBtn.addEventListener('click', startRecording);
stopRecordingBtn.addEventListener('click', stopRecording);
downloadBtn.addEventListener('click', downloadVideo);

recordingLengthInputs.forEach(input => {
    input.addEventListener('change', () => {
        if (!isRecording && !isPreparing) {
            updateTimerOverlay(formatTime(getSelectedRecordingDuration()));
            timerDisplay.textContent = formatTime(getSelectedRecordingDuration());
        }
    });
});

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    timerDisplay.textContent = formatTime(getSelectedRecordingDuration());
    prepCountdownDisplay.textContent = '準備就緒';

    updateStatusOverlay('待機');
    updateTimerOverlay(formatTime(getSelectedRecordingDuration()));

    // 待機時不要在攝影機畫面中央顯示「準備就緒」
    updatePreCountdownOverlay('');
    
    showStatus(cameraStatus, '請啟動攝影機', 'info');
    showStatus(recordingStatus, '準備就緒', 'info');
    showStatus(downloadStatus, '', 'info');
});

console.log('CPR 研究用網頁系統 V1.0.7 已載入');
