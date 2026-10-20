# Securities Trading Simulator — Ngày 1

Nền móng của ứng dụng mô phỏng giao dịch chứng khoán. Dự án chỉ phục vụ mục đích học tập, không dùng cho giao dịch thực tế.

## Cấu trúc

- `backend/`: Node.js, TypeScript, Express và MySQL.
- `frontend/`: Vue 3, TypeScript, Vite và Tailwind CSS.

## Yêu cầu

- Node.js 20 trở lên.
- npm.
- MySQL 8.0 trở lên, cài trực tiếp trên máy.

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

Mẫu backend `.env` mặc định trỏ đến MySQL local tại `localhost:3306`, database `securities_simulator` và user `simulator`.

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
