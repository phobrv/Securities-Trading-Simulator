# Ngày 4 — Market Session

## Đồng hồ giả lập

Market Session dùng Clock riêng. Mặc định dùng giờ hệ thống:

```dotenv
SIM_CLOCK_MODE=SYSTEM
```

Để kiểm tra lặp lại, cấu hình rồi khởi động lại backend:

```dotenv
SIM_CLOCK_MODE=FIXED
SIM_NOW=2026-10-20T10:00:00+07:00
```

`SIM_NOW` phải là ISO 8601 có timezone.

## Lịch `SIM_EQ_A`

Timezone `Asia/Ho_Chi_Minh`; giao dịch thứ Hai đến thứ Sáu và `2026-10-21` là ngày nghỉ fixture.

| Khoảng giờ | Phiên | Loại lệnh được nhận |
| --- | --- | --- |
| Trước 09:00 | `PRE_OPEN` | Không nhận |
| 09:00–09:15 | `OPENING_AUCTION` | LO, ATO |
| 09:15–11:30 | `CONTINUOUS` | LO |
| 11:30–13:00 | `BREAK` | Không nhận |
| 13:00–14:30 | `CONTINUOUS` | LO |
| 14:30–14:45 | `CLOSING_AUCTION` | LO, ATC |
| Từ 14:45 | `CLOSED` | Không nhận |

Khoảng thời gian đầu gồm, cuối không gồm. `SIM_EQ_B`, `SIM_FUND`, `SIM_BOND` chưa có lịch và trả `422 MARKET_SESSION_NOT_CONFIGURED`.

## API

```bash
curl "http://localhost:3000/api/markets/SIM_EQ_A/session"
curl -X POST http://localhost:3000/api/order-validations/session \
  -H "Content-Type: application/json" \
  -d '{"securityId":"sec-001","side":"BUY","orderType":"ATO","quantity":100}'
```

`GET /api/markets/:marketCode/session` trả phiên, loại lệnh được nhận, instant, thời điểm kết thúc và Clock mode. Frontend tự làm mới `SIM_EQ_A` mỗi 5 giây.

`POST /api/order-validations/session` lấy `marketCode` từ Security Master. Request hợp lệ luôn trả `200`; các reason code là `SECURITY_NOT_TRADABLE`, `NON_TRADING_DAY`, `SESSION_NOT_ACCEPTING_ORDERS`, `ORDER_TYPE_NOT_ALLOWED_IN_SESSION`. Input sai trả `400`; security không tồn tại trả `404 SECURITY_NOT_FOUND`.
