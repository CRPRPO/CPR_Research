# CPR_Research

## CPR 研究用網頁系統 V2.0.1

V2.0.1 在 V2.0.0 的 MediaPipe Pose 基礎上，改成直接錄製 Canvas，因此下載影片會包含：

- 攝影機原始畫面
- MediaPipe 骨架線
- 肩、肘、腕、髖關節標籤

---

## 本版重點

### 1. 骨架直接錄進影片

V2.0.0 只在網頁上顯示骨架，下載影片仍是原始攝影機影像。  
V2.0.1 改成：

```text
攝影機影像 → Canvas
MediaPipe 骨架 → Canvas
Canvas → MediaRecorder → WebM
```

因此下載的 WebM 會包含骨架線。

---

## 建議畫質模式

本版只保留三種主要模式：

- 自動模式
- 640 × 480 / 30fps
- 1280 × 720 / 30fps

建議先測：

1. 640 × 480 / 30fps
2. 1280 × 720 / 30fps
3. 自動模式

---

## 重要限制

本版尚未分開儲存：

- 原始影片
- 骨架疊圖影片
- 骨架座標 CSV

目前只輸出骨架疊圖影片。  
後續若骨架穩定，建議 V2.1.0 再做雙軌儲存。

---

## 測試重點

請觀察：

- 手腕點是否跳動
- 手肘點是否漂移
- 肩膀點是否穩定
- 髖部是否常常消失
- 骨架是否誤抓 CPR 模擬人或背景
- 骨架疊圖影片是否可正常下載與播放

---

## Git 版本建議

```bash
git add index.html style.css app.js README.md
git commit -m "V2.0.1 record MediaPipe skeleton overlay to video"
git push
```
