# Ngày 6 — Tài khoản và tài sản khả dụng

## Phạm vi

Accounts quản lý số dư theo từng tiểu khoản độc lập. Hiện chỉ có `CASH` và VND; không có margin, phí, thuế, ứng trước tiền bán hoặc ngân hàng liên kết. API chỉ đọc và kiểm tra thử; không gửi lệnh, không reserve tài sản và không nối trực tiếp Matching Simulator.

Migration tạo bốn bảng:

- `accounts`
- `cash_balances`
- `positions`
- `security_reservations`

## Fixture

| Tài khoản | Tiền khả dụng | `sec-001` có thể bán |
| --- | ---: | ---: |
| `acc-001` | 6.000.000 đồng | 550 |
| `acc-002` | 1.000.000 đồng | 100 |

`acc-001` có 10.000.000 tiền đã thanh toán, 2.500.000 đang giữ mua, 1.000.000 nghĩa vụ mua, 500.000 phong tỏa khác, 2.000.000 tiền bán chờ nhận; position `sec-001` có 1.000 settled, 200 pending buy, 100 pending sell, 50 blocked. Hai reservation `ACTIVE` là 200 và 100; một reservation `RELEASED` là 50.

## Công thức và quy ước số

```text
availableCash = settledCash - reservedCash - buyPayable - blockedCash

availableQuantity = settledQuantity - pendingSellQuantity
                    - activeReservedQuantity - blockedQuantity
```

Không cộng `pendingReceivable` vào tiền khả dụng hoặc `pendingBuyQuantity` vào lượng có thể bán. Chỉ reservation `ACTIVE` được tính. Query positions tổng hợp reservation theo `(account_id, security_id)` trước khi join để không nhân đôi số lượng.

Tiền được lưu `DECIMAL(20,0)`, chuyển thành `bigint` trong backend và trả JSON dưới dạng chuỗi số nguyên. Dữ liệu tạo khả dụng âm là lỗi toàn vẹn, không clamp về 0.

## API

```bash
curl "http://localhost:3000/api/accounts/acc-001/balances"
curl "http://localhost:3000/api/accounts/acc-001/positions"

curl -X POST http://localhost:3000/api/accounts/acc-001/availability-checks \
  -H "Content-Type: application/json" \
  -d '{"securityId":"sec-001","side":"BUY","orderType":"LO","price":25000,"quantity":240}'
```

- `GET /api/accounts/:id/balances`: thành phần tiền, `availableCash`, policy `CASH_ONLY_NO_ADVANCE`.
- `GET /api/accounts/:id/positions`: vị thế, `reservedQuantity`, `availableQuantity`.
- `POST /api/accounts/:id/availability-checks`: preview LO BUY/SELL. `price` và `quantity` phải là số nguyên dương an toàn; quantity không vượt `INT UNSIGNED`.

Request đúng cấu trúc trả `200` cả khi bị từ chối nghiệp vụ:

| Điều kiện | `valid` | `reasonCode` |
| --- | --- | --- |
| Tiền/chứng khoán vừa đủ | `true` | Không có |
| Thiếu tiền | `false` | `INSUFFICIENT_CASH` |
| Thiếu chứng khoán | `false` | `INSUFFICIENT_SECURITIES` |
| Account `BLOCKED` | `false` | `ACCOUNT_NOT_ACTIVE` |
| Security không `TRADABLE` | `false` | `SECURITY_NOT_TRADABLE` |

Account hoặc security không tồn tại trả `404`; input sai trả `400`; account tồn tại nhưng thiếu `cash_balances` trả `500 ACCOUNT_DATA_INTEGRITY_ERROR`. Security hợp lệ nhưng account không có position có lượng bán khả dụng bằng 0.

## Frontend và giới hạn

Frontend có bộ chọn `acc-001`/`acc-002`, panel tiền, bảng positions và form **Kiểm tra thử**. Form không có nút Đặt lệnh; số dư fixture không đổi theo Matching Simulator.

Preview không ghi database và không bảo vệ được hai request đồng thời cùng dùng một số dư. Kiểm tra và reserve tài sản phải là thao tác nguyên tử ở các ngày sau. Preview cũng chưa tổng hợp kiểm tra phiên, lô, bước giá, biên độ giá, đăng nhập hoặc phân quyền.
