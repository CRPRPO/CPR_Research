# CPR_Research

## CPR 研究用網頁系統 V2.0.2

V2.0.2 修正 V2.0.1 的診斷欄位不一致問題，並加入 960×540/30fps 中間尺寸。

---

## 修正內容

- 修正 `Cannot set properties of null (setting 'textContent')`
- 補回 `diagAspectRatio` 影像比例欄位
- 加入 cache busting：`app.js?v=20260707-v202`
- 新增畫質模式：960 × 540 / 30fps
- 保留 Canvas 骨架疊圖錄影

---

## 畫質模式

- 自動模式
- 640 × 480 / 30fps
- 960 × 540 / 30fps
- 1280 × 720 / 30fps

建議測試順序：

1. 640 × 480 / 30fps
2. 960 × 540 / 30fps
3. 1280 × 720 / 30fps
4. 自動模式

---

## Git 版本建議

```bash
git add index.html style.css app.js README.md
git commit -m "V2.0.2 fix diagnostics and add 960x540 mode"
git push
```

部署後請用 Ctrl + F5 強制重新整理，避免瀏覽器沿用舊版 app.js。
