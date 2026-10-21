# Ngày 1 — Hiểu thị trường và dựng nền móng

## Mục tiêu

Kết nối nghiệp vụ giao dịch với thành phần phần mềm: khi người dùng bấm **Mua**, hệ thống nào tiếp nhận, kiểm tra, khớp lệnh và ghi nhận tài sản?

Cuối buổi cần đạt:

- Giải thích được hành trình từ đặt lệnh đến thanh toán.
- Phác thảo được module chính của simulator.
- Chạy được backend Node.js + TypeScript, có API và kiểm tra kết nối MySQL.

## Phân bổ thời gian

| Thời lượng | Nội dung | Kết quả |
| --- | --- | --- |
| 0–30 phút | Nghiệp vụ thị trường và hành trình giao dịch | Tự giải thích một giao dịch |
| 30–60 phút | Kiến trúc, API, quy ước dữ liệu | Sơ đồ module và API contract |
| 60–90 phút | Khởi tạo backend, kết nối MySQL | API chạy được |
| 90–120 phút | Debug và README | Có bằng chứng kiểm tra, ghi lại giả định |

Nếu chỉ có 90 phút, ưu tiên hoàn thành backend và database.

---

## 1. Nghiệp vụ nền tảng

### Các bên tham gia

| Thành phần | Vai trò | Liên hệ phần mềm |
| --- | --- | --- |
| Nhà đầu tư | Đưa yêu cầu mua/bán | Người dùng Trading UI |
| Công ty chứng khoán | Cung cấp tài khoản, tiếp nhận/kiểm tra lệnh | Accounts, OMS, Risk, Exchange Adapter |
| Sở giao dịch | Tổ chức giao dịch và xử lý lệnh | Hệ thống bên ngoài, được thay bởi simulator |
| VSDC | Đăng ký, lưu ký, bù trừ, thanh toán | Back Office/Settlement mô phỏng |
| Tổ chức phát hành | Phát hành chứng khoán | Security Master |

Simulator chỉ tập trung vào **thị trường thứ cấp**: nhà đầu tư mua/bán lại chứng khoán đã phát hành.

### Bốn khái niệm cần phân biệt

| Khái niệm | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `symbol` | Mã hiển thị của chứng khoán | `AAA` |
| `order` | Yêu cầu mua/bán | Mua 100 cổ phiếu, giá giới hạn 25.000 |
| `execution` | Một lần khớp cụ thể | Khớp 40 cổ phiếu tại 24.900 |
| `settlement` | Thực hiện nghĩa vụ tiền/chứng khoán từ giao dịch | Theo dõi tiền phải trả và chứng khoán phải nhận |

Một lệnh có thể không khớp, khớp một phần hoặc có nhiều lần khớp; vì vậy `orders` và `executions` phải là hai thực thể tách biệt.

### Ví dụ giao dịch

Giả định tài khoản có 10.000.000 VND, đặt mua 100 cổ phiếu `AAA`, lệnh LO giá 25.000 VND/cổ phiếu, không có phí/thuế và khớp toàn bộ tại 24.900 VND.

1. **Gửi yêu cầu:** kiểm tra quyền tài khoản, trạng thái tài khoản, chứng khoán, phiên, giá, khối lượng và tài sản khả dụng.
2. **Giữ tiền:** `100 × 25.000 = 2.500.000` VND; tiền khả dụng còn `7.500.000` VND.
3. **Nhận khớp:** giá trị thực tế `100 × 24.900 = 2.490.000` VND; giải phóng phần giữ dư `10.000` VND.
4. **Thanh toán:** ghi nhận nghĩa vụ tiền và chứng khoán. Chứng khoán mua có thể đang chờ thanh toán, chưa mặc định là có thể bán.

> “Đã nhận lệnh” khác “đã khớp”: nhận lệnh chỉ xác nhận OMS chấp nhận yêu cầu; khớp là kết quả từ thị trường/matching engine. Lệnh đã khớp vẫn cần theo dõi nghĩa vụ thanh toán.

---

## 2. Thiết kế kỹ thuật

### Module dự kiến

| Module | Trách nhiệm | Ngày học trọng tâm |
| --- | --- | --- |
| `SecurityMaster` | Thông tin chứng khoán | 2 |
| `MarketData` | Snapshot giá, realtime | 3, 17 |
| `MarketSession` | Lịch và trạng thái phiên | 4 |
| `MatchingSimulator` | Sổ lệnh và khớp lệnh | 5, 25 |
| `Accounts` | Tiền, chứng khoán, khoản giữ | 6, 10 |
| `OMS` | Vòng đời lệnh | 8, 9 |
| `Risk` | Kiểm tra điều kiện giao dịch | 12, 24 |
| `Portfolio` | Vị thế, giá vốn, P&L | 11 |
| `Settlement` | Nghĩa vụ và thanh toán | 13 |

Ngày 1 chỉ triển khai module `System` để kiểm tra nền móng ứng dụng.

### Quy ước dữ liệu

- Giá và tiền: số nguyên VND; ví dụ giá `25000`, tiền `2500000`.
- Khối lượng: số nguyên.
- Thời điểm API: ISO 8601 có timezone, sử dụng UTC khi lưu/truyền.
- Hiển thị thời gian: `Asia/Ho_Chi_Minh`.
- Dùng ID nội bộ ổn định như `sec-001`; không dùng `symbol` làm khóa bất biến.

### API ngày 1

