# Ngày 9 — API đặt lệnh và idempotency

API chỉ dành cho local/demo, bật `OMS_DEMO_ENABLED=true` trong `backend/.env` và chạy migration. Requester `local-demo` là cấu hình cố định, không phải xác thực; không dùng API này cho giao dịch thực.

```bash
cd projects/backend
npm run migration:run
```

Dùng đồng hồ cố định `SIM_CLOCK_MODE=FIXED`, `SIM_NOW=2026-10-20T10:00:00+07:00` để phiên cho phép LO. Ví dụ:

```bash
curl -i -X POST http://localhost:3000/api/orders \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: intent-buy-001' \
  -d '{"accountId":"acc-001","securityId":"sec-001","side":"BUY","orderType":"LO","price":25000,"quantity":100}'
```

Lưu `orderId` từ response; `GET /api/orders/:id` đọc trạng thái hiện tại. Để thử hủy, dùng `/api/oms-demo/orders/:id/simulate` gửi `{"type":"OrderAccepted"}` trước, sau đó:

```bash
curl -i -X POST http://localhost:3000/api/orders/ORDER_ID/cancel \
  -H 'Content-Type: application/json' -H 'Idempotency-Key: intent-cancel-001' -d '{}'
```

Hai POST trả `202`, `Idempotency-Replayed: false` lần đầu, `true` khi replay; tạo lệnh còn có `Location`. Hủy chỉ ghi nhận yêu cầu, chưa chuyển lệnh thành `CANCELED`. Lỗi có `code`, `message`, có thể có `details`, và `requestId` riêng cho từng lần HTTP.

## Retry và transaction

Ví dụ server commit xong nhưng response bị mất: client không biết kết quả, gửi lại **cùng key và payload**, server trả nguyên response ban đầu và không ghi thêm lệnh/event. Nếu lệnh đã chuyển trạng thái, replay vẫn trả response cũ; dùng GET để xem trạng thái mới. Cùng scope/key nhưng payload khác trả `409 IDEMPOTENCY_KEY_REUSED`. Ý định mới hoặc yêu cầu hủy dùng key riêng.

Migration tạo `idempotency_requests` với khóa unique theo SHA-256 của scope và key so sánh theo byte. Tạo lệnh, event và response cùng transaction; khi unique tranh chấp, request thua rollback trước khi đọc kết quả đã commit. Chỉ lưu thành công, không lưu lỗi nghiệp vụ và không tự xóa key. Deadlock hoặc chờ khóa quá hạn trả `503`, client nên thử lại cùng key.

## Kiểm thử và giới hạn

`npm test` không yêu cầu MySQL. Kiểm thử MySQL opt-in yêu cầu database **dùng riêng cho test**, đã chạy migration và có fixture chuẩn. Phải chỉ định `DB_NAME` rõ ràng, tên có chứa `test`; không dùng database demo hoặc database có dữ liệu cần giữ. Các test tạo và xóa dữ liệu riêng, đồng thời tạm khóa/cập nhật fixture trong transaction để kiểm tra deadlock.

```bash
DB_NAME=securities_simulator_test npm run migration:run
DB_NAME=securities_simulator_test OMS_MYSQL_TEST=true npm test -- --runTestsByPath tests/oms/order-api.mysql.test.ts tests/oms/order-api-scenarios.mysql.test.ts
```

Bộ test bao gồm request đồng thời, rollback khi ghi event/response thất bại, timeout sau commit, khởi động lại tiến trình HTTP, trạng thái hủy, validation và kiểm tra tài sản không đổi. Ngoài ra kiểm tra lock timeout, deadlock và từ chối kết nối MySQL thực tế; lỗi hạ tầng không trả chi tiết kết nối hoặc SQL cho client.

Chỉ hỗ trợ `sec-001`, LO, giá nguyên 23.000–27.000 bước 100. Kiểm tra tài sản là sơ bộ, không giữ tiền/chứng khoán; hai ý định khác nhau có thể cùng vượt qua precheck. Chống trùng không thay thế giữ tài sản. Chưa gửi vào matching, chưa sửa lệnh và chưa có xác thực/phân quyền.
