# Securities Trading Simulator — Ngày 5

Ứng dụng mô phỏng giao dịch chứng khoán phục vụ học tập. Ngày 5 bổ sung Matching Simulator: sổ lệnh giới hạn trong bộ nhớ, ưu tiên giá/thời gian và các lần khớp lệnh cơ bản. Dự án không dùng cho giao dịch thực tế.

## Cấu trúc

- `backend/`: Node.js, TypeScript, Express, MySQL, Redis và WebSocket.
- `frontend/`: Vue 3, TypeScript, Vite và Tailwind CSS.

## Yêu cầu

- Node.js 20 trở lên.
- npm.
- MySQL 8.0 trở lên, cài trực tiếp trên máy.
- Redis 7 trở lên, cài trực tiếp trên máy.

## Khởi động MySQL

Khởi động MySQL nếu dịch vụ chưa chạy. Với bản cài từ Homebrew trên macOS:

```bash
brew services start mysql
```

Tạo database và user riêng cho ứng dụng. Thay mật khẩu mẫu trước khi dùng ngoài môi trường học tập local:

```sql
CREATE DATABASE IF NOT EXISTS securities_simulator
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'simulator'@'localhost'
  IDENTIFIED BY 'simulator_local_password';

GRANT ALL PRIVILEGES ON securities_simulator.* TO 'simulator'@'localhost';
FLUSH PRIVILEGES;
```

Nếu đã có user MySQL local riêng, dùng user đó trong `projects/backend/.env` thay vì tạo user `simulator`.

## Khởi động Redis

Redis lưu snapshot bảng giá mới nhất và phân phối cập nhật cho WebSocket. Với
Homebrew trên macOS:

```bash
brew services start redis
redis-cli ping
```

Lệnh cuối phải trả `PONG`. Khi chỉ cần chạy tạm trong terminal hiện tại, có thể
dùng `redis-server` thay cho `brew services start redis`.

## Cài dependencies

```bash
cd projects
npm install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Khởi động ứng dụng

```bash
cd projects
npm run dev
```

Lệnh này khởi động đồng thời backend tại `http://localhost:3000` và frontend tại `http://localhost:5173`.
Nếu một cổng đã được sử dụng, Vite có thể chọn cổng local khác; backend cho phép `localhost` và `127.0.0.1` ở mọi cổng khi chạy development.

## Chạy riêng từng ứng dụng

```bash
cd projects/backend
npm install
npm run dev
```

```bash
cd projects/frontend
npm install
npm run dev
```

Mẫu backend `.env` mặc định trỏ đến MySQL local tại `localhost:3306`, database `securities_simulator` và user `simulator`. Redis mặc định là `redis://localhost:6379`.

## Đồng hồ giả lập

Market Session dùng một Clock riêng thay vì đọc thời gian ở nhiều nơi. Mặc định
backend dùng giờ hệ thống:

```dotenv
SIM_CLOCK_MODE=SYSTEM
```

Để học và kiểm tra ranh giới phiên mà không phải chờ đến giờ thật, cấu hình
Clock cố định rồi khởi động lại backend:

```dotenv
SIM_CLOCK_MODE=FIXED
SIM_NOW=2026-10-20T10:00:00+07:00
```

`SIM_NOW` phải là ISO 8601 có timezone (ví dụ hậu tố `Z` hoặc `+07:00`). Cấu
hình Clock không hợp lệ làm backend báo lỗi rõ ràng ngay khi khởi động.

## Database và Security Master

MySQL server được kiểm tra cho môi trường học tập này là phiên bản `8.0.45`.
Migration của ngày 2 dùng InnoDB, foreign key và `CHECK`, nên cần MySQL 8.0 trở lên.

TypeORM quản lý schema, dữ liệu mẫu và bảng lịch sử `typeorm_migrations`.
Không dùng `synchronize` để thay thế migration. Trên database mới, chạy:

```bash
cd projects/backend
npm run migration:run
```

Xem trạng thái hoặc hoàn tác migration cuối cùng:

```bash
npm run migration:show
npm run migration:revert
```

Nếu trước đó đã chạy hai file SQL của phiên bản ngày 2 cũ trên database local,
hãy kiểm tra schema/dữ liệu rồi baseline chúng một lần để TypeORM chỉ ghi lịch sử
migration mà không chạy lại hoặc xóa dữ liệu:

