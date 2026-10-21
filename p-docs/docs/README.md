# Securities Trading Simulator

Tài liệu học và xây dựng **Securities Trading Simulator** — một nền tảng giao dịch chứng khoán mô phỏng dành cho Fullstack Developer. Mục tiêu là kết nối kiến thức nghiệp vụ chứng khoán Việt Nam với thiết kế, triển khai và debug hệ thống phần mềm.

> Đây là dự án học tập. Dữ liệu, quy tắc giao dịch và kết quả mô phỏng không dùng cho giao dịch thực tế.

## Mục tiêu

Sau lộ trình 28 ngày, người học có thể:

1. Giải thích luồng giao dịch từ đặt lệnh đến thanh toán.
2. Thiết kế các module Market Data, OMS, Accounts, Risk, Portfolio và Settlement.
3. Xây dựng API, dữ liệu realtime, cơ chế giữ tài sản và mô phỏng khớp lệnh.
4. Xử lý các rủi ro quan trọng: lệnh trùng, xử lý sự kiện trùng, cạnh tranh số dư và dữ liệu realtime cũ.
5. Điều tra lỗi bằng log, audit trail, dữ liệu giao dịch và kiểm thử hồi quy.

## Tài liệu

| Tài liệu | Nội dung |
| --- | --- |
| [Lộ trình 28 ngày](./lo-trinh-28-ngay.md) | Kế hoạch học, sản phẩm theo tuần, bài thực hành và tiêu chí hoàn thành. |
| [Kiến trúc và quy ước](./kien-truc-va-quy-uoc.md) | Phạm vi mô phỏng, module, luồng dữ liệu, quy ước kỹ thuật và bất biến nghiệp vụ. |
| [Ngày 1 — Nền móng](./ngay-01-nen-mong.md) | Bài học chi tiết đầu tiên: nghiệp vụ, API health check và kết nối MySQL. |
| [Ngày 2 — Security Master](./ngay-02-security-master.md) | Phân biệt cổ phiếu, trái phiếu, ETF; thiết kế danh mục chứng khoán, migration, seed và API tra cứu. |
| [Ngày 3 — Market Data realtime](./ngay-03-market-data-realtime.md) | Đọc bảng giá, thiết kế snapshot, Redis, REST, WebSocket và bảng giá Vue cập nhật realtime. |
| [Ngày 4 — Phiên giao dịch](./ngay-04-phien-giao-dich.md) | Lịch phiên, Clock giả lập và kiểm tra loại lệnh theo thời điểm. |
| [Ngày 5 — Sổ lệnh và khớp lệnh](./ngay-05-so-lenh-va-khop-lenh.md) | Order book, ưu tiên giá-thời gian, khớp một phần và execution. |
| [Ngày 6 — Tài khoản và tài sản khả dụng](./ngay-06-tai-khoan-va-tai-san-kha-dung.md) | Số dư tiền, vị thế, khoản giữ và kiểm tra khả năng mua/bán. |
| [Ngày 7 — Demo tuần 1](./ngay-07-demo-tuan-1.md) | Ghép bảng giá, phiên, sổ lệnh, execution và tài sản thành kịch bản demo. |
| [Ngày 11 — Danh mục, giá vốn và lãi/lỗ](./ngay-11-danh-muc-gia-von-va-lai-lo.md) | Tính giá vốn bình quân từ execution, định giá danh mục và P&L. |
| [Ngày 12 — Margin, tài sản bảo đảm và sức mua](./ngay-12-margin-tai-san-bao-dam-va-suc-mua.md) | Mô phỏng năng lực vay, kiểm tra tài sản bảo đảm và lý do quyết định. |
| [Ngày 13 — Thanh toán và đối soát](./ngay-13-thanh-toan-va-doi-soat.md) | Nghĩa vụ T+2, batch thanh toán an toàn khi chạy lại và đối soát. |
| [Ngày 14 — Sản phẩm tuần 2](./ngay-14-san-pham-tuan-2-oms-tai-san-va-thanh-toan.md) | Kịch bản xuyên suốt: đặt mua, khớp một phần, hủy và thanh toán. |
| [Ngày 15 — Kiến trúc tổng thể và quyền sở hữu dữ liệu](./ngay-15-kien-truc-tong-the-va-quyen-so-huu-du-lieu.md) | Bản đồ trách nhiệm module, quyền ghi dữ liệu và ranh giới transaction. |
| [Ngày 16 — Xác thực và phân quyền tài khoản](./ngay-16-xac-thuc-va-phan-quyen-tai-khoan.md) | JWT, membership, kiểm tra quyền theo tài nguyên và audit. |
| [Ngày 17 — Snapshot, delta và khôi phục WebSocket](./ngay-17-snapshot-delta-va-khoi-phuc-websocket.md) | Sequence, resync, reconnect và bảo vệ bảng giá trước dữ liệu cũ hoặc thiếu. |
| [Ngày 18 — Sự kiện nghiệp vụ, retry và chống xử lý trùng](./ngay-18-su-kien-nghiep-vu-retry-va-chong-xu-ly-trung.md) | Event envelope, consumer dedup, projection và retry an toàn. |
| [Ngày 19 — Concurrency và chống sử dụng tài sản vượt mức](./ngay-19-concurrency-va-chong-su-dung-tai-san-vuot-muc.md) | Row lock, optimistic locking và kiểm thử nhiều connection để bảo toàn tài sản. |
| [Ngày 20 — Transactional Outbox](./ngay-20-transactional-outbox-khong-bo-quen-su-kien-sau-khi-commit.md) | Lưu event cùng transaction nghiệp vụ, worker retry và giao event an toàn. |
| [Ngày 21 — Sản phẩm tuần 3](./ngay-21-san-pham-tuan-3-backend-co-kha-nang-phuc-hoi.md) | Bộ kiểm tra phục hồi cho retry, outbox, concurrency và dữ liệu realtime. |
| [Ngày 22 — Trading Dashboard hoàn chỉnh](./ngay-22-trading-dashboard-hoan-chinh.md) | Dashboard Vue hiển thị giá, lệnh, tiền, danh mục và trạng thái dữ liệu. |
| [Ngày 23 — Tích hợp OMS từ giao diện](./ngay-23-tich-hop-oms-tu-giao-dien-timeout-retry-va-khoi-phuc-sau-reload.md) | Lưu intent, retry an toàn và khôi phục sau reload. |
| [Ngày 24 — Tích hợp Risk và kiểm soát tài sản](./ngay-24-tich-hop-risk-va-kiem-soat-tai-san-cho-ca-mua-lan-ban.md) | Kiểm tra và giữ tiền/chứng khoán nhất quán cho lệnh mua lẫn bán. |
| [Ngày 25 — Matching Adapter và nhiều lần khớp](./ngay-25-hoan-thien-matching-adapter-va-xu-ly-nhieu-lan-khop.md) | Ánh xạ OMS, execution ổn định, khớp nhiều lần và hủy phần còn lại. |
| [Ngày 26 — Structured logging, audit trail và metrics](./ngay-26-structured-logging-audit-trail-va-metrics-theo-doi-mot-lenh-tu-api-den-khop-lenh.md) | Truy vết một lệnh từ API đến khớp lệnh bằng log, audit và chỉ số vận hành. |
| [Ngày 27 — Incident Lab](./ngay-27-incident-lab-gay-loi-co-kiem-soat-dieu-tra-va-phuc-hoi-he-thong.md) | Gây lỗi có kiểm soát, điều tra và phục hồi mà vẫn bảo toàn bất biến nghiệp vụ. |
| [Ngày 28 — Capstone](./ngay-28-capstone-hoan-thien-va-trinh-dien-securities-trading-simulator.md) | Demo xuyên suốt, đối chiếu tài sản, phục hồi sự cố và tài liệu bàn giao. |

