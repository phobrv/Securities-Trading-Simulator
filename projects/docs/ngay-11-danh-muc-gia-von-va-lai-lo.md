# Ngày 11 — Danh mục, giá vốn bình quân và lãi/lỗ

## Phạm vi và trạng thái

Luồng BUY LO có giữ tiền cho `sec-001` ghi nhận chứng khoán mua chờ nhận và giá vốn theo **giá execution**. Portfolio API định giá vị thế bằng giá khớp cuối của Market Data; giao diện Vue hiển thị vị thế kinh tế, lượng có thể bán và P&L chưa thực hiện. Phạm vi là vị thế long, VND, phí và thuế bằng 0; đây là simulator học tập, không dùng cho giao dịch thực.

Chưa có settlement hoặc luồng bán tài khoản hoàn chỉnh. Bán chỉ được kiểm tra bằng calculator và fixture độc lập. Matching Simulator và luồng lệnh tài khoản vẫn độc lập: execution mô phỏng qua OMS không tự cập nhật quote Market Data; execution Matching Simulator cũng không tự hạch toán tài khoản.

## Cấu trúc code

| Thành phần  | Tệp trong `projects/`                                                                                              | Vai trò                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Migration   | `backend/src/database/migrations/1792800008000-create-portfolio.ts`                                                | Mở rộng positions, tạo movement và fixture `acc-004`.                     |
| Ghi vị thế  | `backend/src/modules/accounts/position-write.repository.ts`                                                        | Ghi BUY execution và movement bằng connection của transaction OMS.        |
| OMS và tiền | `backend/src/modules/oms/oms.repository.ts`, `backend/src/modules/cash/cash.repository.ts`                         | Chống trùng execution và phối hợp order, event, tiền và vị thế.           |
| Tính toán   | `backend/src/modules/portfolio/cost-basis.calculator.ts`                                                           | Giá vốn mua, bình quân, làm tròn và calculator bán độc lập bằng `bigint`. |
| API đọc     | `backend/src/modules/portfolio/portfolio.service.ts`, `portfolio.routes.ts`                                        | Kết hợp positions với `lastPrice` Market Data; trả Portfolio API.         |
| Giao diện   | `frontend/src/features/portfolio/PortfolioPanel.vue`, `portfolio.types.ts`, `frontend/src/services/account-api.ts` | Tải và hiển thị danh mục theo tài khoản; nút làm mới.                     |
| Kiểm thử    | `backend/tests/portfolio/portfolio.test.ts`, `backend/tests/cash/cash.mysql.test.ts`                               | Calculator, định giá, HTTP và transaction MySQL opt-in.                   |

## Dữ liệu, công thức và làm tròn

Migration thêm `positions.total_cost` và `realized_pnl` kiểu `DECIMAL(20,0)`, cho phép `NULL`; `total_cost` nếu có phải không âm. Position mới do execution tạo được khởi tạo cost và realized bằng 0. Position cũ chưa biết cost giữ `NULL`, không coi là cost 0. `position_movements` lưu delta lượng kinh tế, tổng cost, realized P&L và payload; business key duy nhất theo `(account_id, security_id, business_key)`. Schema có loại `OPENING`, `BUY`, `SELL`, nhưng luồng ghi hiện tại chỉ ghi `BUY`.

```text
economicQuantity = settledQuantity + pendingBuyQuantity - pendingSellQuantity
availableQuantity = settledQuantity - pendingSellQuantity
                    - activeReservedQuantity - blockedQuantity
newTotalCost = oldTotalCost + executionPrice × executionQuantity
marketValue = economicQuantity × lastPrice
unrealizedPnl = marketValue - totalCost
```

Reservation hoặc phong tỏa làm giảm khả dụng, không làm giảm lượng kinh tế. `pendingBuyQuantity` được định giá nhưng không được tính vào lượng có thể bán: sau hai lần mua chờ nhận, 200 cổ phiếu có thể được định giá trong khi `availableQuantity = 0`.

Tổng cost và P&L tính bằng `bigint`; các trường tiền và giá trong Portfolio JSON là chuỗi. `averageCost` được suy ra từ tổng cost và lượng kinh tế, làm tròn half-up đến **6 chữ số thập phân**, không dùng lại làm nguồn tính toán. Calculator bán phân bổ `roundHalfUp(totalCost × soldQuantity / economicQuantity)` đến đồng nguyên; bán hết dùng toàn bộ cost còn lại. Sau bán, tăng `pendingSellQuantity`, chưa giảm `settledQuantity`; realized P&L bằng giá trị bán trừ cost phân bổ.