```bash
npm run migration:run -- --fake
```

Kiểm tra seed:

```sql
SELECT security_type, COUNT(*) AS total
FROM securities
GROUP BY security_type;

SELECT trading_status, COUNT(*) AS total
FROM securities
GROUP BY trading_status;
```

Kết quả kỳ vọng: `STOCK = 3`, `BOND = 1`, `ETF = 1`; tổng `TRADABLE = 4`.

`securities` chỉ chứa thông tin định danh/tham chiếu: mã, loại, thị trường,
tiền tệ và trạng thái giao dịch. Giá khớp, cung/cầu thuộc Market Data; số lượng,
giá vốn và P&L thuộc Portfolio theo từng tài khoản.

## API ngày 1 đến ngày 5

```bash
curl -i http://localhost:3000/health/live
curl -i http://localhost:3000/health/ready
curl -i http://localhost:3000/api/system/overview
curl "http://localhost:3000/api/securities?type=STOCK"
curl "http://localhost:3000/api/securities?status=TRADABLE"
curl "http://localhost:3000/api/securities?marketCode=SIM_EQ_A&symbol=%20simaaa%20"
curl -i http://localhost:3000/api/securities/sec-004
curl "http://localhost:3000/api/market-data/quotes?securityIds=sec-001,sec-003"
curl "http://localhost:3000/api/markets/SIM_EQ_A/session"
curl -X POST http://localhost:3000/api/order-validations/session \
  -H "Content-Type: application/json" \
  -d '{"securityId":"sec-001","side":"BUY","orderType":"ATO","quantity":100}'
curl -X POST http://localhost:3000/api/simulator/orders \
  -H "Content-Type: application/json" \
  -d '{"clientOrderId":"S1","securityId":"sec-001","side":"SELL","orderType":"LO","price":24900,"quantity":40}'
curl http://localhost:3000/api/simulator/order-books/sec-001
curl "http://localhost:3000/api/simulator/executions?securityId=sec-001"
```

- `/health/live`: xác nhận HTTP process hoạt động.
- `/health/ready`: chạy `SELECT 1` với MySQL; trả `503` nếu database không sẵn sàng.
- `/api/system/overview`: metadata tĩnh của simulator, không truy vấn database.
- `GET /api/securities`: danh sách chứng khoán; hỗ trợ filter `type`, `status`,
  `marketCode`, `symbol`, kết hợp bằng `AND`. `symbol` và `marketCode` được
  trim/chuyển hoa; filter hợp lệ không có dữ liệu trả `200` với `data: []`.
- `GET /api/securities/:id`: chi tiết chứng khoán. Trái phiếu trả `bondTerms`
  với `faceValue` dạng chuỗi decimal và ngày `YYYY-MM-DD`; các loại khác trả
  `bondTerms: null`.

Ví dụ `SIMAAA` không kèm thị trường trả hai chứng khoán. Dùng cả
`marketCode=SIM_EQ_A` và `symbol=SIMAAA` để nhận đúng `sec-001`. Chứng khoán
`SUSPENDED` vẫn đọc được, nhưng hàm nghiệp vụ `assertSecurityTradable` sẽ từ
chối nó để OMS dùng ở các ngày sau.

`type=CRYPTO` trả `400` với code `INVALID_SECURITY_FILTER`; ID không tồn tại
trả `404` với code `SECURITY_NOT_FOUND`.

## Market Session và kiểm tra thử lệnh

Ngày 4 chỉ cấu hình lịch cho `SIM_EQ_A`, dùng timezone
`Asia/Ho_Chi_Minh`. Ngày làm việc là thứ Hai đến thứ Sáu; `2026-10-21` là ngày
nghỉ giả lập. Các thị trường `SIM_EQ_B`, `SIM_FUND` và `SIM_BOND` không dùng
nhầm lịch này: chúng trả `422 MARKET_SESSION_NOT_CONFIGURED`.

| Khoảng giờ địa phương | Phiên             | Loại lệnh được nhận |
| --------------------- | ----------------- | ------------------- |
| Trước 09:00           | `PRE_OPEN`        | Không nhận          |
| 09:00–09:15           | `OPENING_AUCTION` | LO, ATO             |
| 09:15–11:30           | `CONTINUOUS`      | LO                  |
| 11:30–13:00           | `BREAK`           | Không nhận          |
| 13:00–14:30           | `CONTINUOUS`      | LO                  |
| 14:30–14:45           | `CLOSING_AUCTION` | LO, ATC             |
| Từ 14:45              | `CLOSED`          | Không nhận          |

