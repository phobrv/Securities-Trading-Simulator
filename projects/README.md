# Securities Trading Simulator — Ngày 2

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

Mẫu backend `.env` mặc định trỏ đến MySQL local tại `localhost:3306`, database `securities_simulator` và user `simulator`.

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

## API ngày 1 và ngày 2

```bash
curl -i http://localhost:3000/health/live
curl -i http://localhost:3000/health/ready
curl -i http://localhost:3000/api/system/overview
curl "http://localhost:3000/api/securities?type=STOCK"
curl "http://localhost:3000/api/securities?status=TRADABLE"
curl "http://localhost:3000/api/securities?marketCode=SIM_EQ_A&symbol=%20simaaa%20"
curl -i http://localhost:3000/api/securities/sec-004
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
