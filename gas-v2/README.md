# 1122 親子自律活動｜GAS v2 部署與驗收說明

> 狀態：**已準備程式碼，尚未正式部署。** 為避免中斷原有活動報名，網站目前的 `BACKEND_V2_READY` 維持 `false`，仍使用舊 GAS。

## 目的

- 舊報名名單與進站資料保留。
- 報名改使用 **POST**，避免姓名、電話出現在 GET/JSONP URL。
- 寫入「流量紀錄」：page_view、registration_click、form_start、registration_success。
- 記錄 visitor_id、session_id、全部 UTM 與 fbclid。
- 透過 clientRecordId 保護重複送出；遇網路逾時可查詢是否已成功。
- 更新「流量分析」四段漏斗，只統計具 page_view 的不重複 session。

## 操作步驟（一次性）

1. 開啟 [Google Apps Script](https://script.google.com/home/start)，建立**全新**專案，名稱建議「1122 親子自律 GAS v2」；**不要覆蓋目前正在使用的舊專案**。
2. 在新專案的 `Code.gs` 全選後，貼上本資料夾的 [Code.gs](./Code.gs) 完整內容，儲存。
3. 在編輯器上方選擇 `verify1122Setup` 並執行；依畫面完成 Google 授權。執行記錄應顯示 `"ok":true`。這只檢查工作表，不會新增報名資料。
4. 點右上角「部署 → 新增部署 → 網頁應用程式」，選擇 **執行身分：我**、**誰可以存取：任何人**，完成部署後，取得 `https://script.google.com/macros/s/.../exec` 網址。
5. 用瀏覽器打開新網址加上 `?action=ping`，應得到 `{"ok":true,"version":"1122-gas-v2","readOnly":true}`。
6. **把新的 `/exec` 網址提供給協助網站維護的人**。確認 ping 正常後再更新網站 `index.html` 的 `GAS_WEB_APP_URL`，並將 `BACKEND_V2_READY = false` 改為 `true`。
7. 正式投入 FB 廣告前，手機與桌機各做一次表單全流程，核對以下項目：
   - 流量紀錄有 page_view、registration_click、form_start、registration_success。
   - 流量分析的四段數字由 1 個測試 session 貢獻為 1→1→1→1（測試時避免其他流量干擾）。
   - 報名名單內只新增一筆含測試資料的報名，且 N:V 具有 clientRecordId／來源參數。
   - 再送同手機同孩子，不新增第二筆。
   - 斷網／逾時時，頁面不會直接誤判為失敗且無限制重送。
   - Meta Pixel Helper 或事件管理工具看到 PageView、Lead、CompleteRegistration（後者只在伺服器確認成功時觸發）。

## 原表格相容性

試算表： [1122親子自律活動報名](https://docs.google.com/spreadsheets/d/18wCkJwb4QMUevo8_Ko1NXhjGXNHEuWkTPhK7Gv0d0Aw/edit)

- `1122親子自律活動報名`：保留 A:M 原本欄位，首次成功報名時將 N:V 設為新版追蹤標題。
- `1122活動進站紀錄`：保留舊版 A:F 進站紀錄。
- `流量紀錄`：使用已建立的 A:Q 欄位。
- `流量分析`：每次寫入事件時更新 B2:B5 的不重複 session 總數；原本的比率公式保留。

## 重要注意

- **這份程式目前只是 GitHub 原始碼，並未自動更新線上 Apps Script。**
- 不能只把 `BACKEND_V2_READY` 改成 true：一定要先部署新 GAS 並測試 ping。
- 不要把既有 `/exec` 改為新程式但忘了部署；部署新版本需要 Apps Script 授權。
- 不要把金鑰、登入資訊或 Google 帳號密碼貼在聊天室。
- 因為這是公開報名，請留意惡意大量送件風險；如果投放規模增加，再增設防濫用防護。
- 本版沒有假裝測試真的寫入正式 Google Sheet；最後仍需真實裝置驗收並刪除測試報名資料。
