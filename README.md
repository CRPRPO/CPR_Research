# CPR_Research

## CPR 研究用網頁系統 V2.0.7

V2.0.7 修正 V2.0.6「錄影過程看得到骨架，但下載影片沒有骨架」的問題。

---

## 問題原因

V2.0.6 的畫面流程可能出現：

```text
Canvas 先畫原始攝影機畫面
MediaPipe 偵測
Canvas 再畫骨架
captureStream 剛好擷取到「只有原始畫面」的瞬間
```

所以網頁上肉眼看得到骨架，但錄影檔可能沒有骨架。

---

## V2.0.7 修正方式

本版改成：

```text
MediaPipe 只負責更新「最新骨架」
每一個畫面迴圈都重新畫：
1. 原始攝影機畫面
2. 最新可用骨架
3. Canvas 內錄影標記
4. 再送入 captureStream
```

並加入 `requestFrame()`，主動要求 Canvas capture track 擷取已畫好骨架的幀。

---

## 下載影片驗證

錄影時，Canvas 左下角會被直接畫入：

```text
SKELETON OVERLAY REC
```

如果下載影片有這個標記，代表影片確實是從 Canvas 輸出。  
如果同時有骨架，代表骨架疊圖錄影成功。

---

## 保留功能

- 平躺骨架排除
- 降低誤抓 CPR 安妮
- VP8 優先錄影
- 640×480 / 960×540 / 1280×720
- Canvas 骨架疊圖錄影

---

## Git 指令

```bash
git add index.html style.css app.js README.md
git commit -m "V2.0.7 ensure skeleton overlay is recorded from canvas"
git push
```

部署後請用 Ctrl + F5 強制重新整理，確認載入：

```text
app.js?v=20260707-v207
```
