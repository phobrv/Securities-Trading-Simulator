# Lộ trình 28 ngày

**Mục tiêu:** hiểu nghiệp vụ chứng khoán Việt Nam và có khả năng xây dựng, bảo trì, debug một hệ thống giao dịch mô phỏng.

- Thời lượng: 4 tuần, 90–120 phút/ngày, tổng khoảng 42–56 giờ.
- Phương pháp: nghiệp vụ → phân tích hệ thống → API/database → lập trình → debug.
- Dự án xuyên suốt: **Securities Trading Simulator**.
- Frontend thực hành: **Vue 3 + TypeScript + Tailwind CSS**.

## Sản phẩm theo tuần

| Tuần | Sản phẩm | Có thể demo |
| --- | --- | --- |
| 1 | Bảng giá mô phỏng | Danh mục mã, giá realtime, phiên giao dịch, sổ lệnh cơ bản |
| 2 | OMS và quản lý tài sản | Đặt/hủy lệnh, giữ tiền, khớp một phần, danh mục, thanh toán mô phỏng |
| 3 | Backend có khả năng phục hồi | Phân quyền, chống trùng, concurrency, outbox, đồng bộ realtime |
| 4 | Trading Simulator hoàn chỉnh | Luồng giao dịch từ UI, observability và điều tra sự cố |

---

## Tuần 1 — Thị trường và bảng giá mô phỏng

| Ngày | Chủ đề | Thực hành trọng tâm | Hoàn thành khi |
| --- | --- | --- | --- |
| 1 | Bản đồ thị trường và khởi tạo | Backend, MySQL, health API, metadata | Giải thích luồng giao dịch và gọi được ba API nền móng |
| 2 | Security Master | `securities`, `listings`, `trading_rules`; lọc danh mục | Tách được định danh chứng khoán với mã/niêm yết |
| 3 | Bảng giá và Market Data | Quote snapshot, Redis, WebSocket, sequence | Bảng giá realtime có đơn vị dữ liệu đúng |
| 4 | Phiên giao dịch | State machine phiên, đồng hồ giả lập, validation | Từ chối lệnh không phù hợp phiên đúng thời điểm |
| 5 | Sổ lệnh và khớp cơ bản | Order book, price-time priority, partial fill | Kiểm thử được ưu tiên giá-thời gian |
| 6 | Tài khoản và tài sản khả dụng | Balances, positions, reservations | Không nhầm tổng sở hữu với phần có thể dùng |
| 7 | Demo tuần 1 | Ghép giá, phiên, sổ lệnh và tài khoản mẫu | Demo được từ môi trường vừa khởi động |

**Tình huống debug tiêu biểu:** kết nối nhầm database, sai đơn vị giá, lệch UTC/giờ Việt Nam, sắp sổ bán sai thứ tự, cho bán phần chứng khoán đã giữ.

---

## Tuần 2 — OMS, tiền, danh mục và hậu giao dịch

| Ngày | Chủ đề | Thực hành trọng tâm | Hoàn thành khi |
| --- | --- | --- | --- |
| 8 | Vòng đời lệnh | `orders`, `order_events`, state machine | Dựng lại lịch sử lệnh từ sự kiện |
| 9 | Đặt, hủy, sửa lệnh | REST API, validation, `Idempotency-Key` | Request trùng không tạo thêm lệnh |
| 10 | Giữ tiền và sổ cái | Reservations, ledger, transaction | Đối chiếu được số dư từ lịch sử biến động |
| 11 | Danh mục, giá vốn, P&L | Positions, movements, bình quân giá vốn | API và phép tính tay cùng kết quả |
| 12 | Margin và sức mua | Risk calculator, chính sách tài sản bảo đảm | Giải thích được từng thành phần tính sức mua |
| 13 | Thanh toán và đối soát | Nghĩa vụ, lịch làm việc, batch idempotent | Chạy lại batch không hạch toán trùng |
| 14 | Demo tuần 2 | Luồng đặt mua → khớp một phần → hủy → thanh toán | Đối chiếu đúng lệnh, tiền giữ, tiền chi và tài sản chờ về |

**Tình huống chuẩn ngày 14:** tài khoản có 10 triệu; mua 100 cổ phiếu giá giới hạn 25.000; khớp 40; hủy 60; thanh toán phần đã khớp.

---

## Tuần 3 — Nhất quán, realtime và khả năng phục hồi

