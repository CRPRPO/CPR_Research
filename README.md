# CPR_Research

## CPR 研究用網頁系統 V1.0.7

本系統為 CPR 胸部按壓研究與教學測試用的網頁錄影工具，使用純 HTML、CSS、JavaScript 製作，不需要後端、不需要資料庫、不需要登入。

目前版本重點是建立穩定的錄影流程，方便後續加入人體姿勢偵測、骨架顯示、按壓頻率分析與姿勢回饋。

---

## V1.0.7 功能

### 研究設定

使用者可輸入：

- 受試者代碼，例如 S01
- 測驗階段：
  - pretest
  - practice1
  - practice2
  - practice3
  - practice4
  - retention

### 攝影機

系統使用瀏覽器 `getUserMedia` 開啟攝影機。

目前攝影機設定：

- 解析度：1280 × 720
- 幀率：30 fps
- 鏡頭方向：優先使用 environment，也就是手機後鏡頭或外接鏡頭
- 音訊：關閉，不錄音

```javascript
audio: false
