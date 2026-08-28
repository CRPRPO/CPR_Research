# CPR Research System V2.3.2

## 模式二時間同步驗證版

V2.3.2 以已通過測試的 V2.3.1.1 為基礎，保留：

- 本機 WebM / MP4 回播。
- 桌機／平板／手機 responsive 播放器。
- landmarks.csv 讀取、解析與六項結構驗證。
- Local-only：影片與 CSV 不上傳。

本版只新增一件核心能力：

> 使用 `video.currentTime` 對應 `landmarks.csv` 的 `elapsed_sec`，找出時間最接近的 `frame_index`。

V2.3.2 **仍不畫骨架、不執行 MediaPipe、不重新分析影片，也不計算新的姿勢指標**。

---

## 為什麼使用 elapsed_sec

V2.2.7 的 `video_time_sec` 是攝影機 `<video>` preview 從更早開始播放後的 media clock；正式錄影開始時它可能已累積數百或上千秒。

下載後的 `raw.webm` 則從約 0 秒開始，因此回播主時間軸必須使用：

```text
raw.webm video.currentTime  <->  landmarks.csv elapsed_sec
```

而不是：

```text
raw.webm video.currentTime  <->  video_time_sec
```

---

## V2.3.2 同步演算法

1. CSV 必須先通過 V2.3.1 結構驗證。
2. 取得目前影片 `video.currentTime`。
3. 在已排序的 `elapsed_sec` 中以二分搜尋找到最接近的時間點。
4. 顯示該筆：
   - `frame_index`
   - `elapsed_sec`
   - `|Δt| = |elapsed_sec - video.currentTime|`
5. 計算 CSV 相鄰 `elapsed_sec` 的中位間隔。
6. 同步允許誤差採自適應門檻：

```text
max(0.050 s, 中位間隔 × 1.5)
```

並限制最大不超過 0.150 s。

最低 50 ms 的原因：V2.2.7 正式錄影開始後，第一筆 MediaPipe landmark 通常要等到下一個 frame 才出現；真實測試 CSV 的第一筆約為 0.0425 s。

---

## 畫面新增的同步驗證資訊

載入影片與 landmarks.csv 後會顯示：

- 影片 currentTime
- 對應 frame_index
- 對應 elapsed_sec
- 時間差 |Δt|
- CSV 資料中位間隔
- 同步允許誤差

另有四項檢查：

1. **必要資料**：影片已載入且 CSV 結構 PASS。
2. **時間範圍**：currentTime 位於 CSV elapsed_sec 可對應範圍內。
3. **最近 Frame 對應**：最近 frame 的 |Δt| 未超出允許誤差。
4. **檔案組別**：若檔名遵循 `_raw.webm` / `_landmarks.csv` 規則，會檢查兩者前綴是否為同一次測試。

檔案組別檢查是研究安全提醒；若檔案曾被重新命名而無法判定，時間同步仍可測試。

---

## 目前真實測試 CSV 的預期對應

以：

```text
NOID_pretest_20260821_114407_landmarks.csv
```

為例，應得到約：

```text
影片  5.000 s  -> frame 148 -> elapsed  5.0024 s -> |Δt| 0.0024 s
影片 10.000 s  -> frame 298 -> elapsed  9.9898 s -> |Δt| 0.0102 s
影片 15.000 s  -> frame 448 -> elapsed 15.0216 s -> |Δt| 0.0216 s
影片 20.000 s  -> frame 597 -> elapsed 19.9886 s -> |Δt| 0.0114 s
影片 25.000 s  -> frame 747 -> elapsed 25.0036 s -> |Δt| 0.0036 s
影片 30.000 s  -> frame 896 -> elapsed 29.9982 s -> |Δt| 0.0018 s
```

這些數字用來確認「網頁有正確執行時間配對演算法」，不是在 V2.3.2 就宣稱骨架與人體影像內容已經視覺同步；視覺內容同步要等 V2.3.3 畫出骨架後才能確認。

---

## V2.2.7 模式一鎖定檔案

以下檔案在 V2.3.2 仍完全不修改：

```text
live.html
live.js
analyze.html
```

V2.2.7 baseline SHA-256：

```text
live.html     4a9ee0971a7791937c006ff142a655fb475f2bd128eb752e07abd4b822093241
live.js       cc79acffb2b1df2bab454f554c338070d67740ef97651ac357f75da7d120428a
analyze.html  0cfb8087988aa8c2219968be4799c5aaa80fddf5573677aa1824a26ab90aee70
```

## 本版修改檔案

```text
index.html
replay.html
replay.js
style.css      # 只追加同步驗證區樣式
README.md
```

保持不變：

```text
live.html
live.js
analyze.html
```

---

## V2.3.2 測試清單

1. GitHub Pages 首頁顯示 V2.3.2。
2. 模式一仍可正常進入。
3. 模式二影片仍可播放、暫停、拖曳與變速。
4. landmarks.csv 原本六項驗證仍 PASS。
5. 載入同一次測試的 raw.webm + landmarks.csv。
6. 「檔案組別」應顯示同一組測試。
7. 拖曳影片至約 5、10、15、20、25 秒，frame_index 應跟著改變。
8. 使用上述真實 CSV 時，可與 README 的預期 frame / elapsed 數值比較。
9. 「時間範圍」與「最近 Frame 對應」在正常影片範圍內應 PASS。
10. 影片上仍不應出現骨架。

## 下一階段

V2.3.3：使用 V2.3.2 已驗證的 `frame_index / elapsed_sec`，將 CSV 中的 normalized landmark x/y 座標重新畫到影片上，進行真正的影像內容與骨架 overlay 驗證。
