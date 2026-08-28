# CPR Research System V2.3.0

## 模式二第一階段：本機影片載入與回播

V2.3.0 以 V2.2.7 為鎖定基準（baseline），**不修改模式一的 `live.html` 與 `live.js`**。
本版只建立模式二的第一個可測試能力：從使用者電腦選擇 webm / mp4，直接在目前瀏覽器分頁回播。

## V2.3.0 設計原則

- 影片只由本機硬碟讀入瀏覽器，不上傳至伺服器、雲端或外部 API。
- 本版不執行 MediaPipe。
- 本版不讀取 landmarks.csv。
- 本版不計算姿勢指標。
- 模式一的攝影機、錄影、骨架、CSV、metrics、metadata 流程全部維持 V2.2.7 原樣。

## 本版新增

- 模式二入口正式啟用。
- 可選擇本機 `.webm` 或 `.mp4`。
- 使用瀏覽器原生影片控制列播放、暫停與拖曳時間。
- 可切換 0.25×、0.5×、0.75×、1×、1.25×、1.5×、2× 播放速度。
- 顯示檔案名稱、大小、格式、原始解析度、影片長度與目前時間。
- 新增清除影片功能。
- 透過 `URL.createObjectURL()` 建立瀏覽器本機暫時 URL；切換檔案或離開頁面時會釋放 object URL。

## V2.2.7 鎖定檔案

以下檔案在 V2.3.0 完全不修改：

```text
live.html
live.js
analyze.html
```

V2.2.7 baseline SHA-256：

```text
live.html   4a9ee0971a7791937c006ff142a655fb475f2bd128eb752e07abd4b822093241
live.js     cc79acffb2b1df2bab454f554c338070d67740ef97651ac357f75da7d120428a
analyze.html 0cfb8087988aa8c2219968be4799c5aaa80fddf5573677aa1824a26ab90aee70
```

## V2.3.0 檔案

請將以下 8 個檔案放在同一個資料夾或 GitHub Pages repo 根目錄：

```text
index.html
live.html
replay.html
analyze.html
style.css
live.js
replay.js
README.md
```

## 本機啟動

在檔案所在資料夾執行：

```bash
python -m http.server 8000
```

再用瀏覽器開啟：

```text
http://localhost:8000
```

## V2.3.0 測試清單

1. 首頁模式一仍可進入，原 V2.2.7 功能不受影響。
2. 首頁模式二顯示「開始使用」，可進入本機回播頁。
3. 未選影片時，播放器顯示「尚未載入影片」。
4. 選擇 V2.2.7 直接下載的 webm 原始影片後，可以正常顯示與播放。
5. 可用影片原生控制列播放、暫停與拖曳時間。
6. 播放速度可正常切換。
7. 檔名、大小、解析度、影片長度、目前時間與格式可以顯示。
8. 按「清除影片」後回到未載入狀態。
9. 重新選擇另一支影片時不需重新整理網頁。
10. 不應出現任何影片上傳、登入或遠端分析動作。

## 下一階段（尚未製作）

V2.3.1 才會加入 `landmarks.csv` 的本機讀取與資料結構檢查；不會在 V2.3.0 提前加入骨架或 MediaPipe。
