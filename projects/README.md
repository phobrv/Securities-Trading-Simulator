# Securities Trading Simulator

Ứng dụng mô phỏng giao dịch chứng khoán phục vụ học tập; không dùng cho giao dịch thực tế. Phần triển khai được ghi theo từng ngày trong [`docs/`](./docs/), để README này chỉ giữ hướng dẫn dùng chung.

## Cấu trúc

- `backend/`: Node.js, TypeScript, Express, MySQL, Redis và WebSocket.
- `frontend/`: Vue 3, TypeScript, Vite và Tailwind CSS.
- [`docs/`](./docs/): chi tiết triển khai, API, fixture và giới hạn theo ngày.

## Tài liệu triển khai

| Ngày                                                           | Nội dung                                    |
| -------------------------------------------------------------- | ------------------------------------------- |
| [Ngày 2](./docs/ngay-02-security-master.md)                    | Security Master và migration MySQL          |
| [Ngày 3](./docs/ngay-03-market-data-realtime.md)               | Market Data realtime, Redis và WebSocket    |
| [Ngày 4](./docs/ngay-04-market-session.md)                     | Market Session và kiểm tra phiên lệnh       |
| [Ngày 5](./docs/ngay-05-matching-simulator.md)                 | Sổ lệnh và Matching Simulator trong bộ nhớ  |
| [Ngày 6](./docs/ngay-06-tai-khoan-va-tai-san-kha-dung.md)      | Accounts, tiền và chứng khoán khả dụng      |
| [Ngày 7](./docs/ngay-07-demo-tuan-1.md)                        | Demo tuần 1: bảng giá và matching simulator |
| [Ngày 8](./docs/ngay-08-oms-va-vong-doi-lenh.md)               | OMS demo, vòng đời lệnh và timeline         |
| [Ngày 9](./docs/ngay-09-api-dat-lenh-idempotency.md)           | API đặt lệnh, yêu cầu hủy và idempotency    |
| [Ngày 10](./docs/ngay-10-giu-tien-va-so-cai-tien.md)           | Giữ tiền, reservation và sổ cái tiền        |
| [Ngày 11](./docs/ngay-11-danh-muc-gia-von-va-lai-lo.md)        | Danh mục, giá vốn bình quân và lãi/lỗ       |
| [Ngày 12](./docs/ngay-12-margin-tai-san-bao-dam-va-suc-mua.md) | Mô phỏng margin và sức mua                  |

Xem [chỉ mục tài liệu](./docs/README.md) để biết quy ước cập nhật cho các ngày tiếp theo.

## Giữ tiền và sổ cái (Ngày 10)

Sau `npm run migration:run --prefix backend`, fixture `acc-003` có 10.000.000 VND và ledger `OPENING`. Bật `OMS_DEMO_ENABLED=true` trong môi trường local/demo để dùng API đặt lệnh và simulate. Luồng `POST /api/orders` hiện chỉ nhận BUY LO `sec-001` trên tài khoản có ledger và số dư đối chiếu đầy đủ; `acc-001`/`acc-002` vẫn đọc được và dùng được với OMS demo cũ, nhưng không được đặt qua API mới. OMS demo không được tạo trực tiếp lệnh cho tài khoản đã có `OPENING`.

- `POST /api/orders` với `Idempotency-Key`: tạo lệnh và giữ tiền nguyên tử.
- `POST /api/oms-demo/orders/:id/simulate`: mô phỏng `OrderAccepted`, `ExecutionReceived`, `CancelConfirmed`, `OrderRejected` hoặc `CancelRejected`.
- `POST /api/orders/:id/cancel`: yêu cầu hủy, chưa giải phóng tiền.
- `GET /api/accounts/:id/balances`, `GET /api/orders/:id/cash-reservation`, `GET /api/accounts/:id/cash-ledger`: đọc số dư, khoản giữ và lịch sử.

Ví dụ dùng BUY 100 @25000, simulate accepted, execution 40 @24900, yêu cầu hủy rồi simulate cancel confirmed: `settledCash=10000000`, `reservedCash=0`, `buyPayable=996000`, `availableCash=9004000`. Execution chuyển tiền giữ sang nghĩa vụ mua, **không giảm `settledCash`**: nếu giảm đồng thời `settledCash` và tăng `buyPayable`, tiền khả dụng bị trừ hai lần. Tiền và ledger delta trả dưới dạng chuỗi; ledger chỉ là lịch sử biến động, chưa phải kế toán kép. Từ ngày 11, BUY có reservation còn cập nhật positions; chưa có settlement hay nối matching.

