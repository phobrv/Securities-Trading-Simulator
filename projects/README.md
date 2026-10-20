# Securities Trading Simulator — Ngày 1

Nền móng của ứng dụng mô phỏng giao dịch chứng khoán. Dự án chỉ phục vụ mục đích học tập, không dùng cho giao dịch thực tế.

## Cấu trúc

- `backend/`: Node.js, TypeScript, Express và MySQL.
- `frontend/`: Vue 3, TypeScript, Vite và Tailwind CSS.
- `docker-compose.yml`: MySQL 8.4 cho môi trường local.

## Yêu cầu

- Node.js 20 trở lên.
- npm.
- Docker Desktop hoặc Docker Engine có Docker Compose.

## Khởi động MySQL

```bash
cd projects
cp .env.example .env
docker compose up -d mysql
docker compose ps
```

Chờ đến khi service `mysql` ở trạng thái healthy trước khi chạy backend.

## Khởi động backend

```bash
cd projects/backend
cp .env.example .env
npm install
npm run dev
```

API mặc định chạy tại `http://localhost:3000`.

## Khởi động frontend

```bash
cd projects/frontend
cp .env.example .env
npm install
npm run dev
```

Giao diện mặc định chạy tại `http://localhost:5173`.

## API ngày 1

```bash
curl -i http://localhost:3000/health/live
curl -i http://localhost:3000/health/ready
curl -i http://localhost:3000/api/system/overview
```

- `/health/live`: xác nhận HTTP process hoạt động.
- `/health/ready`: chạy `SELECT 1` với MySQL; trả `503` nếu database không sẵn sàng.
- `/api/system/overview`: metadata tĩnh của simulator, không truy vấn database.

## Kiểm thử và build

```bash
cd projects/backend
npm test
npm run build

cd ../frontend
npm run build
```

## Bài debug bắt buộc

Đổi `DB_PORT` trong `projects/backend/.env` sang một cổng không có MySQL rồi khởi động lại backend. Kết quả mong đợi:

- `/health/live` trả `200`.
- `/health/ready` trả `503`.
- `/api/system/overview` trả `200`.

Sau đó khôi phục `DB_PORT=3306` và xác nhận readiness trả lại `200`.
