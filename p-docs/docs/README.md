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