Mọi khoảng dùng quy tắc **đầu gồm, cuối không gồm**. Vì vậy ATO lúc
`09:14:59.999+07:00` hợp lệ, còn đúng `09:15:00+07:00` bị từ chối với
`ORDER_TYPE_NOT_ALLOWED_IN_SESSION`; LO tại thời điểm đó hợp lệ.

`GET /api/markets/:marketCode/session` trả phiên, các loại lệnh được nhận,
instant đã đánh giá, thời điểm kết thúc phiên và chế độ Clock. Frontend tự làm
mới trạng thái `SIM_EQ_A` mỗi 5 giây, đồng thời vẫn hiển thị trạng thái kết nối
WebSocket riêng.

`POST /api/order-validations/session` chỉ kiểm tra Security Master, ngày/phiên
và loại lệnh. API lấy `marketCode` từ chứng khoán, không tin dữ liệu client.
Request đúng cấu trúc luôn trả `200`: `valid: false` là kết quả kiểm tra từ
chối, không phải lỗi HTTP. Các reason code là:

- `SECURITY_NOT_TRADABLE`
- `NON_TRADING_DAY`
- `SESSION_NOT_ACCEPTING_ORDERS`
- `ORDER_TYPE_NOT_ALLOWED_IN_SESSION`

Request không đúng cấu trúc trả `400`; LO phải có `price` nguyên dương,
ATO/ATC không được gửi `price`; `quantity` phải là số nguyên dương. Chứng
khoán không tồn tại trả `404 SECURITY_NOT_FOUND`.

## Matching Simulator — sổ lệnh và khớp lệnh

Matching Simulator hiện chỉ hỗ trợ `sec-001 / SIMAAA / SIM_EQ_A`. Chỉ nhận
lệnh giới hạn `LO` trong phiên `CONTINUOUS`; ví dụ dùng Clock cố định lúc
`2026-10-20T10:00:00+07:00` để demo.

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

`B1` tạo hai execution: `40 @ 24.900` với `S1` và `60 @ 25.000` với `S2`.
Tổng giá trị là `2.496.000` VND. `B1` và `S1` ở trạng thái `FILLED`; `S2`
còn 40 ở trạng thái `PARTIALLY_FILLED`; `S3` vẫn là `NEW`.

Engine giữ từng lệnh để bảo toàn ưu tiên nhưng API sổ lệnh trả độ sâu cộng gộp
theo mức giá:

```bash
curl http://localhost:3000/api/simulator/order-books/sec-001
curl "http://localhost:3000/api/simulator/executions?securityId=sec-001"
```

Lệnh mua có giá cao hơn được ưu tiên, lệnh bán có giá thấp hơn được ưu tiên;
cùng giá thì `arrivalSequence` do server cấp xác định FIFO. Khi giá giao nhau,
giá execution lấy theo lệnh đang nằm trong sổ (`maker`), không phải giá giới
hạn của lệnh mới (`taker`). Một lệnh có thể tạo nhiều execution; phần chưa khớp
của LO tiếp tục nằm trong sổ và giữ thứ tự ban đầu.

`POST /api/simulator/orders` trả `201` cùng order đã tiếp nhận và các execution
vừa tạo. Các từ chối xảy ra trước khi thay đổi sổ:

| Điều kiện | HTTP | Mã lỗi |
| --- | ---: | --- |
| Giá, khối lượng, side hoặc body không hợp lệ | 400 | `INVALID_ORDER_INPUT` |
| Loại lệnh không phải LO | 400 | `UNSUPPORTED_ORDER_TYPE` |
| Chứng khoán không tồn tại | 404 | `SECURITY_NOT_FOUND` |
| Chứng khoán không ở trạng thái `TRADABLE` | 422 | `SECURITY_NOT_TRADABLE` |
| Không phải `sec-001` | 422 | `SECURITY_NOT_SUPPORTED` |
| Không trong phiên `CONTINUOUS` | 422 | `MATCHING_SESSION_NOT_SUPPORTED` |
| `clientOrderId` đã dùng trong backend instance hiện tại | 409 | `DUPLICATE_CLIENT_ORDER_ID` |

