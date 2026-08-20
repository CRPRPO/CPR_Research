# CPR Research System V2.2.0

## 版本定位

V2.2.0 是 CPR 研究用系統的「即時測試 / 錄影模式」版本。

本版採用三模式入口架構：

```text
index.html
├── live.html：模式一，即時測試 / 錄影模式，本版已完成
├── replay.html：模式二，本機回播模式，預留入口
└── analyze.html：模式三，重新分析模式，預留入口
```

---

## 模式一功能

`live.html` 目前支援：

- 640×480 / 30fps 攝影機設定
- MediaPipe Pose Landmarker Full 模型
- 攝影機來源選擇，使用 `deviceId exact` 鎖定指定鏡頭
- 30 秒 / 60 秒 / 120 秒錄影長度
- 受試者代碼與測驗階段
- 主要分析手臂：自動 / 固定左側 / 固定右側
- 即時骨架顯示
- 即時姿勢狀態初判
- 原始影片錄製，不疊骨架
- landmarks.csv 輸出
- posture_metrics.csv 輸出
- metadata.json 輸出
- 一鍵下載 ZIP

---

## 預設研究設定

```text
解析度：640×480
FPS：30fps
MediaPipe 模型：Full
錄音：false
錄影：原始影片
骨架資料：CSV 另外保存
影像位移：記錄 px，不做深度判斷
```

---

## 檔案命名

每次按下「開始測試 / 錄影」時，系統會產生 session id：

```text
YYYYMMDD_HHMMSS
```

若受試者代碼是 `S001`，測驗階段是 `pretest`，檔案會使用：

```text
S001_pretest_YYYYMMDD_HHMMSS
```

ZIP 內容：

```text
S001_pretest_YYYYMMDD_HHMMSS/
├── S001_pretest_YYYYMMDD_HHMMSS_raw.webm
├── S001_pretest_YYYYMMDD_HHMMSS_landmarks.csv
├── S001_pretest_YYYYMMDD_HHMMSS_posture_metrics.csv
└── S001_pretest_YYYYMMDD_HHMMSS_metadata.json
```

若瀏覽器不支援 WebM，原始影片副檔名可能為 `.mp4`。

---

## 即時狀態初判

畫面上會顯示：

- 偵測品質：良好 / 請調整角度 / 偵測不穩
- 手肘：穩定 / 可能彎曲 / 偵測不穩
- 肩腕對齊：良好 / 偏移 / 偵測不穩
- 軀幹參與：有 / 不足 / 偵測不穩
- 按壓速率：估算 BPM

影像位移 px 會記錄在 `posture_metrics.csv`，但畫面不顯示深度判斷。

---

## 上傳到 GitHub Pages

請將以下檔案放在 repo 根目錄：

```text
index.html
live.html
replay.html
analyze.html
style.css
live.js
README.md
```

GitHub Pages 設定：

```text
Source：Deploy from a branch
Branch：main
Folder：/root
```

部署完成後，請用 Ctrl + F5 強制重新整理。

---

## 版本確認

`live.html` 應載入：

```text
live.js?v=20260821-v220
```

`style.css` 應載入：

```text
style.css?v=20260821-v220
```
