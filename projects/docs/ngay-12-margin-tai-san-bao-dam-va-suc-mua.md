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

## Cấu trúc code

| Thành phần       | Tệp trong `projects/`                                                                                       | Vai trò                                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration        | `backend/src/database/migrations/1792800009000-create-margin-simulation.ts`                                 | Tạo schema và dữ liệu mô phỏng; đăng ký trong `backend/src/infrastructure/typeorm-data-source.ts`.                                                                |
| Kiểu dữ liệu     | `backend/src/modules/risk/margin.types.ts`                                                                  | Định nghĩa scenario, policy, lệnh, reason code và interface repository.                                                                                           |
| Repository       | `backend/src/modules/risk/margin-policy.repository.ts`                                                      | Đọc scenario, dư nợ và cấu hình theo policy/security từ MySQL.                                                                                                    |
| Calculator       | `backend/src/modules/risk/margin.calculator.ts`                                                             | Tính breakdown, hạn mức và quyết định từ input, không truy cập database hay API giá.                                                                              |
| Service và route | `backend/src/modules/risk/risk-check.service.ts`, `risk.routes.ts`                                          | Tải scenario, gọi calculator, validate request và trả kết quả HTTP. Service được khởi tạo tại `backend/src/server.ts`, route được gắn trong `backend/src/app.ts`. |
| Giao diện        | `frontend/src/features/risk/MarginComparison.vue`, `margin.types.ts`, `frontend/src/services/margin-api.ts` | Gọi API và so sánh A/B/A-debt; panel được gắn trong `frontend/src/App.vue`.                                                                                       |
| Kiểm thử         | `backend/tests/risk/margin.test.ts`, `margin.mysql.test.ts`                                                 | Calculator, HTTP với fake repository và kiểm thử MySQL opt-in.                                                                                                    |

## Dữ liệu mô phỏng

| Bảng                     | Nội dung                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `margin_policies`        | Code, version, trạng thái và quy tắc làm tròn `FLOOR_PER_SECURITY`; duy nhất theo code/version.                        |
| `collateral_eligibility` | Cấu hình riêng cho từng cặp policy/security: tính đủ điều kiện bảo đảm, price cap, tỷ lệ bảo đảm và tỷ lệ tài trợ mua. |
| `margin_scenarios`       | Policy, tiền khả dụng và hạn mức tài khoản mô phỏng, cùng positions JSON và giá đầu vào.                               |
| `loan_balances`          | Nợ gốc, lãi và hạn mức vay đã giữ, liên kết với scenario chứ không phải tài khoản thực.                                |

Các trường tiền trong bảng dùng `DECIMAL(20,0)` và có ràng buộc không âm. Tỷ lệ bảo đảm từ 0 đến 10.000 bps; tỷ lệ tài trợ mua từ 0 đến dưới 10.000 bps. Repository chỉ nạp eligibility khi policy đang `ACTIVE` và có quy tắc `FLOOR_PER_SECURITY`; policy không dùng được dẫn đến `POLICY_NOT_CONFIGURED` khi tính.

| Scenario          | Position và giá scenario                  | Tiền khả dụng |    Hạn mức | Nợ gốc / lãi / giữ vay          |
| ----------------- | ----------------------------------------- | ------------: | ---------: | ------------------------------- |
| `scenario-A`      | 1.000 `sec-001` đã thanh toán, giá 25.000 |     3.000.000 | 20.000.000 | 0 / 0 / 0                       |
| `scenario-B`      | 1.000 `sec-003` đã thanh toán, giá 25.000 |     3.000.000 | 20.000.000 | 0 / 0 / 0                       |
| `scenario-A-debt` | Như A                                     |     3.000.000 | 20.000.000 | 4.000.000 / 100.000 / 1.000.000 |

`reservedLoanAmount` chỉ là phần hạn mức vay giả lập đã giữ, không phải cash reservation ngày 10. Positions được đọc từ JSON của scenario, không lấy từ position hay tài khoản ngày 6–11. Giá và quantity của scenario không được API này sửa.

## Hợp đồng API và reason code

Request chỉ nhận lệnh `BUY`; `price` và `quantity` phải là số nguyên dương an toàn của JavaScript. `scenarioId` và `securityId` phải là chuỗi không rỗng, tối đa 36 ký tự. Ví dụ response cho request A ở trên, với `evaluatedAt` minh họa:

