# CPR Research System V2.3.4.1

## 版本目的

V2.3.4.1 以已通過實際測試的 V2.3.4 為基礎，完整保留：

- 本機影片回播。
- landmarks.csv 結構驗證。
- `video.currentTime ↔ elapsed_sec ↔ frame_index` 原始同步。
- Raw CSV landmark Canvas overlay。
- V2.2.7 顯示係數 `DISPLAY_SMOOTH_ALPHA = 0.34` 的 Live EMA 模擬。
- 原始方向 / 左右鏡像比較。

本版只新增 **Playback & Landmark Latency Diagnostic**，用來量化「Raw landmark 看起來跟在人體動作後面」的現象。

## 新增診斷功能

### 1. 明顯的快速播放速度

影片旁新增：

- 0.25×
- 0.5×
- 1×

原本左側播放速度下拉選單仍保留，兩者會同步。

### 2. 前一格 / 下一格

若已載入通過驗證的 landmarks.csv，按鈕會把影片跳到相鄰的 `elapsed_sec` 資料列；若只有影片，才以約 1/30 秒移動。

這是診斷用時間步進，不宣稱等同影片編碼器內部的精確 video frame。

### 3. Landmark Frame 顯示補償

可選：

- -1 Frame
- 0 Frame
- +1 Frame
- +2 Frame
- +3 Frame

定義：

- `0 Frame`：維持 V2.3.2 原始同步，影片 currentTime 對應最近的 elapsed_sec。
- `+1 Frame`：影片時間不動，但改畫 CSV 的下一筆 landmark。
- `+2 / +3 Frame`：依序使用再往後 2 / 3 筆 landmark。
- `-1 Frame`：使用前一筆 landmark，作為反向對照。

補償只影響 **Canvas 顯示哪一筆 landmark**，不會：

- 修改 landmarks.csv。
- 修改 raw.webm。
- 改動 V2.3.2 同步驗證結果。
- 將補償值寫回任何研究資料。

### 4. A / B 快速比較

先選定補償量，例如 `+1 Frame`，再反覆切換：

- 原始同步 A：固定顯示 0 Frame。
- 補償同步 B：顯示目前選定的補償量。

用來降低「一直重選下拉選單」造成的主觀比較困難。

### 5. 診斷資訊

系統會顯示：

- 原始對應 Frame。
- 選定補償。
- 目前真正畫出的 Frame。
- 目前真正畫出的 elapsed_sec。
- 依 CSV 中位 frame interval 換算的約略補償毫秒。
- 原始 Frame 與顯示 Frame 之間實際 elapsed_sec 位移。

因此研究者可以知道程式實際做了什麼，而不是只靠畫面感覺猜測。

## 建議測試方式

使用同一組 `*_raw.webm` + `*_landmarks.csv`：

1. 骨架顯示模式先選 `Raw CSV`。
2. 播放速度設 0.25×。
3. 先使用 `0 Frame`，確認先前觀察到的 Raw landmark 延遲。
4. 依序試 `+1 / +2 / +3 Frame`，觀察哪一個最貼近人體快速上下動作。
5. 找到候選值後，用「原始同步 A / 補償同步 B」反覆切換。
6. 換數支影片重複測試，不以單一影片直接決定固定補償值。
7. `-1 Frame` 可作反向控制；若 -1 更差、+1 更好，可支持延遲方向的判讀。

## 研究解讀限制

本功能目前屬 **Latency Diagnostic**，不是正式校正。即使某支影片在 +1 Frame 最貼合，也不能直接把所有研究影片固定補償 +1 Frame。必須先確認不同影片、不同裝置與不同錄影條件下是否存在一致的系統性延遲。

目前已知 V2.2.7 的 landmarks.csv 是在 MediaPipe 偵測結果產生後記錄 `elapsed_sec`，而單次 `detection_ms` 約可達數十毫秒，因此 Raw landmark 視覺落後可能包含 inference / timestamp latency。後續回頭修改模式一時，應保存更明確的 frame / detection timing；另需在 metadata 新增 `mirrorDisplay`。

## 鎖定範圍

以下 V2.2.7 模式一檔案仍保持不變：

- `live.html`
- `live.js`
- `analyze.html`

V2.3.4.1 的變更集中於：

- `index.html`：版本與本版功能文字。
- `replay.html`：延遲診斷控制與資訊區。
- `replay.js`：顯示層 frame offset、A/B、慢速與相鄰資料列步進。
- `style.css`：診斷控制的 responsive 樣式。
- `README.md`：版本說明。

本版仍為 Local-only，不新增 `fetch` / XHR / WebSocket / 外部上傳 API，也不重新執行 MediaPipe。