| API | Mục đích | Kết quả thành công |
| --- | --- | --- |
| `GET /health/live` | Kiểm tra HTTP process phản hồi | HTTP 200 |
| `GET /health/ready` | Kiểm tra kết nối MySQL bằng `SELECT 1` | HTTP 200 |
| `GET /api/system/overview` | Cung cấp metadata và quy ước simulator | HTTP 200 |

Ví dụ `GET /api/system/overview`:

```json
{
  "name": "Securities Trading Simulator",
  "mode": "SIMULATION",
  "conventions": {
    "currency": "VND",
    "priceUnit": "VND_PER_SHARE",
    "timestampFormat": "ISO_8601",
    "displayTimeZone": "Asia/Ho_Chi_Minh"
  },
  "modules": [
    { "name": "System", "status": "IMPLEMENTED" },
    { "name": "SecurityMaster", "status": "PLANNED" },
    { "name": "MarketData", "status": "PLANNED" },
    { "name": "OMS", "status": "PLANNED" }
  ]
}
```

`/health/live` chỉ chứng minh HTTP handler còn chạy. `/health/ready` phải thực sự truy vấn database, trả `503` khi database lỗi hoặc hết thời gian chờ:

```json
{
  "status": "NOT_READY",
  "checks": { "database": "DOWN" }
}
```

Không đưa chi tiết kết nối hoặc thông tin nhạy cảm vào response; chỉ ghi chúng trong log backend phù hợp.

---

## 3. Thực hành

### Cấu trúc tối thiểu

Nếu project chưa có cấu trúc, có thể bắt đầu như sau:

```text
securities-trading-simulator/
  backend/
    src/
      app.ts
      server.ts
      infrastructure/database.ts
      modules/system/system.routes.ts
      modules/system/system.service.ts
    .env.example
    package.json
    tsconfig.json
  README.md
```

- `app.ts`: cấu hình HTTP và đăng ký route.
- `server.ts`: khởi động/shutdown server.
- `database.ts`: quản lý MySQL connection pool.
- `system.routes.ts`: chuyển request thành HTTP response.
- `system.service.ts`: readiness check và metadata.

### Cấu hình môi trường

```dotenv
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=securities_simulator
DB_USER=simulator
DB_PASSWORD=your_local_password
```

Tạo `.env` cục bộ từ mẫu và đưa `.env` vào `.gitignore`. Dùng `mysql2` nếu project chưa có MySQL driver. Chưa cần tạo bảng nghiệp vụ trong ngày 1.

### Logic readiness

```text
GET /health/live
  → trả 200 nếu HTTP handler hoạt động.

GET /health/ready
  → lấy connection từ pool và chạy SELECT 1.
  → trả 200 nếu thành công.
  → trả 503 nếu lỗi hoặc timeout.

GET /api/system/overview
  → trả metadata; không phụ thuộc database.
```

Đóng connection pool khi ứng dụng shutdown để tránh kết nối treo.

### Kiểm tra thủ công

```bash
curl -i http://localhost:3000/health/live
curl -i http://localhost:3000/health/ready
curl -i http://localhost:3000/api/system/overview
```

Khi MySQL hoạt động, cả ba endpoint đều trả `200`; endpoint readiness xác nhận database truy cập được.

---

## 4. Bài debug bắt buộc

Đổi `DB_PORT` sang cổng không có MySQL, khởi động lại backend rồi dự đoán và xác nhận:

| Endpoint | Kết quả mong đợi |
| --- | --- |
| `/health/live` | `200` nếu HTTP server vẫn chạy |
| `/health/ready` | `503` |
| `/api/system/overview` | `200` vì metadata không cần database |

Nếu readiness vẫn trả `200`, kiểm tra route có gọi database thật hay không, truy vấn đã `await` chưa, xử lý `catch`, cấu hình mới đã nạp và timeout có hữu hạn không. Sau đó khôi phục cấu hình, xác nhận readiness trả lại `200`.

## 5. Bài tập tính tiền

Tài khoản có 10.000.000 VND, đặt mua 100 cổ phiếu giá giới hạn 25.000. Lệnh khớp 40 cổ phiếu tại 24.900; 60 cổ phiếu còn lại chờ khớp, không phí/thuế.

<details>
<summary>Đáp án đối chiếu</summary>

| Khoản mục | Cách tính | Kết quả |
| --- | --- | ---: |
| Giữ ban đầu | `100 × 25.000` | 2.500.000 VND |
| Nghĩa vụ phần đã khớp | `40 × 24.900` | 996.000 VND |
| Giữ cho phần còn lại | `60 × 25.000` | 1.500.000 VND |
| Giải phóng do chênh giá | `40 × (25.000 − 24.900)` | 4.000 VND |
| Tiền khả dụng | `10.000.000 − 996.000 − 1.500.000` | 7.504.000 VND |

Kiểm tra bảo toàn: `7.504.000 + 1.500.000 + 996.000 = 10.000.000` VND.

</details>

## 6. Checklist hoàn thành

- [ ] Phân biệt được lệnh, lần khớp và thanh toán.
- [ ] Giải thích được vì sao phải giữ tài sản cho lệnh.
- [ ] Chỉ ra trách nhiệm của OMS, Risk, Accounts và Matching Simulator.
- [ ] Chạy được ba API ngày 1.
- [ ] Chứng minh readiness đổi từ `200` sang `503` khi MySQL không sẵn sàng.
- [ ] Tự tính đúng ví dụ khớp một phần.

Ngày 2 sẽ xây Security Master để cung cấp danh mục chứng khoán cho bảng giá và luồng đặt lệnh.
