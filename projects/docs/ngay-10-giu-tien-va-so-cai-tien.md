# Ngày 10 — Giữ tiền và sổ cái tiền

## Phạm vi và trạng thái

Backend bổ sung giữ tiền cho BUY LO `sec-001`, VND, phí và thuế bằng 0. API đặt lệnh và các phản hồi simulate cho lệnh có reservation cập nhật OMS và tiền trong transaction MySQL; không nối Matching Simulator. Chưa có settlement, cập nhật positions, giữ chứng khoán hay kế toán kép. Đây là simulator phục vụ học tập, không dùng cho giao dịch thực.

Các test MySQL ngày 10 đã chạy thành công trên MySQL 8.0. Bộ integration MySQL ngày 9 cũ **chưa được cập nhật**: một số test vẫn dùng `acc-001` với `POST /api/orders` và kỳ vọng không thay đổi tài sản, trái với chính sách ngày 10. Xem phần kiểm thử bên dưới; không coi toàn bộ hồi quy ngày 9 là đã đạt.

## Cấu trúc code

| Thành phần | Tệp trong `projects/` | Vai trò |
| --- | --- | --- |
| Migration | `backend/src/database/migrations/1792800006000-create-cash-ledger.ts`, `1792800007000-seed-cash-ledger.ts` | Tạo bảng tiền và fixture có ledger đầu kỳ. |
| Tính toán | `backend/src/modules/cash/cash.calculator.ts` | Tính reserve, payable và phần dư bằng `bigint`, kiểm tra giới hạn tiền. |
| Ghi tiền | `backend/src/modules/cash/cash.repository.ts` | Khóa số dư, đối chiếu, ghi reservation và ledger bằng connection của transaction. |
| Đặt lệnh | `backend/src/modules/oms/order-api.service.ts`, `order-api.repository.ts`, `order-api.precheck.ts` | Idempotency, precheck, tạo order/event và giữ tiền. |
| Xử lý event | `backend/src/modules/oms/oms.service.ts`, `oms.repository.ts`, `oms.reducer.ts` | Áp dụng event OMS và biến động tiền cùng transaction; chống execution trùng cho lệnh có reservation. |
| API đọc | `backend/src/modules/cash/cash-read.routes.ts`, `cash-read.service.ts`, `cash-read.repository.ts` | Đọc reservation và ledger. API số dư dùng module `accounts` hiện có. |
| Kiểm thử | `backend/tests/cash/` | Kiểm tra tính toán, HTTP và transaction MySQL opt-in. |

## Dữ liệu và chính sách tiền

`cash_balances` lưu các thành phần số dư hiện tại; `cash_reservations` lưu khoản giữ theo order; `cash_ledger_entries` lưu lịch sử thay đổi năm thành phần tiền. Mỗi order có tối đa một reservation. Ledger dùng business key duy nhất theo account và đọc theo `id` tăng dần, không theo timestamp; không sửa/xóa entry để làm số dư khớp.

Tiền lưu `DECIMAL(20,0)`, tính bằng `bigint`; API đọc tiền dưới dạng chuỗi. `pendingReceivable` không làm tăng tiền khả dụng:

```text
availableCash = settledCash - reservedCash - buyPayable - blockedCash
initialAmount = remainingAmount + consumedAmount + releasedAmount
reservedCash = SUM(reservation.remainingAmount)
```

Trước khi nhận lệnh, `requireFunds` khóa balance, kiểm tra có `OPENING:<accountId>:v1`, đối chiếu tổng delta ledger với năm thành phần balance và tổng remaining reservations với `reservedCash`, rồi kiểm tra tiền khả dụng. Thiếu opening trả `422 CASH_ACCOUNT_NOT_INITIALIZED`; dữ liệu không khớp trả `409 CASH_RECONCILIATION_FAILED`; thiếu tiền trả `422 INSUFFICIENT_CASH`.