## Transaction execution và dữ liệu cũ

Với lệnh có cash reservation, `MySqlOmsRepository.apply` khóa balance, order và reservation; kiểm tra execution replay trước reducer. Sau đó cập nhật order/event, tiền và cash ledger, rồi khởi tạo hoặc khóa position, cập nhật pending buy/cost và ghi movement trên **cùng connection**. Lỗi ở bất kỳ bước nào làm rollback toàn transaction. Business key execution là `EXECUTION:<orderId>:<executionId>`; replay cùng nội dung trả trạng thái order hiện tại, không hạch toán lại. Cùng ID với giá hoặc lượng khác trả `409 EXECUTION_ID_REUSED`.

Execution ngày 10 có thể đã ghi cash ledger nhưng chưa có position movement. Không replay để backfill: nếu phát hiện execution cũ thiếu movement của cùng tài khoản/mã, execution mới trả `409 POSITION_HISTORY_INCOMPLETE` và transaction rollback. Cần thiết kế backfill riêng trước khi tiếp tục; hiện chưa có công cụ backfill. OMS demo cũ không có reservation tiếp tục hoạt động riêng, không ghi position theo luồng này.

Migration tạo `acc-004`, CASH/ACTIVE, số dư đầu kỳ 10.000.000 VND và cash ledger `OPENING`; ban đầu không có position. Migration không hỗ trợ revert tự động. MySQL DDL có implicit commit và migration này không bọc toàn bộ schema/seed trong một transaction: nếu chạy lỗi giữa chừng, kiểm tra thủ công trước khi chạy lại, không xóa lịch sử tài chính để thử lại.

## Portfolio API và giao diện

```http
GET /api/accounts/acc-004/portfolio
```

Ví dụ sau hai BUY, **nếu Market Data có `lastPrice = 27000`**:

```json
{
  "data": {
    "accountId": "acc-004",
    "currency": "VND",
    "valuationPolicy": "LAST_TRADED_PRICE",
    "positions": [
      {
        "securityId": "sec-001",
        "symbol": "SIMAAA",
        "marketCode": "SIM_EQ_A",
        "settledQuantity": 0,
        "pendingBuyQuantity": 200,
        "pendingSellQuantity": 0,
        "economicQuantity": 200,
        "availableQuantity": 0,
        "costStatus": "KNOWN",
        "totalCost": "5200000",
        "averageCost": "26000.000000",
        "marketPrice": "27000",
        "marketValue": "5400000",
        "unrealizedPnl": "200000",
        "realizedPnl": "0",
        "quoteUpdatedAt": "2026-10-20T03:00:00.000Z",
        "valuationStatus": "AVAILABLE"
      }
    ]
  }
}
```

| Tình huống                                                             | Hành vi hiện tại                                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Không có quote, `lastPrice` là `null`, hoặc Market Data không khả dụng | `valuationStatus: UNAVAILABLE`; market price, value và unrealized P&L là `null`.                                                                                         |
| Cost chưa biết                                                         | `costStatus: MISSING`; total cost, average cost và unrealized P&L là `null`. Market value vẫn có thể có nếu có giá.                                                      |
| Quote cũ                                                               | `STALE` khi `updatedAt` cũ hơn đồng hồ simulator quá 5 phút; vẫn trả giá và timestamp. `updatedAt` là thời điểm cập nhật quote, không nhất thiết là thời điểm khớp cuối. |
| Lượng kinh tế bằng 0 và cost đã biết                                   | `averageCost: null`; cost phải bằng 0, nếu không service báo lỗi dữ liệu.                                                                                                |
| Tài khoản không tồn tại                                                | `404 ACCOUNT_NOT_FOUND`.                                                                                                                                                 |

Không tổng hợp tổng P&L toàn danh mục. Giao diện **Ngày 11 · Danh mục** lấy dữ liệu thật theo tài khoản đang chọn, có trạng thái tải/rỗng/lỗi, nhãn mua chờ nhận và cảnh báo thiếu giá vốn hoặc giá cũ. Nhấn **Làm mới** để tải lại; panel không tự cập nhật theo WebSocket.

## Chạy và thực hành

