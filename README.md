# CPR Research System V2.3.4.2

## 版本目的

V2.3.4.2 以已通過實際測試的 V2.3.4.1 為基礎。使用者在多支真實 CPR 錄影中觀察到 Raw landmark 即使不使用 EMA 仍落後人體動作，且兩支初步測試影片的最佳視覺補償已達 `+3 Frame` 或略高於 `+3 Frame`。因此本版只擴充 **Extended Latency Diagnostic**，不修改既有回播、同步或骨架計算核心。

完整保留：

- 本機影片回播。
- landmarks.csv 結構驗證。
- `video.currentTime ↔ elapsed_sec ↔ frame_index` 原始同步。
- Raw CSV landmark Canvas overlay。
- V2.2.7 顯示係數 `DISPLAY_SMOOTH_ALPHA = 0.34` 的 Live EMA 模擬。
- 原始方向 / 左右鏡像比較。
- 0.25× / 0.5× / 1× 快速播放。
- 前一格 / 下一格相鄰 landmark 資料列步進。
- 原始同步 A / 補償同步 B 快速比較。

## V2.3.4.2 新增內容

### 1. 延伸 Landmark 補償範圍

診斷範圍由 V2.3.4.1 的 `-1～+3 Frame` 擴充為：

- 最小：`-2 Frame`
- 最大：`+8 Frame`

補償仍只改變 Canvas「顯示哪一筆 CSV landmark」，不改變影片時間、不修改 CSV，也不改寫 V2.3.2 的原始同步驗證。

### 2. ±1 Frame 緊湊微調

補償區新增：

- `−1`：目前補償減少一格。
- 中央顯示：目前選定 Frame 與依 CSV 中位 frame interval 換算的約略毫秒。
- `+1`：目前補償增加一格。

因此可逐格選到所有 `-2～+8` 整數 Frame，包括快速按鈕沒有直接列出的 `-2、-1、+5、+7`。到達邊界後相應的 `−1 / +1` 按鈕會停用，避免超出設計範圍。

### 3. 快速選擇級距

為避免一次橫排 11 顆大按鈕造成 UI 過長，本版只保留常用快速跳轉：

- `0`
- `+1`
- `+2`
- `+3`
- `+4`
- `+6`
- `+8`

研究者可先快速找到大致範圍，再用 `−1 / +1` 精細調整。

### 4. A / B 比較維持不變

例如選定 `+5 Frame` 後：

- 原始同步 A：顯示 `0 Frame`。
- 補償同步 B：顯示 `+5 Frame`。

可反覆切換，不必重選補償值。

## 建議測試方式

使用同一組 `*_raw.webm` + `*_landmarks.csv`：

1. 骨架先選 `Raw CSV`，避免 EMA 影響判讀。
2. 播放速度設為 `0.25×`。
3. 先看 `0 Frame`。
4. 快速試 `+1、+2、+3、+4`。
5. 若 `+4` 仍落後，可直接試 `+6` 或 `+8`，再用 `−1 / +1` 回頭微調。
6. 找到候選值後，用 A / B 反覆比較。
7. 每支影片記錄最佳 Frame 補償與畫面顯示的「實際時間位移 ms」。
8. 建議至少測 5～10 支影片後再判斷是否存在穩定的系統性延遲。

## 研究解讀限制

本功能仍為 **Latency Diagnostic**，不是正式校正。即使某批影片集中在 +3～+5 Frame，也不能直接把所有研究資料固定套用同一補償值。若不同影片差異大，後續應從模式一的 frame timestamp / detection timing 架構處理，而不是事後以單一 offset 強制修正。

目前已知後續模式一資料紀錄應補強：

- `mirrorDisplay`（或等價欄位），記錄當時螢幕是否使用左右鏡像顯示。
- 更清楚的 frame / detection timing，例如 frame capture / detection start / detection end / detection_ms 等時間資訊，以利區分影像取得、MediaPipe inference 與畫面呈現造成的延遲。

## 鎖定範圍

以下 V2.2.7 模式一檔案仍保持不變：

- `live.html`
- `live.js`
- `analyze.html`

V2.3.4.2 的變更集中於：

- `index.html`：版本與功能說明。
- `replay.html`：Extended Latency Diagnostic 控制區。
- `replay.js`：-2～+8 Frame 範圍、±1 微調與控制狀態。
- `style.css`：較緊湊的補償控制 responsive 樣式。
- `README.md`：版本說明。

本版仍為 Local-only，不新增 `fetch` / XHR / WebSocket / 外部上傳 API，也不重新執行 MediaPipe。
