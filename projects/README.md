# Securities Trading Simulator

Ứng dụng mô phỏng giao dịch chứng khoán phục vụ học tập; không dùng cho giao dịch thực tế. Phần triển khai được ghi theo từng ngày trong [`docs/`](./docs/), để README này chỉ giữ hướng dẫn dùng chung.

## Cấu trúc

- `backend/`: Node.js, TypeScript, Express, MySQL, Redis và WebSocket.
- `frontend/`: Vue 3, TypeScript, Vite và Tailwind CSS.
- [`docs/`](./docs/): chi tiết triển khai, API, fixture và giới hạn theo ngày.

## Tài liệu triển khai

| Ngày | Nội dung |
| --- | --- |
| [Ngày 2](./docs/ngay-02-security-master.md) | Security Master và migration MySQL |
| [Ngày 3](./docs/ngay-03-market-data-realtime.md) | Market Data realtime, Redis và WebSocket |
| [Ngày 4](./docs/ngay-04-market-session.md) | Market Session và kiểm tra phiên lệnh |
| [Ngày 5](./docs/ngay-05-matching-simulator.md) | Sổ lệnh và Matching Simulator trong bộ nhớ |
| [Ngày 6](./docs/ngay-06-tai-khoan-va-tai-san-kha-dung.md) | Accounts, tiền và chứng khoán khả dụng |

Xem [chỉ mục tài liệu](./docs/README.md) để biết quy ước cập nhật cho các ngày tiếp theo.

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

npm run migration:run
npm run dev
```

Backend chạy tại `http://localhost:3000`; frontend chạy tại `http://localhost:5173`. Mẫu backend `.env` dùng MySQL `localhost:3306`, database `securities_simulator`, user `simulator` và Redis `redis://localhost:6379`.

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