Điều kiện môi trường chung xem [`../README.md`](../README.md). Cấu hình MySQL và Redis; trong `backend/.env` bật `OMS_DEMO_ENABLED=true` cho local/demo, đặt `SIM_CLOCK_MODE=FIXED`, `SIM_NOW=2026-10-20T10:00:00+07:00` và `MARKET_DATA_TRADING_DATE=2026-10-20`. Không ghi đè `.env` hiện có.

```bash
cd projects/backend
npm run migration:show
npm run migration:run
npm run dev
```

Các kết quả dưới đây giả định `acc-004` vừa migrate và chưa dùng. Không reset hay xóa ledger để chạy lại; chọn idempotency key và execution ID mới cho mỗi ý định mới. Tạo lệnh đầu tiên và lấy `data.orderId` từ response:

```bash
curl -i -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: day11-buy-001' \
  -d '{"accountId":"acc-004","securityId":"sec-001","side":"BUY","orderType":"LO","price":25000,"quantity":100}'
```

Thay `ORDER_ID` bằng ID vừa nhận, rồi chấp nhận và khớp:

```bash
ORDER_ID='<orderId-lenh-1>'
curl -X POST "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/simulate" -H 'Content-Type: application/json' -d '{"type":"OrderAccepted"}'
curl -X POST "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/simulate" -H 'Content-Type: application/json' -d '{"type":"ExecutionReceived","executionId":"day11-exe-001","quantity":100,"price":25000}'
```

Tạo lệnh thứ hai, thay `ORDER_ID` bằng ID mới, rồi chấp nhận và khớp:

```bash
curl -i -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: day11-buy-002' \
  -d '{"accountId":"acc-004","securityId":"sec-001","side":"BUY","orderType":"LO","price":27000,"quantity":100}'
ORDER_ID='<orderId-lenh-2>'
curl -X POST "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/simulate" -H 'Content-Type: application/json' -d '{"type":"OrderAccepted"}'
curl -X POST "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/simulate" -H 'Content-Type: application/json' -d '{"type":"ExecutionReceived","executionId":"day11-exe-002","quantity":100,"price":27000}'
curl http://localhost:3000/api/accounts/acc-004/portfolio
curl http://localhost:3000/api/accounts/acc-004/balances
curl http://localhost:3000/api/accounts/acc-004/cash-ledger
```

Kỳ vọng: `pendingBuyQuantity=200`, `economicQuantity=200`, `availableQuantity=0`, `totalCost="5200000"`, `averageCost="26000.000000"`, `realizedPnl="0"`; tiền `settledCash="10000000"`, `reservedCash="0"`, `buyPayable="5200000"`, `availableCash="4800000"`. Nếu Market Data có giá 27.000 thì `marketValue="5400000"`, `unrealizedPnl="200000"`. Nếu chưa có giá khớp trong Market Data thì các trường định giá là `null`; test unit dùng quote fixture riêng 27.000. Để tạo quote thực tế, dùng Matching Simulator độc lập theo [ngày 5](./ngay-05-matching-simulator.md), lưu ý giá khớp là giá maker và sổ có thể đã chứa lệnh. Không giả định execution OMS tạo quote.

## Kiểm thử và giới hạn

```bash
cd projects/backend
npm test
npm run build
cd ../frontend
npm run build
```

Lần kiểm tra triển khai gần nhất: backend có **93 test đạt, 22 test bỏ qua**; backend và frontend build thành công. Test mặc định dùng fake, không cần MySQL. Các test MySQL mới cho hai BUY, replay và lỗi ghi movement **chưa được chạy trong lần kiểm tra đó**, vì vậy chưa kết luận transaction thực tế đã được xác minh.

Để chạy kiểm thử MySQL opt-in, chỉ dùng database test riêng đã migration, `DB_NAME` chứa `test` và `DB_*` phù hợp:

```bash
DB_NAME=securities_simulator_test npm run migration:run
DB_NAME=securities_simulator_test CASH_MYSQL_TEST=true npm test -- --runTestsByPath tests/cash/cash.mysql.test.ts
```

Chạy hai lệnh trên từ `projects/backend/`. Test tạo fixture tài khoản riêng và không tự xóa; không dùng database demo hoặc dữ liệu cần giữ. Test unit kiểm tra mua theo giá execution, bình quân, bán một phần/bán hết, làm tròn, dữ liệu thiếu, quote đổi và lượng bị giữ/phong tỏa. Kịch bản bán chưa ghi movement, chưa hạch toán tiền bán và không phải API end-to-end.