```json
{
  "data": {
    "mode": "SIMULATION_ONLY",
    "policyCode": "SIM_MARGIN_V1",
    "policyVersion": 1,
    "evaluatedAt": "2026-10-20T03:00:00.000Z",
    "pricingMode": "SCENARIO_INPUT",
    "currency": "VND",
    "availableCash": "3000000",
    "grossLoanCapacity": "12000000",
    "accountCreditLimit": "20000000",
    "effectiveLoanLimit": "12000000",
    "currentExposure": "0",
    "additionalLoanHeadroom": "12000000",
    "orderValue": "5000000",
    "requiredLoan": "2000000",
    "orderFinancingLimit": "2500000",
    "decision": "ALLOW",
    "reasonCodes": [],
    "collateralBreakdown": [
      {
        "securityId": "sec-001",
        "eligible": true,
        "collateralQuantity": 1000,
        "marketPrice": "25000",
        "valuationPrice": "24000",
        "recognizedAssetValue": "24000000",
        "collateralRateBps": 5000,
        "loanCapacity": "12000000"
      }
    ]
  }
}
```

`evaluatedAt` lấy từ đồng hồ simulator đã cấu hình, không phải timestamp của giá thị trường. Các trường tiền được trả dạng chuỗi để không mất độ chính xác; lượng và bps là số nguyên. Giá trị không xác định có thể là `null`; ví dụ khi thiếu giá hoặc policy, tổng năng lực, giới hạn hiệu lực và headroom là `null`, trong khi các giá trị vẫn tính được như `currentExposure` hoặc `orderValue` vẫn được trả. `orderFinancingLimit` là `null` nếu thiếu policy hợp lệ của mã mua.

| Reason code                       | Ý nghĩa                                                             |
| --------------------------------- | ------------------------------------------------------------------- |
| `INSUFFICIENT_LOAN_HEADROOM`      | Vay cần thiết vượt hạn mức vay bổ sung.                             |
| `ORDER_FINANCING_RATIO_EXCEEDED`  | Vay cần thiết vượt giới hạn tài trợ của lệnh.                       |
| `SECURITY_NOT_FINANCEABLE`        | Lệnh cần vay nhưng mã mua không được tài trợ.                       |
| `EXISTING_EXPOSURE_EXCEEDS_LIMIT` | Nợ, lãi và phần giữ vay hiện tại vượt giới hạn hiệu lực.            |
| `POLICY_NOT_CONFIGURED`           | Thiếu hoặc không dùng được cấu hình policy cho mã mua hay position. |
| `MISSING_VALUATION_PRICE`         | Position đủ điều kiện bảo đảm thiếu giá đầu vào hợp lệ.             |
| `INVALID_COLLATERAL_QUANTITY`     | Thành phần lượng không hợp lệ hoặc lượng bảo đảm sau khi trừ bị âm. |

Một quyết định có thể có nhiều reason code. Thiếu policy của mã mua vẫn trả `UNAVAILABLE` ngay cả khi lệnh không cần vay; với policy hợp lệ, không cần vay thì mã mua không bắt buộc được tài trợ. Position được policy xác định là không đủ điều kiện có năng lực bằng 0, không bắt buộc có giá định giá.

## Chạy thử và đối chiếu

Cấu hình môi trường theo [`../README.md`](../README.md), sau đó từ `projects/backend/` kiểm tra và chạy migration, rồi khởi động backend:

```bash
npm run migration:show
npm run migration:run
npm run dev
```

Ở terminal khác, có thể gọi lại API nhiều lần mà không tạo order hoặc reservation:

```bash
curl -X POST http://localhost:3000/api/risk/margin-simulations \
  -H 'Content-Type: application/json' \
  -d '{"scenarioId":"scenario-A","order":{"securityId":"sec-001","side":"BUY","price":25000,"quantity":200}}'
```

Thay `scenario-A` bằng `scenario-B` hoặc `scenario-A-debt` để đối chiếu; thay `quantity` bằng `300` để thấy A bị `ORDER_FINANCING_RATIO_EXCEEDED` dù còn headroom. Khởi động frontend theo README và tìm panel **Ngày 12 · Mô phỏng margin**: panel tự chạy ba scenario, cho đổi giá và số lượng của lệnh BUY `sec-001`, hiển thị bảng bảo đảm, kiểm tra vốn và reason code. Panel có trạng thái tải/lỗi và không gửi lệnh tới OMS.

## Kết quả kiểm tra và giới hạn

Lần kiểm tra khi triển khai: backend **103 test đạt, 23 test bỏ qua**, backend và frontend build thành công. Test mặc định dùng fake repository; kiểm thử MySQL opt-in và migration chưa được chạy trong lần kiểm tra đó, nên chưa kết luận fixture và truy vấn đã được xác minh trên MySQL thực tế. Test opt-in đối chiếu A/B/A-debt và chụp các bảng tài sản trước/sau các lần gọi; dùng database test riêng đã migrate, không dùng database đang có giao dịch đồng thời.

Calculator chỉ mô phỏng chính sách cố định trên dữ liệu scenario. Chưa xử lý tuổi quote, snapshot nhất quán giữa các nguồn thật, cấp vay, giải ngân, call margin, bán giải chấp hoặc các kiểm tra phiên/quyền/giữ vốn. Số ngân sách ước tính 6 triệu ở ví dụ là phép giải thích, không phải trường API hay sức mua để đặt lệnh.