| Ngày | Chủ đề | Thực hành trọng tâm | Hoàn thành khi |
| --- | --- | --- | --- |
| 15 | Kiến trúc công ty chứng khoán | Ownership dữ liệu, module interface, ADR | Chỉ rõ module nào được quyền ghi từng dữ liệu |
| 16 | Xác thực và phân quyền | JWT, membership, roles, audit | API đọc/ghi đều chặn tài khoản trái quyền |
| 17 | Snapshot và delta | Sequence, reconnect, stale-data state | Mất delta không làm dữ liệu cũ ghi đè mới |
| 18 | Sự kiện và idempotency | Event envelope, consumer dedup | Giao lại event không cập nhật projection lần hai |
| 19 | Concurrency | Locking/optimistic locking, request đồng thời | Hai lệnh cạnh tranh không tạo số dư khả dụng âm |
| 20 | Transactional outbox | Lưu outbox cùng transaction, worker retry | Khôi phục sau lỗi không mất event hay xử lý đôi |
| 21 | Review phục hồi | Test retry, event trùng, restart worker, mất delta | Có bằng chứng kiểm thử cho từng failure mode |

Ví dụ event envelope:

```json
{
  "eventId": "evt-001",
  "type": "ExecutionCreated",
  "schemaVersion": 1,
  "aggregateId": "ord-001",
  "aggregateVersion": 3,
  "occurredAt": "2026-10-20T07:00:00Z",
  "payload": { "executionId": "exe-001", "quantity": 40, "price": 24900 }
}
```

---

## Tuần 4 — Hoàn thiện sản phẩm và debug

| Ngày | Chủ đề | Thực hành trọng tâm | Hoàn thành khi |
| --- | --- | --- | --- |
| 22 | Trading Dashboard | Quote board, form đặt lệnh, lệnh, tiền, danh mục | Người dùng hiểu đúng trạng thái lệnh trên một màn hình |
| 23 | Tích hợp OMS từ UI | Error contract, retry cùng idempotency key | Một ý định đặt lệnh chỉ tạo một lệnh |
| 24 | Tích hợp Risk | Pipeline kiểm tra và giữ tiền/chứng khoán | Không thể mua/bán vượt tài sản khả dụng |
| 25 | Tích hợp Matching Simulator | Execution atomic, outbox hậu xử lý | Tổng execution bằng khối lượng đã khớp |
| 26 | Logging, audit, observability | Structured logs, trace, metric | Truy vết một lệnh từ API đến biến động tiền |
| 27 | Điều tra sự cố | Timeline, giả thuyết, tái hiện, regression test | Có báo cáo nguyên nhân gốc và bản sửa đã kiểm chứng |
| 28 | Capstone | Demo end-to-end và review kiến trúc | Số liệu đối chiếu đúng, kiểm thử trọng yếu đạt |

Các sự cố nên điều tra: nhấn một lần tạo hai lệnh; hủy lệnh nhưng tiền chưa trả; bảng giá đứng yên dù ứng dụng báo kết nối.

---

## Kiểm thử cần duy trì xuyên suốt

| Nhóm | Kiểm thử bắt buộc |
| --- | --- |
| Vòng đời lệnh | Không chuyển từ trạng thái kết thúc sang trạng thái không hợp lệ |
| Khớp lệnh | Không khớp vượt khối lượng; đúng quy tắc ưu tiên đã công bố |
| Giữ tài sản | Không dùng quá phần tiền/chứng khoán khả dụng |
| Khớp một phần | Chỉ hủy và hoàn trả phần còn lại |
| Idempotency | Cùng khóa, cùng payload trả về cùng kết quả |
| Sự kiện | Event trùng không làm thay đổi tài sản lần hai |
| Transaction | Lỗi giữa luồng không để lại cập nhật dở dang |
| Thanh toán | Batch chạy lại không thanh toán trùng |
| Phân quyền | Không truy cập dữ liệu của tài khoản khác |
| Realtime | Phát hiện sequence gap; bản tin cũ không ghi đè bản mới |

## Tự đánh giá cuối khóa

Chấm mỗi mục từ 0 đến 2: **0** chưa làm/giải thích được; **1** làm được khi có hướng dẫn; **2** tự làm, giải thích và kiểm chứng được.

| Năng lực | Bằng chứng |
| --- | --- |
| Nghiệp vụ | Giải thích một giao dịch từ đặt lệnh đến thanh toán |
| API | Validation, lỗi nghiệp vụ, phân quyền, chống trùng |
| Database | Lịch sử biến động, ràng buộc và transaction phù hợp |
| Concurrency | Test hai lệnh cạnh tranh cùng tài sản |
| Realtime | Phục hồi đúng sau mất kết nối hoặc thiếu bản tin |
| Debug | Timeline, nguyên nhân gốc và regression test |
