# Ngày 5 — Matching Simulator

## Phạm vi

Matching Simulator chỉ hỗ trợ `sec-001 / SIMAAA / SIM_EQ_A`, lệnh giới hạn `LO` và phiên `CONTINUOUS`. Sổ lệnh, arrival sequence, client order ID và execution nằm trong bộ nhớ của một backend instance; khởi động lại backend sẽ mất toàn bộ dữ liệu này.

Engine bảo toàn ưu tiên giá/thời gian: BUY giá cao hơn trước, SELL giá thấp hơn trước, cùng giá theo `arrivalSequence` (FIFO). Khi giá giao nhau, execution dùng giá của maker. Một lệnh có thể tạo nhiều execution; phần LO chưa khớp tiếp tục nằm trong sổ.

## Kịch bản demo

Đặt `SIM_CLOCK_MODE=FIXED` và `SIM_NOW=2026-10-20T10:00:00+07:00`, sau đó gửi:

```bash
curl -X POST http://localhost:3000/api/simulator/orders \
  -H "Content-Type: application/json" \
  -d '{"clientOrderId":"S1","securityId":"sec-001","side":"SELL","orderType":"LO","price":24900,"quantity":40}'

curl -X POST http://localhost:3000/api/simulator/orders \
  -H "Content-Type: application/json" \
  -d '{"clientOrderId":"S2","securityId":"sec-001","side":"SELL","orderType":"LO","price":25000,"quantity":100}'

curl -X POST http://localhost:3000/api/simulator/orders \
  -H "Content-Type: application/json" \
  -d '{"clientOrderId":"S3","securityId":"sec-001","side":"SELL","orderType":"LO","price":25100,"quantity":50}'

curl -X POST http://localhost:3000/api/simulator/orders \
  -H "Content-Type: application/json" \
  -d '{"clientOrderId":"B1","securityId":"sec-001","side":"BUY","orderType":"LO","price":25000,"quantity":100}'
```

`B1` tạo `40 @ 24.900` với `S1` và `60 @ 25.000` với `S2`, tổng giá trị `2.496.000` VND. `B1`/`S1` là `FILLED`; `S2` còn 40 là `PARTIALLY_FILLED`; `S3` là `NEW`.

## API

```bash
curl http://localhost:3000/api/simulator/order-books/sec-001
curl "http://localhost:3000/api/simulator/executions?securityId=sec-001"
```

- `POST /api/simulator/orders` trả `201` với order và các execution vừa tạo.
- `GET /api/simulator/order-books/:securityId` trả độ sâu cộng gộp theo mức giá.
- `GET /api/simulator/executions?securityId=...` trả executions theo thứ tự tạo.

| Điều kiện | HTTP | Mã lỗi |
| --- | ---: | --- |
| Giá, quantity, side hoặc body không hợp lệ | 400 | `INVALID_ORDER_INPUT` |
| Loại lệnh không phải LO | 400 | `UNSUPPORTED_ORDER_TYPE` |
| Security không tồn tại | 404 | `SECURITY_NOT_FOUND` |
| Security không `TRADABLE` | 422 | `SECURITY_NOT_TRADABLE` |
| Không phải `sec-001` | 422 | `SECURITY_NOT_SUPPORTED` |
| Ngoài `CONTINUOUS` | 422 | `MATCHING_SESSION_NOT_SUPPORTED` |
| `clientOrderId` đã dùng trong instance | 409 | `DUPLICATE_CLIENT_ORDER_ID` |

## Giới hạn

Matching chưa tích hợp Market Data: Price Simulator vẫn tự tạo tick; execution/bid/ask chưa cập nhật Redis hoặc WebSocket. Matching cũng chưa là OMS, chưa giữ tài sản, chưa cập nhật số dư hay position sau execution. Kiểm tra availability nằm ở API Accounts riêng của Ngày 6 và chưa được gọi khi nhận lệnh.