Sổ lệnh, arrival sequence, client order ID và execution chỉ nằm trong bộ nhớ
của một backend instance. Khởi động lại backend làm mất toàn bộ dữ liệu này;
chưa có persistence, khôi phục sự cố, kiểm tra tiền/chứng khoán khả dụng hoặc
settlement.

## Market Data realtime

Backend có đúng một Price Simulator cho `sec-001 / SIMAAA / SIM_EQ_A`, độc lập
với số tab trình duyệt. Tick đầu được phát khi backend sẵn sàng với Redis, sau
đó cứ 2 giây có một tick. Ba tick đầu là `25.000 × 100`, `25.100 × 200` và
`25.200 × 100`; sau tick thứ ba, `totalVolume = 400` và
`totalValue = 10.040.000`.

Snapshot được lưu trước tại key Redis:

```text
md:quote:<tradingDate>:sec-001
```

Sau đó backend publish snapshot đầy đủ lên channel `md:quotes`. Gateway gửi
envelope sau đến client đã đăng ký đúng `securityId`:

```json
{
  "type": "quote.snapshot",
  "data": { "securityId": "sec-001" }
}
```

`GET /api/market-data/quotes?securityIds=sec-001,sec-003` trả quote hiện có và
`missingQuoteSecurityIds` cho chứng khoán tồn tại nhưng chưa có giá. ID không
tồn tại trả `400 INVALID_SECURITY_IDS`; Redis không khả dụng trả
`503 MARKET_DATA_UNAVAILABLE`.

WebSocket chạy tại `ws://localhost:3000/ws/market-data`. Client gửi:

```json
{ "type": "subscribe", "securityIds": ["sec-001"] }
```

Frontend tự tải Security Master, đăng ký tất cả `securityId`, thay thế snapshot
theo ID và tự reconnect sau khi mất kết nối. Các mã chưa được mô phỏng, gồm
`sec-002` SUSPENDED và `sec-005` có cùng symbol `SIMAAA`, vẫn xuất hiện nhưng
hiển thị `—`.

Giá API được tính bằng VND trên một đơn vị chứng khoán (`VND_PER_UNIT`), không
nhân hoặc chia thêm 1.000 khi hiển thị.

### Đường đi của một tick

1. Price Simulator tính snapshot mới và cập nhật tổng khối lượng/giá trị.
2. `RedisQuoteStore` ghi JSON vào key snapshot.
3. Sau khi ghi thành công, store publish JSON qua `md:quotes`.
4. Redis subscriber của Gateway lọc theo subscription và gửi WebSocket.
5. Vue thay thế quote tại `quotesById[securityId]`; bảng đổi giá mà không reload.

### Giới hạn của Ngày 3

- Không ghi tick hay lịch sử giá vào MySQL.
- Chưa có delta, sequence, replay hoặc khôi phục khoảng trống dữ liệu.
- Redis Pub/Sub không phát lại thông báo đã bỏ lỡ; reconnect nhận lại snapshot mới nhất.
- Tick thị trường không tạo execution hay thay đổi tài sản tài khoản.

### Giới hạn của Ngày 5

- Matching Simulator chưa tích hợp vào Market Data: Price Simulator vẫn tạo tick
  ngẫu nhiên cho `sec-001`, còn execution và thay đổi bid/ask chưa cập nhật Redis
  hoặc WebSocket.
- Matching Simulator chỉ là API thử nghiệm, chưa phải OMS cho lệnh khách hàng.
- Chưa kiểm tra tài khoản, lô, bước giá, biên độ giá hoặc tài sản khả dụng.
- Price Simulator của Ngày 3 chưa bị dừng theo phiên; đây là phần mở rộng cho
  bài tích hợp tiếp theo.

## Kiểm thử và build

```bash
cd projects
npm test
npm run build
```

## Bài debug bắt buộc

Đổi `DB_PORT` trong `projects/backend/.env` sang một cổng không có MySQL rồi khởi động lại backend. Kết quả mong đợi:

- `/health/live` trả `200`.
- `/health/ready` trả `503`.
- `/api/system/overview` trả `200`.

Sau đó khôi phục `DB_PORT=3306` và xác nhận readiness trả lại `200`.
