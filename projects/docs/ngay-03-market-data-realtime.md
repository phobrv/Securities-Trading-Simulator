# Ngày 3 — Market Data realtime

## Phạm vi

Backend có một Price Simulator cho `sec-001 / SIMAAA / SIM_EQ_A`, độc lập với số tab trình duyệt. Tick đầu được phát khi Redis sẵn sàng, sau đó mỗi 2 giây: `25.000 × 100`, `25.100 × 200`, `25.200 × 100`. Sau ba tick, `totalVolume = 400`, `totalValue = 10.040.000`.

Giá API là VND trên một đơn vị chứng khoán (`VND_PER_UNIT`), không nhân/chia thêm 1.000 ở frontend.

## Redis và WebSocket

Snapshot lưu tại:

```text
md:quote:<tradingDate>:sec-001
```

Sau khi ghi snapshot thành công, backend publish channel `md:quotes`. Gateway lọc theo subscription rồi gửi WebSocket:

```json
{ "type": "quote.snapshot", "data": { "securityId": "sec-001" } }
```

Client kết nối `ws://localhost:3000/ws/market-data` và gửi:

```json
{ "type": "subscribe", "securityIds": ["sec-001"] }
```

Vue tải Security Master, đăng ký security IDs, thay snapshot theo ID và reconnect sau khi mất kết nối.

## API và giới hạn

```bash
curl "http://localhost:3000/api/market-data/quotes?securityIds=sec-001,sec-003"
```

Endpoint trả quote hiện có và `missingQuoteSecurityIds`; ID không tồn tại trả `400 INVALID_SECURITY_IDS`, Redis không sẵn sàng trả `503 MARKET_DATA_UNAVAILABLE`.

Chưa ghi tick/lịch sử giá vào MySQL, chưa có delta, sequence hay replay. Redis Pub/Sub không phát lại message đã bỏ lỡ; reconnect chỉ nhận snapshot mới nhất. Tick không tạo execution và không đổi tài sản account.
