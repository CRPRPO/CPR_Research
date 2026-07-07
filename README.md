# CPR_Research

## CPR 研究用網頁系統 V2.0.3

V2.0.3 改用 MediaPipe Tasks Vision `PoseLandmarker`，不再使用舊版 `@mediapipe/pose` 的 `Pose` 物件。

---

## 為什麼做 V2.0.3

V2.0.2 在 Console 出現：

```text
GL_INVALID_FRAMEBUFFER_OPERATION: Framebuffer is incomplete: Attachment has zero size.
RuntimeError: memory access out of bounds
```

這代表舊版 MediaPipe Pose 的 wasm/GPU 流程不穩，且可能在影片或 Canvas 尺寸尚未有效時被呼叫。

V2.0.3 改用 Tasks Vision，並加入：

- videoWidth/videoHeight 檢查
- Canvas 尺寸檢查
- `detectForVideo()` 同步偵測流程
- 只在影片有效幀時偵測
- 錄製 Canvas 骨架疊圖影片

---

## 畫質模式

- 自動模式
- 640 × 480 / 30fps
- 960 × 540 / 30fps
- 1280 × 720 / 30fps

建議先測 960 × 540 / 30fps。

---

## Git 版本建議

```bash
git add index.html style.css app.js README.md
git commit -m "V2.0.3 switch to MediaPipe Tasks Vision PoseLandmarker"
git push
```

部署後請用 Ctrl + F5 強制重新整理。
