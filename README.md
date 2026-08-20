# CPR Research System V2.2.6

V2.2.6 是緊急修正版，目標是恢復攝影機啟動穩定性。

## 主要修正

- 攝影機來源預設為「自動選擇攝影機」，可直接開啟。
- 不再等待 `enumerateDevices()` 完成才允許操作，避免攝影機清單卡住。
- 啟動流程改成：先開攝影機，再載入 MediaPipe Full。
- 自動模式不再硬指定手機前/後鏡頭，改回瀏覽器最穩定的攝影機選擇。
- 保留 V2.2.4 的功能：
  - 鏡像顯示選項。
  - 骨架顯示平滑。
  - 左右手分析透明化。
  - 手機直式版面：影片、即時判斷值、錄影按鈕。
  - 影像位移只記錄，不顯示在現場判斷欄。

## 檔案

請將下列檔案放在 GitHub Pages repo 根目錄：

```text
index.html
live.html
replay.html
analyze.html
style.css
live.js
README.md
```

部署後請使用 Ctrl + F5 強制重新整理，確認 live.html 載入：

```text
live.js?v=20260821-v226
```

## 建議測試

1. 開啟 `live.html`。
2. 不用先重新整理攝影機清單，直接按「開啟攝影機與模型」。
3. 第一次使用請允許攝影機權限。
4. 確認畫面出現後，再看系統訊息是否顯示 MediaPipe Full 已就緒。
5. 若要指定外接鏡頭，再按「重新整理攝影機清單」後選擇。
