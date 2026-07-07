# CPR_Research

## CPR 研究用網頁系統 V2.0.4

V2.0.4 修正 V2.0.3 的 MediaPipe Tasks Vision CDN 404 問題。

---

## 修正重點

V2.0.3 使用：

```javascript
https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22
```

該路徑可能回傳 404，造成 `app.js` module import 失敗，整個 JavaScript 不執行，因此頁面無法列出攝影機、無法啟動骨架。

V2.0.4 改為：

```javascript
https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs
https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm
```

並將 index.html 的 cache busting 改成：

```html
<script type="module" src="app.js?v=20260707-v204"></script>
```

---

## 功能保留

- 自動模式
- 640 × 480 / 30fps
- 960 × 540 / 30fps
- 1280 × 720 / 30fps
- MediaPipe Tasks Vision PoseLandmarker
- Canvas 骨架疊圖錄影
- 30 秒 / 1 分鐘 / 2 分鐘錄影
- WebM 下載

---

## Git 指令

```bash
git add index.html style.css app.js README.md
git commit -m "V2.0.4 fix MediaPipe Tasks Vision CDN path"
git push
```

部署後請用 Ctrl + F5 強制重新整理。確認 Console 裡不再出現 `app.js?v=20260707-v203`。
