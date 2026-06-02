// ==========================================
// CPR 研究用網頁系統 V1.0.3
// 使用純 HTML、CSS、JavaScript
// ==========================================

// ===== 全局變數 =====
let mediaStream = null;           // 攝影機媒體流
let mediaRecorder = null;          // 媒體錄製器
let recordedChunks = [];           // 存放錄製的視頻分片
let recordingStartTime = null;     // 錄製開始時間
let timerInterval = null;          // 計時器區間 ID
let prepInterval = null;           // 預備倒數區間 ID
let recordingTimeout = null;       // 正式錄製自動停止定時
let isRecording = false;           // 是否正在錄製中
let isPreparing = false;           // 是否正在預備倒數中
let currentRecordingDuration = 120000; // 當前選擇的錄影時長
let lastRecordingLabel = '120s';   // 上一次錄製的時長標籤

// 錄影長度設定
const RECORDING_LENGTHS = {
    '30': 30000,
    '60': 60000,
    '120': 120000
};

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
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ===== 工具函數：生成檔案名稱 =====
function generateFilename(subjectCode, testPhase, lengthLabel) {
    // 取得當前日期和時間
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    // 格式：受試者代碼_測驗階段_錄影長度_日期時間.webm
    // 例如：S01_practice1_30s_20260602_1430.webm
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

// ===== 啟動攝影機 =====
async function startCamera() {
    try {
        // 使用 getUserMedia API 請求攝影機權限
        mediaStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
                facingMode: { ideal: 'environment' }
            },
            audio: false
        });
        
        // 將攝影機流傳送到 video 元素
        videoPreview.srcObject = mediaStream;
        
        // 更新 UI 狀態
        startCameraBtn.disabled = true;
        stopCameraBtn.disabled = false;
        startRecordingBtn.disabled = false;
        updateStatusOverlay('待機');
        updateTimerOverlay(formatTime(getSelectedRecordingDuration()));
        showStatus(cameraStatus, '✓ 攝影機已啟動', 'success');
        
    } catch (error) {
        // 處理錯誤（例如使用者拒絕授權）
        console.error('無法啟動攝影機:', error);
        showStatus(cameraStatus, `✗ 錯誤: ${error.message}`, 'error');
    }
}

// ===== 停止攝影機 =====
function stopCamera() {
    // 停止所有媒體軌道
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
    }
    
    // 清空視頻預覽
    videoPreview.srcObject = null;
    mediaStream = null;
    
    // 停止正在進行的錄製
    if (isRecording) {
        stopRecording();
    }
    
    // 更新 UI 狀態
    startCameraBtn.disabled = false;
    stopCameraBtn.disabled = true;
    startRecordingBtn.disabled = true;
    stopRecordingBtn.disabled = true;
    updateStatusOverlay('攝影機未啟動');
    updateTimerOverlay('00:00');
    showStatus(cameraStatus, '✓ 攝影機已停止', 'info');
}

// ===== 開始錄製 =====
function startRecording() {
    // 避免重複按下開始按鈕
    if (isPreparing || isRecording) {
        return;
    }

    // 檢查是否已輸入受試者代碼和選擇測驗階段
    if (!subjectCodeInput.value.trim()) {
        showStatus(recordingStatus, '✗ 請輸入受試者代碼', 'error');
        return;
    }
    
    if (!testPhaseSelect.value) {
        showStatus(recordingStatus, '✗ 請選擇測驗階段', 'error');
        return;
    }
    
    // 檢查媒體流是否可用
    if (!mediaStream) {
        showStatus(recordingStatus, '✗ 攝影機尚未啟動', 'error');
        return;
    }

    // 選擇錄影長度
    currentRecordingDuration = getSelectedRecordingDuration();
    lastRecordingLabel = getSelectedRecordingLabel();

    // 鎖定輸入項目，避免錄製期間變動
    subjectCodeInput.disabled = true;
    testPhaseSelect.disabled = true;
    recordingLengthInputs.forEach(input => input.disabled = true);
    stopCameraBtn.disabled = true;
    startRecordingBtn.disabled = true;
    stopRecordingBtn.disabled = true;

    // 開始 5 秒預備倒數
    let prepSeconds = 5;
    updateStatusOverlay('預備中');
    updateTimerOverlay(formatTime(currentRecordingDuration));
    updatePreCountdownOverlay(String(prepSeconds));
    isPreparing = true;
    prepCountdownDisplay.textContent = String(prepSeconds);
    showStatus(recordingStatus, '● 預備倒數中...', 'info');

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

        beginRecording();
    }, 1000);
}

