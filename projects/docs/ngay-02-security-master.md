# Ngày 2 — Security Master

## Phạm vi

Security Master lưu thông tin định danh/tham chiếu của chứng khoán: mã, loại, thị trường, tiền tệ và trạng thái giao dịch. Giá khớp/cung cầu thuộc Market Data; giá vốn và P&L thuộc Portfolio.

Migration tạo `securities` và `bond_terms` bằng InnoDB, foreign key và `CHECK`; TypeORM quản lý lịch sử trong `typeorm_migrations`. Database mới chạy:

```bash
cd projects/backend
npm run migration:run
```

Nếu database local đã được tạo bằng SQL Ngày 2 cũ, kiểm tra dữ liệu trước rồi chỉ baseline migration khi phù hợp:

```bash
npm run migration:run -- --fake
```

## Fixture

| Loại | Số lượng |
| --- | ---: |
| `STOCK` | 3 |
| `BOND` | 1 |
| `ETF` | 1 |
| Tổng `TRADABLE` | 4 |

`sec-001` là `SIMAAA` tại `SIM_EQ_A`; `sec-005` cũng có symbol `SIMAAA` nhưng ở `SIM_EQ_B`. Luôn dùng `securityId` hoặc cặp `marketCode` + `symbol` để phân biệt.

## API

```bash
curl "http://localhost:3000/api/securities?type=STOCK"
curl "http://localhost:3000/api/securities?status=TRADABLE"
curl "http://localhost:3000/api/securities?marketCode=SIM_EQ_A&symbol=%20simaaa%20"
curl -i http://localhost:3000/api/securities/sec-004
```

- `GET /api/securities` hỗ trợ filter `type`, `status`, `marketCode`, `symbol`, kết hợp bằng `AND`.
- `symbol` và `marketCode` được trim/chuyển hoa; filter hợp lệ không có dữ liệu trả `200` với `data: []`.
- `GET /api/securities/:id` trả `bondTerms` cho trái phiếu, các loại khác trả `bondTerms: null`.
- `type=CRYPTO` trả `400 INVALID_SECURITY_FILTER`; ID không tồn tại trả `404 SECURITY_NOT_FOUND`.

Security `SUSPENDED` vẫn đọc được. Các module nghiệp vụ dùng `assertSecurityTradable` để từ chối giao dịch với security không ở trạng thái `TRADABLE`.
