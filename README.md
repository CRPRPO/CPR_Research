# CPR Research System V2.3.4

## 版本目的

V2.3.4 以已通過實際測試的 V2.3.3 為基礎，保留：

- 本機影片回播。
- landmarks.csv 結構驗證。
- `video.currentTime ↔ elapsed_sec ↔ frame_index` 同步。
- Raw CSV landmark Canvas overlay。

本版只新增兩件顯示層能力：

1. **Live EMA 模擬**：使用 V2.2.7 即時顯示骨架相同係數 `DISPLAY_SMOOTH_ALPHA = 0.34`。
2. **手動鏡像比較**：可將 raw.webm 與骨架一起左右鏡像，以便和當時螢幕錄影比對。

本版仍不重新執行 MediaPipe、不讀 posture_metrics.csv、不判定姿勢正確/錯誤，也不修改模式一。

## EMA 重建公式

V2.2.7 即時顯示的 x/y 使用：

`EMA_t = 0.34 × Raw_t + 0.66 × EMA_(t-1)`

V2.3.4 會在 landmarks.csv 載入後，依 CSV frame 順序預先計算每一筆的 EMA x/y。這樣播放、暫停、拖曳到任意時間時，都可以直接取得該 frame 對應的 EMA，而不會因瀏覽器重複 render 同一 frame 而重複平滑。

### 重要限制

V2.2.7 的即時 EMA 在攝影機 preview 啟動後就開始累積；但 landmarks.csv 只保存正式錄影期間。因此 V2.3.4 無法知道正式錄影開始前的 EMA 狀態。

本版採用「第一筆錄影 CSV Raw 值作為 EMA 初始值」。因此：

- 錄影最前段約數百毫秒可能和當時螢幕顯示有些微差異。
- 經過數個至十數個 frame 後，錄影前初始狀態的影響會快速衰減。

這是資料本身未保存 pre-record smoothing state 的限制，不是重新辨識誤差。

## 鏡像比較

V2.2.7 metadata 沒有保存當時 `mirrorDisplay` 設定，所以 V2.3.4 不會猜測。研究者可手動選擇：

- 原始方向。
- 左右鏡像（模擬現場顯示）。

鏡像時 raw.webm 與骨架會一起翻轉；Canvas 標籤文字仍維持正常方向。

## 鎖定範圍

以下 V2.2.7 模式一檔案仍保持不變：

- `live.html`
- `live.js`
- `analyze.html`

V2.3.4 的變更集中於：

- `index.html`：版本文字。
- `replay.html`：EMA / mirror 顯示選項與說明。
- `replay.js`：預計算 EMA 及鏡像顯示。
- `style.css`：影片鏡像顯示樣式。
- `README.md`：本版本說明。

## V2.3.4 測試清單

使用同一組 `*_raw.webm` + `*_landmarks.csv`：

1. V2.3.3 已通過的影片播放、CSV PASS、時間同步、Raw overlay 必須維持正常。
2. 切換「Raw CSV」與「Live EMA 模擬」時，骨架都應跟同一 frame，EMA 版本應較平滑且在快速移動時可能有輕微滯後。
3. 暫停並拖曳到任意時間後，Raw / EMA 都應立即對到該 frame，不因 seek 而重新累積造成位置漂移。
4. 切換「左右鏡像」後，影片與骨架必須一起左右翻轉且仍貼合人體；文字標籤不可反字。
5. 切回「原始方向」後應回到原位置。
6. 不同組別影片 / CSV 的防呆仍應阻止繪製。

V2.3.4 通過後，再進下一階段加入姿勢 metrics / debug 對照，而不是在本版改判斷門檻。