## Stack thực hành

| Thành phần | Lựa chọn |
| --- | --- |
| Frontend | Vue 3 + TypeScript + Tailwind CSS |
| Backend | Node.js + TypeScript, modular monolith |
| Database | MySQL, storage engine InnoDB |
| Realtime | WebSocket |
| Cache | Redis, bổ sung từ phần Market Data |
| Bất đồng bộ | Transactional outbox; message broker là phần mở rộng |
| Kiểm thử | Jest + Supertest |
| Môi trường | Docker Compose |
| Công cụ lập trình | OpenCode |

## Phạm vi khởi đầu

- Chỉ mô phỏng cổ phiếu và lệnh giới hạn (`LO`) trong phiên liên tục.
- Matching engine là mô phỏng phía sở giao dịch; hệ thống công ty chứng khoán được mô phỏng bằng OMS, Risk, Accounts và Settlement.
- Margin, ETF, trái phiếu, ATO/ATC, RabbitMQ/Kafka và vận hành quy mô lớn là nội dung mở rộng.

## Cách học đề xuất

Mỗi ngày dành 90–120 phút:

| Thời lượng | Hoạt động | Kết quả |
| --- | --- | --- |
| 30 phút | Học nghiệp vụ | Diễn giải được bằng một tình huống giao dịch |
| 30 phút | Phân tích kỹ thuật | Có thiết kế API, dữ liệu hoặc luồng xử lý |
| 30 phút | Thực hành | Hoàn thành chức năng nhỏ hoặc kiểm thử quan trọng |
| 30 phút thêm | Mở rộng | Hoàn thiện UI, debug hoặc bổ sung kiểm thử |

Trước khi xem kết quả từ code, hãy tự tính tiền, khối lượng và trạng thái lệnh trong ví dụ giao dịch. Sau đó dùng API và database để đối chiếu.
