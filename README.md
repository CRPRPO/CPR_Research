# CPR Research System V2.3.3

## 版本目的

V2.3.3 以已通過測試的 V2.3.2 為基礎，保留本機影片回播、landmarks.csv 結構驗證，以及 `video.currentTime ↔ elapsed_sec ↔ frame_index` 最近時間配對。

本版只新增一件核心能力：**把 V2.2.7 已保存於 landmarks.csv 的 Raw normalized landmark x/y 重新畫回 raw.webm 上。**

這不是重新辨識影片。V2.3.3：

- 不重新執行 MediaPipe。
- 不產生新的 landmark。
- 不使用 EMA 平滑。
- 不讀 posture_metrics.csv。
- 不判定姿勢正確或錯誤。
- 不修改模式一。
- 不上傳影片或 CSV。

## Raw 骨架資料來源

每次影片播放或拖曳時，沿用 V2.3.2 的同步邏輯：

1. 取得 `video.currentTime`。
2. 在 CSV 的 `elapsed_sec` 中找時間最接近的一筆。
3. 取得該筆 `frame_index`。
4. 讀取該列 `nose / neck_mid / shoulder / elbow / wrist / hip` 的 normalized `x/y`。
5. 依目前播放器實際顯示尺寸換算成 Canvas 座標：

   `display_x = landmark_x × canvas_display_width`

   `display_y = landmark_y × canvas_display_height`

6. 將 Raw 骨架畫在影片上方的透明 Canvas。

Canvas 會跟播放器共用相同顯示矩形，視窗縮放或手機/平板改變尺寸後會重新計算，以避免影片與骨架因 responsive layout 產生位移。

## 顏色

- 左側肩－肘－腕：青色。
- 右側肩－肘－腕：黃色。
- 髖部與肩髖連線：綠色。
- 肩線：白色。
- nose：粉紅色。
- neck_mid：白色。

畫面左上角會顯示 `RAW CSV · Fxxx · n/10`，方便確認目前使用哪個 CSV frame，以及 10 個保存點中有多少點具有效 x/y。

## 顯示開關

左側新增「顯示 CSV Raw Landmarks」。

- 開啟：顯示 Raw CSV 骨架。
- 關閉：只看原始 raw.webm。

這個開關是為了方便肉眼快速比較人體真正位置與 CSV 保存的 landmark 位置。

## 鎖定範圍

以下檔案仍不修改其 V2.2.7 模式一內容：

- `live.html`
- `live.js`
- `analyze.html`

V2.3.3 的變更集中於：

- `index.html`：版本文字。
- `replay.html`：Raw 骨架 Canvas、顯示開關與版本說明。
- `replay.js`：讀取已同步的 CSV row 並畫 Raw skeleton。
- `style.css`：Canvas overlay、狀態 badge 與開關樣式。
- `README.md`：本版本說明。

## V2.3.3 測試清單

使用同一組：

- `*_raw.webm`
- `*_landmarks.csv`

確認：

1. V2.3.2 的影片回播仍正常。
2. CSV 仍為 PASS。
3. 時間同步仍為 PASS。
4. 載入影片與 CSV 後，「顯示 CSV Raw Landmarks」可以使用。
5. 影片上出現骨架，播放時會跟著動作更新。
6. 拖曳影片後，骨架會跳到對應 frame。
7. 關閉 Raw 骨架後，只剩原始影片；重新開啟可恢復。
8. 主要肉眼檢查肩、肘、腕是否落在對應人體位置。
9. 將瀏覽器縮窄或使用手機/平板時，影片與骨架仍保持重疊，不應因 responsive layout 分離。

## 本版判定重點

V2.3.3 的 PASS 不代表「MediaPipe 姿勢辨識已正確」。

本版只回答：

> V2.2.7 當時保存於 landmarks.csv 的 Raw x/y，經過 V2.3.2 已驗證的時間對應後，能否在回播影片中重建到正確的影像位置？

如果骨架與人體位置不吻合，優先檢查 CSV 座標、Canvas 座標轉換、影片顯示幾何與時間配對；不要先修改姿勢門檻。

## 下一步（尚未包含）

預定 V2.3.4 再處理 Live 顯示重建議題，例如 V2.2.7 的 EMA display smoothing，以及必要時的鏡像顯示比較。