Khi replay cùng execution, API trả trạng thái lệnh hiện tại mà không ghi lại; cùng ID nhưng nội dung khác trả 409. Không sửa hoặc xóa ledger để điều chỉnh số dư. Migration ledger không hỗ trợ tự động revert vì có thể xóa lịch sử tài chính; MySQL DDL có implicit commit, nếu migration schema lỗi giữa chừng cần kiểm tra thủ công trước khi chạy lại.

Test MySQL ngày 10 dùng database test riêng đã migrate: `DB_NAME=<database_test> CASH_MYSQL_TEST=true npm test -- --runTestsByPath tests/cash/cash.mysql.test.ts` từ `projects/backend/`.

## Yêu cầu

- Node.js 20 trở lên và npm.
- MySQL 8.0 trở lên, cài trực tiếp trên máy.
- Redis 7 trở lên, cài trực tiếp trên máy.

## Khởi động MySQL và Redis

Với Homebrew trên macOS:

```bash
brew services start mysql
brew services start redis
redis-cli ping
```

`redis-cli ping` phải trả `PONG`. Tạo database và user local nếu chưa có:

```sql
CREATE DATABASE IF NOT EXISTS securities_simulator
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'simulator'@'localhost'
  IDENTIFIED BY 'simulator_local_password';

GRANT ALL PRIVILEGES ON securities_simulator.* TO 'simulator'@'localhost';
FLUSH PRIVILEGES;
```

## Cài đặt và chạy

```bash
cd projects
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

npm run migration:run --prefix backend
npm run dev
```

Backend chạy tại `http://localhost:3000`; frontend chạy tại `http://localhost:5173`. Mẫu backend `.env` dùng MySQL `localhost:3306`, database `securities_simulator`, user `simulator` và Redis `redis://localhost:6379`.

## Demo tuần 1

Demo dùng thời gian cố định để phiên `CONTINUOUS` và ngày snapshot Redis nhất quán. Trong `backend/.env`, đặt:

```dotenv
SIM_CLOCK_MODE=FIXED
SIM_NOW=2026-10-20T10:00:00+07:00
MARKET_DATA_TRADING_DATE=2026-10-20
```

Sau migration, khởi động MySQL, Redis và backend. Mỗi lần backend khởi động, simulator trong bộ nhớ và snapshot Redis riêng của `sec-001` trong ngày demo được khởi tạo lại; không xóa dữ liệu MySQL hay các key Redis khác.

Ở terminal khác, chạy kịch bản chuẩn một lần:

```bash
cd projects/backend
npm run demo:week-one
```

Script dừng nếu sổ/executions không rỗng để tránh chạy chồng fixture. Kết quả mong đợi là hai execution `40 @ 24.900` và `60 @ 25.000`; quote có `totalVolume=100`, `totalValue=2496000`, `lastQuantity=60` và best ask `25.000 × 40`.

Dashboard chỉ đọc REST/WebSocket nên reload hay mở tab mới không phát lệnh. Nó hiển thị rõ dữ liệu mô phỏng; số dư tài khoản fixture chưa được cập nhật từ matching.

### Giới hạn demo

- Sổ lệnh và executions chỉ ở bộ nhớ, mất khi backend khởi động lại.
- Chưa giữ tài sản khi đặt lệnh, chưa settlement và chưa cập nhật số dư từ execution.
- Chưa có outbox, replay hoặc cơ chế khôi phục khi matching đã xử lý nhưng Redis không ghi được snapshot.

Chạy riêng từng ứng dụng:

```bash
cd projects/backend && npm run dev
cd projects/frontend && npm run dev
```

## Migration và kiểm tra chung

TypeORM quản lý schema, fixture và bảng lịch sử `typeorm_migrations`; không dùng `synchronize`. MySQL server đã kiểm tra cho môi trường này là `8.0.40`.

```bash
cd projects/backend
npm run migration:show
npm run migration:run
npm run migration:revert
```

Endpoint chung:

```bash
curl -i http://localhost:3000/health/live
curl -i http://localhost:3000/health/ready
curl -i http://localhost:3000/api/system/overview
```

`/health/live` chỉ xác nhận HTTP process; `/health/ready` chạy `SELECT 1` với MySQL và trả `503` khi database không sẵn sàng.

## Kiểm thử và build

```bash
cd projects
npm test
npm run build
```

## Bài debug chung

Đổi `DB_PORT` trong `backend/.env` sang một cổng không có MySQL rồi khởi động lại backend. Kỳ vọng: `/health/live` trả `200`, `/health/ready` trả `503`, còn `/api/system/overview` vẫn trả `200`. Khôi phục `DB_PORT=3306` để readiness trở lại `200`.
