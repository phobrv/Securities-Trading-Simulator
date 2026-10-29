# Ngày 8 — OMS và vòng đời lệnh

## Phạm vi và luồng dữ liệu

OMS demo lưu yêu cầu lệnh LO, trạng thái hiện tại và timeline trong MySQL. Lệnh OMS độc lập với `SimulatorOrder` và sổ lệnh trong bộ nhớ của Matching Simulator ngày 5. Các phản hồi tiếp nhận, khớp và hủy đều được mô phỏng qua API; không gửi lệnh đến matching, không kiểm tra hoặc giữ tài sản và không thanh toán.

Luồng cập nhật:

1. Router kiểm tra payload, service tạo event và lấy thời gian từ `Clock`.
2. Repository mở transaction, đọc và khóa hàng `orders` bằng `SELECT ... FOR UPDATE`.
3. Reducer `applyOrderEvent` kiểm tra event và tính snapshot mới; không có API sửa trạng thái tùy ý.
4. Repository cập nhật `orders`, tăng version và ghi `order_events` với sequence bằng version mới, rồi commit. Nếu có lỗi, cả hai thay đổi rollback.
5. Frontend đọc snapshot và timeline từ API. Gửi yêu cầu hủy chỉ làm trạng thái yêu cầu hủy thành `PENDING`, không hiển thị lệnh là đã hủy.

Khi tạo lệnh, `orders` và `OrderReceived` được ghi trong cùng transaction với version/sequence bằng 1. Với từng lệnh, timeline được sắp xếp theo `event_sequence`, kể cả khi `FixedClock` cho nhiều event cùng thời điểm.

## Cấu trúc code

| Thành phần | Tệp trong `projects/` | Vai trò |
| --- | --- | --- |
| Migration | `backend/src/database/migrations/1792800004000-create-oms.ts` | Tạo `orders`, `order_events` và các ràng buộc cơ bản. |
| Domain | `backend/src/modules/oms/oms.types.ts`, `oms.reducer.ts` | Kiểu lệnh, event và quy tắc chuyển trạng thái. |
| Service | `backend/src/modules/oms/oms.service.ts` | Điều phối tạo lệnh, áp dụng event, sinh ID và đọc `Clock`. |
| MySQL | `backend/src/modules/oms/oms.repository.ts`, `backend/src/infrastructure/database.ts` | Khóa hàng, transaction và ghi/đọc dữ liệu. |
| HTTP | `backend/src/modules/oms/oms.routes.ts`, `oms.validation.ts` | API demo và validate input. |
| Giao diện | `frontend/src/features/oms/` | Form, trạng thái, phản hồi mô phỏng và timeline. |
| Gọi API | `frontend/src/composables/useOmsDemo.ts`, `frontend/src/services/oms-api.ts` | Quản lý luồng UI và giao tiếp HTTP. |

## Schema và quy ước

- `orders` lưu tài khoản, chứng khoán, BUY/SELL, giá LO, quantity, các lượng filled/remaining/canceled, hai trạng thái và version. Khóa ngoại tham chiếu `accounts` và `securities`.
- `order_events` lưu loại event, trạng thái trước/sau, payload, lý do nếu có, `occurred_at`, `recorded_at` và sequence; `(order_id, event_sequence)` là duy nhất.
- Giá lưu `DECIMAL(20,0)` và được trả dưới dạng chuỗi số nguyên VND/cổ phiếu. Giá đầu vào có thể là số nguyên an toàn hoặc chuỗi số nguyên dương tối đa 20 chữ số. Quantity là số nguyên dương trong phạm vi `INT UNSIGNED`.
- `occurred_at` lấy từ Clock và `recorded_at` do database ghi; timeline dùng sequence thay vì timestamp để xác định thứ tự.
- Event execution là **khối lượng khớp mới**, không phải tổng tích lũy. Giá BUY không cao hơn giá LO; giá SELL không thấp hơn giá LO.
- Khi xác nhận hủy, chuyển remaining tại thời điểm xác nhận sang canceled và giữ nguyên filled. Nếu đang chờ hủy mà lệnh khớp hết, chỉ có thể nhận `CancelRejected`, không nhận `CancelConfirmed`.

## Cấu hình và khởi chạy

Điều kiện cài đặt chung, MySQL và Redis xem [`../README.md`](../README.md). Kiểm tra kết nối database và cấu hình `DB_*` trong `projects/backend/.env`. Chạy từ `projects/backend/`:

```bash
npm run migration:show
npm run migration:run
```

Migration trước đó tạo fixture `acc-001` và `sec-001`. Không cần xóa dữ liệu hay chạy lại seed để thực hành. Nếu chưa có file môi trường, tham khảo `backend/.env.example`; không ghi đè `.env` đang dùng.

API demo mặc định tắt. Trong `projects/backend/.env`, bật cho local/demo:

```dotenv
NODE_ENV=development
OMS_DEMO_ENABLED=true
SIM_CLOCK_MODE=FIXED
SIM_NOW=2026-10-20T10:00:00+07:00
```

`OMS_DEMO_ENABLED=true` chỉ được chấp nhận với `NODE_ENV=development`, `test` hoặc `demo`; không bật trong production. Đây là cấu hình demo, không phải cơ chế xác thực hoặc phân quyền. Sau khi sửa `.env`, khởi động lại backend. Khởi chạy backend và frontend theo [`../README.md`](../README.md); mặc định frontend ở `http://localhost:5173` và API ở `http://localhost:3000`. Redis phục vụ các phần Market Data của dashboard, không phải nơi lưu OMS.

## Thực hành trên giao diện

Mở dashboard, tìm **Ngày 08 · OMS demo**. Với các giá trị mặc định `acc-001`, `sec-001`, BUY, `25000`, quantity `100`:

1. Chọn **Tạo lệnh demo**. Lệnh là `PENDING_NEW`, yêu cầu hủy là `NONE`; sao chép mã lệnh nếu muốn tra cứu lại sau khi reload.
2. Chọn **Chấp nhận lệnh**. Lệnh chuyển `NEW`.
3. Nhập khối lượng khớp `40`, giá `24900`, chọn **Mô phỏng khớp**. Lệnh thành `PARTIALLY_FILLED`, còn 60.
4. Chọn **Gửi yêu cầu hủy**. Yêu cầu hủy là `PENDING`; lệnh vẫn partial và còn 60.
5. Nhập khớp thêm `20` tại giá `25000`, rồi chọn **Mô phỏng khớp**. Lệnh đã khớp 60, còn 40 dù hủy đang chờ.
6. Chọn **Xác nhận hủy phần còn lại**. Lệnh thành `CANCELED`, yêu cầu hủy `ACCEPTED`, khớp 60, còn 0, hủy 40; version 6 và timeline có sáu event.

Để thử kịch bản khớp hết trong khi chờ hủy, tạo lệnh khác, chấp nhận, khớp 40, gửi yêu cầu hủy, khớp tiếp 60 rồi chọn **Từ chối yêu cầu hủy**. Kết quả là `FILLED`, filled 100, canceled 0 và cancel `REJECTED`. Form chỉ hiển thị các thao tác phù hợp trạng thái hiện tại; backend vẫn kiểm tra độc lập.

Nếu có lỗi mạng sau khi gửi event, không giả định request chưa được áp dụng: dùng mã lệnh để **Tra cứu / làm mới** và kiểm tra timeline trước khi gửi lại. API ngày 8 chưa chống event trùng. Nếu API trả 404 endpoint, kiểm tra cấu hình demo và khởi động lại backend; nếu tạo lệnh lỗi, kiểm tra migration và fixture.

## API và đối chiếu thủ công

| Endpoint | Chức năng |
| --- | --- |
| `POST /api/oms-demo/orders` | Tạo lệnh `PENDING_NEW`; trả 201. |
| `GET /api/oms-demo/orders/:id` | Đọc snapshot hiện tại. |
| `GET /api/oms-demo/orders/:id/events` | Đọc timeline theo sequence. |
| `POST /api/oms-demo/orders/:id/simulate` | Áp dụng event mô phỏng hợp lệ. |

Response thành công có dạng `{ "data": ... }`. Sai payload trả 400, không có lệnh trả 404, event xung đột trạng thái trả 409; tài khoản hoặc chứng khoán không tồn tại khi tạo lệnh trả 400. Event từ chối nhận thêm `reasonCode` và `message`.

Tạo lệnh, sau đó lấy `data.id` trong response và đặt vào biến `ORDER_ID`:

```bash
curl -X POST http://localhost:3000/api/oms-demo/orders \
  -H 'Content-Type: application/json' \
  -d '{"accountId":"acc-001","securityId":"sec-001","side":"BUY","orderType":"LO","price":25000,"quantity":100}'

ORDER_ID='<id-tu-response>'
```

Cấp lần lượt các phản hồi của kịch bản chính:

```bash
curl -X POST "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/simulate" -H 'Content-Type: application/json' -d '{"type":"OrderAccepted"}'
curl -X POST "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/simulate" -H 'Content-Type: application/json' -d '{"type":"ExecutionReceived","executionId":"demo-exe-001","quantity":40,"price":24900}'
curl -X POST "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/simulate" -H 'Content-Type: application/json' -d '{"type":"CancelRequested"}'
curl -X POST "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/simulate" -H 'Content-Type: application/json' -d '{"type":"ExecutionReceived","executionId":"demo-exe-002","quantity":20,"price":25000}'
curl -X POST "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/simulate" -H 'Content-Type: application/json' -d '{"type":"CancelConfirmed"}'
curl "http://localhost:3000/api/oms-demo/orders/$ORDER_ID"
curl "http://localhost:3000/api/oms-demo/orders/$ORDER_ID/events"
```

Snapshot cuối có `status=CANCELED`, `cancelRequestStatus=ACCEPTED`, `filledQuantity=60`, `remainingQuantity=0`, `canceledQuantity=40` và `version=6`. Timeline gồm `OrderReceived`, `OrderAccepted`, `ExecutionReceived`, `CancelRequested`, `ExecutionReceived`, `CancelConfirmed` theo thứ tự 1–6.

## Kiểm thử và giới hạn

```bash
cd projects/backend
npm test
npm run build
```

```bash
cd projects/frontend
npm run build
```

`backend/tests/oms/oms.test.ts` kiểm tra reducer, replay và hợp đồng API bằng fake; bộ test mặc định không cần MySQL. `backend/tests/oms/oms.mysql.test.ts` là test tích hợp tùy chọn, cố ý làm insert event thất bại để kiểm tra rollback. Chỉ chạy test này với **database test riêng**, đã chạy migration và có fixture; cấu hình `DB_*` trỏ vào database đó:

```bash
cd projects/backend
OMS_MYSQL_TEST=true npm test -- --testPathPattern=oms.mysql
```

Test tạo và dọn đúng lệnh của nó. Build frontend và test fake không thay thế kiểm thử thực tế với MySQL và trình duyệt; khi báo kết quả cần phân biệt rõ các bước đã chạy và chưa chạy.

Chưa có xử lý event trùng/sai thứ tự, sửa lệnh, hết hiệu lực, trade correction, reserve hay settlement. Transaction MySQL không bao phủ matching trong bộ nhớ; không xem OMS demo là API giao dịch hoàn chỉnh hoặc hệ thống giao dịch thực tế.
