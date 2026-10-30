# Buổi 12 — Truy vết và điều tra sự cố

## 1. Mục tiêu và tiến độ

- Bắt đầu từ sự kiện quan sát được, không vội kết luận nguyên nhân.
- Dùng timeline và định danh để nối UI, API, lệnh, execution, tài sản và thanh toán.
- Phân biệt log vận hành, audit nghiệp vụ và dữ liệu trạng thái.

**Các mục sẽ học:** định danh; bằng chứng; timeline và kiểm chứng giả thuyết.

## 2. Kiến thức theo từng phần

### Bộ định danh cần biết

| Định danh | Dùng để trả lời |
| --- | --- |
| Request/correlation ID | Chuỗi xử lý của một lần gọi hoặc một thao tác kỹ thuật là gì? |
| Idempotency key | Hai lần gửi có phải cùng ý định người dùng không? |
| Order ID | Lệnh nào của khách hàng đang được nói tới? |
| Execution ID | Lần khớp nào đã tạo biến động? |
| Event ID | Sự kiện nào đã/đang được consumer xử lý? |
| Obligation/settlement ID | Nghĩa vụ hay lần thanh toán nào liên quan? |

Không phải hệ thống nào cũng dùng đúng các tên này, nhưng phải có cách liên kết tương đương. Không đưa định danh nhạy cảm hoặc dữ liệu cá nhân không cần thiết vào màn hình/log công khai.

### Ba loại bằng chứng

| Nguồn | Trả lời tốt nhất | Hạn chế |
| --- | --- | --- |
| Log kỹ thuật | Request đi qua thành phần nào, mất bao lâu, lỗi gì | Có thể thiếu ngữ cảnh nghiệp vụ hoặc bị lấy mẫu. |
| Audit/lịch sử nghiệp vụ | Ai/cái gì đã làm thay đổi lệnh, tài sản, thời điểm nào | Không nhất thiết cho biết lỗi hạ tầng. |
| Trạng thái/bút toán hiện tại | Cuối cùng hệ thống đang ghi nhận gì | Không tự giải thích mọi bước đã dẫn đến số đó. |

Không dùng một dòng log “success” làm bằng chứng duy nhất cho một giao dịch.

### Phương pháp điều tra sáu bước

1. **Ghi nhận triệu chứng:** ai thấy gì, tại thời điểm nào, trên tài khoản/thiết bị nào.
2. **Khoanh phạm vi:** một lệnh, một người dùng, một phiên bản hay toàn hệ thống?
3. **Lập timeline:** sắp theo thời gian có múi giờ/nguồn thời gian rõ ràng.
4. **Đặt giả thuyết có thể bác bỏ:** ví dụ timeout tạo request trùng, event bị xử lý hai lần, UI nhận dữ liệu cũ.
5. **Đối chiếu bằng chứng:** liên kết ID, audit, bút toán, trạng thái và log; tìm cả bằng chứng phản bác.
6. **Khắc phục và kiểm chứng:** sửa nguyên nhân, kiểm tra bất biến, thêm test/giám sát để tránh tái diễn.

### Ví dụ điều tra

Khách hàng báo “Tôi bấm Mua một lần nhưng bị giữ tiền hai lần.” Các giả thuyết ban đầu có thể là: UI gửi lại sau timeout bằng khóa mới; backend không deduplicate request; hai lệnh khác nhau thật sự được tạo; hoặc chỉ màn hình đang cộng trùng dữ liệu hiển thị.

| Cần hỏi | Bằng chứng tương ứng |
| --- | --- |
| Có bao nhiêu ý định/request? | Idempotency key, request ID, timestamp client/server. |
| Có bao nhiêu order? | Audit OMS và danh sách order theo tài khoản. |
| Có bao nhiêu khoản giữ/bút toán? | Sổ cái, liên kết reservation → order. |
| UI hiển thị từ nguồn nào? | Payload, phiên bản ứng dụng, dữ liệu cache/realtime. |

Chỉ sau khi có câu trả lời mới chọn sửa UI, quy tắc idempotency, quy trình giải phóng tiền hay dữ liệu hiển thị.

## 3. Liên hệ fullstack

- **Frontend:** ghi nhận trải nghiệm, phiên bản và trạng thái hiển thị.
- **Backend:** cung cấp log theo chuỗi xử lý và bảo vệ dữ liệu nhạy cảm.
- **Dữ liệu:** nối request, lệnh, execution và bút toán.
- **Trạng thái:** so timeline sự kiện với trạng thái cuối, không chỉ dựa vào một log.

## 4. Tình huống vận dụng

Dựa vào báo cáo “bấm một lần nhưng giữ tiền hai lần” ở trên, chọn điểm còn vướng; khi học tương tác, chờ câu trả lời trước khi phản hồi.

1. Vì sao một timestamp từ máy người dùng chưa đủ để kết luận server xử lý chậm?
2. Log và audit khác nhau thế nào trong tranh chấp tiền?
3. Một bản sửa được coi là chưa hoàn chỉnh khi thiếu điều gì?

## 5. Tổng kết và tiến độ

Nội dung chính: timeline, bằng chứng và kiểm chứng giả thuyết. Ghi **đã trao đổi:** …; **còn vướng:** …; **đã được ghi nhận hoàn thành:** … . Không mặc định hoàn thành vì đã đọc. Tiếp theo: [Ôn tập và tình huống công việc](./on-tap-va-tinh-huong-cong-viec.md).

**Tham khảo tùy chọn:** [Ngày 26 — Logging và audit](../archive/lo-trinh-28-ngay/ngay-26-structured-logging-audit-trail-va-metrics-theo-doi-mot-lenh-tu-api-den-khop-lenh.md) và [Ngày 27 — Incident Lab](../archive/lo-trinh-28-ngay/ngay-27-incident-lab-gay-loi-co-kiem-soat-dieu-tra-va-phuc-hoi-he-thong.md).
