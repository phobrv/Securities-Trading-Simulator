# Ngày 12 — Mô phỏng margin

Chạy `npm run migration:run --prefix backend` từ `projects/` để tạo bốn bảng `margin_policies`, `collateral_eligibility`, `margin_scenarios`, `loan_balances` và seed A, B, A-debt. Các bảng hoàn toàn độc lập với tài khoản và khoản vay thật. Migration dùng MySQL DDL có implicit commit; nếu lỗi giữa chừng, kiểm tra schema trước khi chạy lại. Revert xóa dữ liệu mô phỏng ngày 12.

## API

`POST /api/risk/margin-simulations`:

```json
{
  "scenarioId": "scenario-A",
  "order": {
    "securityId": "sec-001",
    "side": "BUY",
    "price": 25000,
    "quantity": 200
  }
}
```

Response `data` gồm `SIMULATION_ONLY`, policy/version, `evaluatedAt`, `pricingMode=SCENARIO_INPUT`, các tổng tiền dạng chuỗi, breakdown từng mã, decision và reason codes. `ALLOW` chỉ đạt kiểm tra margin giả lập, không xác nhận các điều kiện đặt lệnh khác. Scenario không tồn tại trả 404; request không hợp lệ trả 400. Thiếu cấu hình, giá định giá hoặc lượng bảo đảm không hợp lệ trả `UNAVAILABLE`, các tổng chưa xác định là `null`.

## Policy và công thức

Giá thị trường lấy từ scenario, **không phải realtime**, khác giá vốn của Portfolio. Giá bảo đảm là min(giá thị trường, giá chặn); sec-001 cap 24.000, tỷ lệ bảo đảm 5.000 bps, tỷ lệ tài trợ mua 5.000 bps. sec-003 không đủ điều kiện theo fixture, không phải kết luận chung về ETF. Chỉ tính lượng đã thanh toán trừ bán chờ giao, giữ bán và phong tỏa; không tính mua chờ nhận hay tài sản dự kiến mua.

Năng lực từng mã = floor(lượng × giá định giá × tỷ lệ bảo đảm / 10.000). Tổng năng lực bị chặn bởi hạn mức tài khoản; nghĩa vụ = nợ gốc + lãi + hạn mức vay đã giữ. Hạn mức còn lại = max(0, giới hạn hiệu lực − nghĩa vụ). Giá trị lệnh = giá × lượng; vay cần thiết = max(0, giá trị lệnh − tiền khả dụng); giới hạn tài trợ lệnh = floor(giá trị lệnh × tỷ lệ tài trợ / 10.000). Hai tỷ lệ có ý nghĩa khác nhau. Phép tính dùng bigint, làm tròn xuống từng mã; phí và thuế bằng 0.

A có năng lực 12 triệu, B 0; A-debt còn 6,9 triệu. BUY 200 @25.000 cần vay 2 triệu, giới hạn tài trợ 2,5 triệu: A đạt, B không đạt. Với tiền mặt 3 triệu, hạn mức 12 triệu không đồng nghĩa mua được 15 triệu: lệnh 15 triệu cần vay 12 triệu, vượt giới hạn 7,5 triệu. Với tỷ lệ 50%, ngân sách ước tính tối đa là 6 triệu (không tính tài sản mới).

Giao diện so sánh A/B/A-debt chạy độc lập, không nối nút đặt lệnh. Không giải ngân, thay đổi tiền, reservation, order hoặc gọi margin/bán giải chấp; không biến tài khoản CASH thành margin.

## Kiểm thử

Backend: `npm test` và `npm run build`; frontend: `npm run build`. Test MySQL tùy chọn cần database test riêng đã migrate và không có ghi đồng thời: `DB_NAME=<database_test> MARGIN_MYSQL_TEST=true npm test -- --runTestsByPath tests/risk/margin.mysql.test.ts` từ `projects/backend/`.
