# Buổi 12 — Truy vết và điều tra sự cố

## Cần hiểu sau buổi học

- Bắt đầu từ sự kiện quan sát được, không vội kết luận nguyên nhân.
- Dùng timeline và định danh để nối UI, API, lệnh, execution, tài sản và thanh toán.
- Phân biệt log vận hành, audit nghiệp vụ và dữ liệu trạng thái.

## Bộ định danh cần biết

| Định danh | Dùng để trả lời |
| --- | --- |
| Request/correlation ID | Chuỗi xử lý của một lần gọi hoặc một thao tác kỹ thuật là gì? |
| Idempotency key | Hai lần gửi có phải cùng ý định người dùng không? |
| Order ID | Lệnh nào của khách hàng đang được nói tới? |
| Execution ID | Lần khớp nào đã tạo biến động? |
| Event ID | Sự kiện nào đã/đang được consumer xử lý? |
| Obligation/settlement ID | Nghĩa vụ hay lần thanh toán nào liên quan? |

Không phải hệ thống nào cũng dùng đúng các tên này, nhưng phải có cách liên kết tương đương. Không đưa định danh nhạy cảm hoặc dữ liệu cá nhân không cần thiết vào màn hình/log công khai.

## Ba loại bằng chứng

| Nguồn | Trả lời tốt nhất | Hạn chế |
| --- | --- | --- |
| Log kỹ thuật | Request đi qua thành phần nào, mất bao lâu, lỗi gì | Có thể thiếu ngữ cảnh nghiệp vụ hoặc bị lấy mẫu. |
| Audit/lịch sử nghiệp vụ | Ai/cái gì đã làm thay đổi lệnh, tài sản, thời điểm nào | Không nhất thiết cho biết lỗi hạ tầng. |
| Trạng thái/bút toán hiện tại | Cuối cùng hệ thống đang ghi nhận gì | Không tự giải thích mọi bước đã dẫn đến số đó. |

Không dùng một dòng log “success” làm bằng chứng duy nhất cho một giao dịch.

## Phương pháp điều tra sáu bước

1. **Ghi nhận triệu chứng:** ai thấy gì, tại thời điểm nào, trên tài khoản/thiết bị nào.
2. **Khoanh phạm vi:** một lệnh, một người dùng, một phiên bản hay toàn hệ thống?
3. **Lập timeline:** sắp theo thời gian có múi giờ/nguồn thời gian rõ ràng.
4. **Đặt giả thuyết có thể bác bỏ:** ví dụ timeout tạo request trùng, event bị xử lý hai lần, UI nhận dữ liệu cũ.
5. **Đối chiếu bằng chứng:** liên kết ID, audit, bút toán, trạng thái và log; tìm cả bằng chứng phản bác.
6. **Khắc phục và kiểm chứng:** sửa nguyên nhân, kiểm tra bất biến, thêm test/giám sát để tránh tái diễn.

## Tình huống điều tra

Khách hàng báo “Tôi bấm Mua một lần nhưng bị giữ tiền hai lần.” Các giả thuyết ban đầu có thể là: UI gửi lại sau timeout bằng khóa mới; backend không deduplicate request; hai lệnh khác nhau thật sự được tạo; hoặc chỉ màn hình đang cộng trùng dữ liệu hiển thị.

| Cần hỏi | Bằng chứng tương ứng |
| --- | --- |
| Có bao nhiêu ý định/request? | Idempotency key, request ID, timestamp client/server. |
| Có bao nhiêu order? | Audit OMS và danh sách order theo tài khoản. |
| Có bao nhiêu khoản giữ/bút toán? | Sổ cái, liên kết reservation → order. |
| UI hiển thị từ nguồn nào? | Payload, phiên bản ứng dụng, dữ liệu cache/realtime. |

Chỉ sau khi có câu trả lời mới chọn sửa UI, quy tắc idempotency, quy trình giải phóng tiền hay dữ liệu hiển thị.

## Tự kiểm tra

1. Vì sao một timestamp từ máy người dùng chưa đủ để kết luận server xử lý chậm?
2. Log và audit khác nhau thế nào trong tranh chấp tiền?
3. Một bản sửa được coi là chưa hoàn chỉnh khi thiếu điều gì?

**Đáp án ngắn:** đồng hồ/mạng khác nhau và request có thể chưa tới server. Log cho đường đi kỹ thuật; audit cho thay đổi nghiệp vụ. Thiếu kiểm chứng dữ liệu/bất biến và biện pháp ngăn lỗi lặp lại.

**Tham khảo tùy chọn:** [Ngày 26 — Logging và audit](../archive/lo-trinh-28-ngay/ngay-26-structured-logging-audit-trail-va-metrics-theo-doi-mot-lenh-tu-api-den-khop-lenh.md) và [Ngày 27 — Incident Lab](../archive/lo-trinh-28-ngay/ngay-27-incident-lab-gay-loi-co-kiem-soat-dieu-tra-va-phuc-hoi-he-thong.md).