function beginRecording() {
    if (!mediaStream) {
        showStatus(recordingStatus, '✗ 攝影機不可用，無法開始錄製', 'error');
        resetPreparation();
        return;
    }

    // 重置錄製資料
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
        showStatus(recordingStatus, '✓ 錄製已完成', 'success');
        showStatus(downloadStatus, '✓ 可以下載影片', 'success');
    };

    // 顯示開始後才正式啟動錄製
    mediaRecorder.start();
    recordingStartTime = Date.now();
    isRecording = true;
    isPreparing = false;

    stopRecordingBtn.disabled = false;
    timerDisplay.classList.add('recording');
    updateStatusOverlay('● 錄製中');
    updateTimerOverlay(formatTime(currentRecordingDuration));
    updatePreCountdownOverlay('');
    showStatus(recordingStatus, '● 錄製中...', 'info');

    updateTimer();
    timerInterval = setInterval(updateTimer, 100);
    recordingTimeout = setTimeout(() => {
        if (isRecording) {
            stopRecording();
        }
    }, currentRecordingDuration);

    setTimeout(() => {
        if (prepCountdownDisplay) {
            prepCountdownDisplay.textContent = '';
        }
    }, 1000);
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

// ===== 停止錄製 =====
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

    if (isRecording && mediaRecorder) {
        mediaRecorder.stop();
    }

    isRecording = false;
    isPreparing = false;
    recordingStartTime = null;

    timerDisplay.textContent = '00:00';
    timerDisplay.classList.remove('recording');
    prepCountdownDisplay.textContent = '';
    updatePreCountdownOverlay('');
    updateStatusOverlay('錄製完成');
    updateTimerOverlay('00:00');

    startRecordingBtn.disabled = !mediaStream;
    stopRecordingBtn.disabled = true;
    subjectCodeInput.disabled = false;
    testPhaseSelect.disabled = false;
    recordingLengthInputs.forEach(input => input.disabled = false);
    stopCameraBtn.disabled = false;

    showStatus(recordingStatus, '✓ 錄製已停止', 'success');
}

// ===== 更新倒數計時器 =====
function updateTimer() {
    if (!recordingStartTime || !isRecording) {
        return;
    }
    
    // 計算已經過的時間
    const elapsed = Date.now() - recordingStartTime;
    
    // 計算剩餘時間
    const remaining = Math.max(0, currentRecordingDuration - elapsed);
    
    // 更新計時器顯示
    timerDisplay.textContent = formatTime(remaining);
    updateTimerOverlay(formatTime(remaining));
}

function updateStatusOverlay(text) {
    if (videoStatusOverlay) {
        videoStatusOverlay.textContent = text;
    }
}

function updateTimerOverlay(text) {
    if (videoTimerOverlay) {
        videoTimerOverlay.textContent = text;
    }
}

function updatePreCountdownOverlay(text) {
    if (preCountdownOverlay) {
        preCountdownOverlay.textContent = text;
    }
}

// ===== 下載影片 =====
function downloadVideo() {
    // 檢查是否有錄製完成的影片
    if (!window.recordedBlob) {
        showStatus(downloadStatus, '✗ 沒有可下載的影片', 'error');
        return;
    }
    
    // 生成檔案名稱
    const filename = generateFilename(
        subjectCodeInput.value.trim(),
        testPhaseSelect.value,
        lastRecordingLabel
    );
    
    // 創建下載連結
    const url = URL.createObjectURL(window.recordedBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // 觸發下載
    document.body.appendChild(link);
    link.click();
    
    // 清理資源
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

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', () => {
    // 初始化計時器顯示
    timerDisplay.textContent = '00:00';
    prepCountdownDisplay.textContent = '準備就緒';
    updateStatusOverlay('待機');
    updateTimerOverlay(formatTime(getSelectedRecordingDuration()));
    updatePreCountdownOverlay('準備就緒');
    
    // 初始化狀態訊息
    showStatus(cameraStatus, '請啟動攝影機', 'info');
    showStatus(recordingStatus, '準備就緒', 'info');
});

console.log('CPR 研究用網頁系統 V1.0.3 已載入');