Migration tạo `acc-003` ACTIVE, CASH, số dư đầu kỳ 10.000.000 VND, các thành phần khác bằng 0 và entry `OPENING` tương ứng. Ba bản ghi dữ liệu này được ghi trong cùng transaction. Không thay đổi `acc-001`/`acc-002` hay dựng lịch sử giả cho số dư cũ: các tài khoản này vẫn đọc được và dùng OMS demo cũ, nhưng không đặt qua `POST /api/orders` mới. `POST /api/oms-demo/orders` không cho tạo trực tiếp order cho tài khoản đã có opening.

## Transaction đặt lệnh

```text
BEGIN
→ giành idempotency key
→ khóa cash_balances FOR UPDATE, kiểm tra opening và đối chiếu
→ kiểm tra tiền, account, security, giá và phiên
→ tạo PENDING_NEW và OrderReceived
→ tạo reservation, tăng reserved_cash, ghi RESERVE
→ lưu response idempotency
COMMIT
```

Các thao tác ghi dùng cùng connection; lỗi khiến transaction rollback. Replay cùng key và payload trả response ban đầu với `Idempotency-Replayed: true`, không giữ thêm tiền; cùng key khác payload trả `409 IDEMPOTENCY_KEY_REUSED`. `POST /api/orders` hiện chỉ hỗ trợ BUY, LO, `sec-001`, giá nguyên từ 23.000 đến 27.000, bước 100; đầu vào `price` là JSON number nguyên an toàn.

## Execution, hủy và từ chối

Với order có reservation, đường simulate khóa theo thứ tự `cash_balances → orders → cash_reservations`, áp dụng reducer và ghi order/event cùng các thay đổi tiền. Execution có `q` là lượng khớp mới, `L` là giá giới hạn và `p` là giá khớp:

```text
remainingAmount và reservedCash giảm q × L
consumedAmount và buyPayable tăng q × p
releasedAmount tăng q × (L − p)
```

BUY LO yêu cầu `p <= L`. Khi remaining bằng 0, reservation chuyển `CLOSED`. **Không giảm `settledCash` khi khớp**: nghĩa vụ đã nằm trong `buyPayable`; giảm cả hai sẽ trừ khả dụng hai lần. `consumedAmount` là phần đã phân bổ cho giao dịch, không có nghĩa đã thanh toán.

`CancelRequested` không đổi tiền; `CancelConfirmed` giải phóng remaining thực tế khi xác nhận, kể cả khi đã khớp thêm trong lúc chờ. `OrderRejected` khi `PENDING_NEW` giải phóng phần giữ; `CancelRejected` không giải phóng. Các event không hợp lệ bị reducer từ chối.

Business key execution là `EXECUTION:<orderId>:<executionId>`. Cùng ID và nội dung được xem là replay, trả **trạng thái order hiện tại**, không thêm event hoặc ledger; cùng ID nhưng quantity/price khác trả `409 EXECUTION_ID_REUSED`. Cơ chế này chỉ bảo vệ execution của lệnh có reservation, không phải consumer dedup tổng quát. Lệnh demo cũ không có reservation tiếp tục theo hành vi OMS cũ.

## Chạy và thực hành API

Điều kiện môi trường chung xem [`../README.md`](../README.md). Trong `projects/backend/.env`, dùng MySQL đã cấu hình, bật `OMS_DEMO_ENABLED=true` cho local/demo và đặt `SIM_CLOCK_MODE=FIXED`, `SIM_NOW=2026-10-20T10:00:00+07:00`. Không ghi đè `.env` hiện có. Chạy:

```bash
cd projects/backend
npm run migration:show
npm run migration:run
npm run dev
```

MySQL DDL có implicit commit: migration schema không nguyên tử với việc tạo bảng và seed. Nếu migration schema lỗi giữa chừng, kiểm tra thủ công trước khi chạy lại. Migration ledger và seed không hỗ trợ `migration:revert` tự động để tránh xóa lịch sử tiền. Đọc ledger trước khi thử: ví dụ số dư kỳ vọng bên dưới giả định `acc-003` còn đúng opening ban đầu. Không tự xóa hoặc reset ledger để chạy lại; key và execution ID nên được chọn mới cho mỗi ý định mới.

1. Tạo lệnh, sau đó gửi lại chính request để kiểm tra replay:

```bash
curl -i -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: intent-day10-buy-001' \
  -d '{"accountId":"acc-003","securityId":"sec-001","side":"BUY","orderType":"LO","price":25000,"quantity":100}'
```

Response `202` có `data.orderId`, header `Location` và `Idempotency-Replayed`. Replay đúng key/payload trả cùng body và header replay `true`. Đặt `ORDER_ID` bằng `data.orderId` nhận được; không dùng lại key cố định cho một ý định mới.

2. Chấp nhận, khớp một phần, gửi yêu cầu hủy và xác nhận hủy:

```bash
ORDER_ID='<orderId-tu-response>'
curl -X POST "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/simulate" -H 'Content-Type: application/json' -d '{"type":"OrderAccepted"}'
curl -X POST "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/simulate" -H 'Content-Type: application/json' -d '{"type":"ExecutionReceived","executionId":"day10-exe-001","quantity":40,"price":24900}'
curl -i -X POST "http://localhost:3000/api/orders/$ORDER_ID/cancel" -H 'Content-Type: application/json' -H 'Idempotency-Key: intent-day10-cancel-001' -d '{}'
curl -X POST "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/simulate" -H 'Content-Type: application/json' -d '{"type":"CancelConfirmed"}'
```

3. Đối chiếu:

```bash
curl "http://localhost:3000/api/orders/$ORDER_ID"
curl "http://localhost:3000/api/orders/$ORDER_ID/cash-reservation"
curl http://localhost:3000/api/accounts/acc-003/balances
curl http://localhost:3000/api/accounts/acc-003/cash-ledger
curl "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/events"
```

Với fixture ban đầu chưa dùng: order `CANCELED`, filled 40, canceled 60; balance `settledCash=10000000`, `reservedCash=0`, `buyPayable=996000`, `availableCash=9004000`; reservation `initialAmount=2500000`, `remainingAmount=0`, `consumedAmount=996000`, `releasedAmount=1504000`, `CLOSED`.

| Ledger | Delta settled | Delta reserved | Delta payable |
| --- | ---: | ---: | ---: |
| OPENING | +10.000.000 | 0 | 0 |
| RESERVE | 0 | +2.500.000 | 0 |
| EXECUTION | 0 | −1.000.000 | +996.000 |
| RELEASE | 0 | −1.500.000 | 0 |

Reservation không tồn tại trả `404 CASH_RESERVATION_NOT_FOUND`; order không tồn tại trả `404 ORDER_NOT_FOUND`. Ledger của tài khoản không tồn tại trả `404 ACCOUNT_NOT_FOUND`. API đọc ledger không phân trang trong phiên bản hiện tại. Chưa có giao diện riêng cho reservation/ledger; sử dụng API để đối chiếu.

## Kiểm thử

```bash
cd projects/backend
npm test
npm run build
```

Test mặc định không cần MySQL và bỏ qua integration opt-in. Để chạy test tiền, dùng **database test riêng đã migrate**, chỉ định `DB_NAME` chứa `test` và cấu hình `DB_*` phù hợp; không dùng database demo hoặc dữ liệu cần giữ:

```bash
DB_NAME=securities_simulator_test npm run migration:run
DB_NAME=securities_simulator_test CASH_MYSQL_TEST=true npm test -- --runTestsByPath tests/cash/cash.mysql.test.ts
```

Test kiểm tra fixture, replay, execution đồng thời/trùng, đối chiếu ledger, hai lệnh cùng cần 7 triệu, reject/cancel, khớp hết, khớp trong lúc chờ hủy và rollback khi ghi ledger lỗi. Test tạo các account fixture riêng và **không tự xóa chúng**; test fixture `acc-003` giả định database test vừa migrate và chưa dùng account này.

Lần kiểm tra triển khai gần nhất: build thành công, test mặc định 86 đạt/20 bỏ qua, test MySQL ngày 10 7/7 đạt. Bộ MySQL ngày 9 cũ khi bật `OMS_MYSQL_TEST=true` còn thất bại do kỳ vọng luồng cũ và có test timeout; cần cập nhật fixture và assertions, chạy lại trước khi kết luận hồi quy hoàn tất.
