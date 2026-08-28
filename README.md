# CPR Research System V2.3.1

## 模式二第二階段：landmarks.csv 本機讀取與結構驗證

V2.3.1 以已測試通過的 V2.3.0 為基礎，保留原本本機影片回播流程，新增 V2.2.7 `landmarks.csv` 的本機讀取、CSV 解析與資料結構驗證。

本版的目的不是畫骨架，而是先證明：**瀏覽器確實讀到了 CSV，而且讀到的欄位與資料筆數符合後續骨架重建需要。**

## V2.3.1 驗證方式

載入 landmarks.csv 後，畫面會顯示總體狀態：

- `讀取成功｜PASS`：六項結構檢查全部通過。
- `已讀取｜需檢查`：CSV 可以讀取，但必要欄位、時間資料或資料列結構有問題。
- `讀取失敗`：CSV 無法解析。

同時顯示：

- CSV 檔名
- 資料筆數
- 欄位數
- frame_index 範圍
- elapsed_sec 範圍
- elapsed_sec 資料時間跨度

六項檢查：

1. CSV 解析成功。
2. 存在 `frame_index`、`elapsed_sec`、`video_time_sec`。
3. 左右肩、肘、腕的 x/y/z/visibility 共 24 個核心欄位完整。
4. 每筆 `elapsed_sec` 都是有效數字，且時間不倒退。
5. `frame_index` 為連續整數。
6. 每筆資料列欄位數與標題列一致。

展開「查看讀取到的研究資料摘要」還可確認：

- app_version
- model_label
- actual resolution
- requested_fps
- actual_frame_rate
- pose_count > 0 的資料筆數
- video_time_sec 起點 / 終點

## 以已提供的 V2.2.7 真實 CSV 作為預期測試值

檔案：`NOID_pretest_20260821_114407_landmarks.csv`

預期應讀到：

```text
資料筆數：899
欄位數：108
Frame 範圍：0 → 898
elapsed_sec：0.0425 → 30.0501 s
資料時間跨度：約 30.0076 s
六項驗證：全部 PASS
```

若 GitHub Pages 上載入同一份 CSV 後顯示上述值，即可確認 V2.3.1 的 CSV 讀取與解析流程正常。

## V2.3.1 設計原則

- 影片與 CSV 都只由本機硬碟讀入瀏覽器，不上傳伺服器、雲端或外部 API。
- 不執行 MediaPipe。
- 不畫骨架。
- 不把 CSV 與影片做時間同步。
- 不計算新的姿勢指標。
- 下一階段才以 `elapsed_sec` 對應回播影片 `video.currentTime`。

## V2.2.7 模式一鎖定檔案

以下檔案在 V2.3.1 仍不修改：

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

## V2.3.1 GitHub Pages 更新

若採用 replace 方式，請將 ZIP 內 8 個檔案放回 repo 根目錄。

本版實際修改：

```text
index.html
replay.html
replay.js
style.css
README.md
```

保持不變：

```text
live.html
live.js
analyze.html
```

## V2.3.1 測試清單

1. GitHub Pages 首頁顯示 V2.3.1。
2. 模式一仍可正常進入。
3. 模式二原本 V2.3.0 的 webm 播放功能仍正常。
4. 可直接選擇 `*_landmarks.csv`，不必先選影片。
5. 載入真實 V2.2.7 CSV 後，總體狀態應顯示 `讀取成功｜PASS`。
6. 六項驗證均顯示綠色勾選。
7. 使用範例 CSV 時應顯示 899 筆、108 欄、frame 0→898。
8. elapsed_sec 應顯示 0.0425→30.0501 s，跨度約 30.0076 s。
9. 清除 CSV 後應回到「尚未載入」狀態。
10. 本版不應在影片上顯示任何骨架，也不應重新執行 MediaPipe。

## 下一階段（尚未製作）

V2.3.2 才會建立 `raw.webm + landmarks.csv` 的時間對應，使用 `elapsed_sec` 作為 CSV 主時間軸，先驗證影片時間與 CSV frame 選取是否一致；骨架繪製仍可再分到後續版本。
