# Buổi 8 — Từ giao diện đến xử lý lệnh

## Cần hiểu sau buổi học

- Một ý định người dùng có thể trải qua nhiều lần gửi kỹ thuật nhưng chỉ được tạo một lệnh nghiệp vụ.
- Timeout không cho biết chắc yêu cầu thành công hay thất bại.
- UI phải mô hình hóa trạng thái bất định thay vì đoán kết quả.

## Bốn lớp của một thao tác “Mua”

| Lớp | Ví dụ câu hỏi |
| --- | --- |
| Ý định người dùng | Lan muốn mua 100 AAA giá 25.000. Có xác nhận lại thông tin quan trọng không? |
| Trạng thái giao diện | Nút đang gửi, có thể bấm lại không, hiển thị mã yêu cầu nào? |
| Xử lý nghiệp vụ | Hệ thống đã kiểm tra quyền, phiên, giá, khối lượng, tài sản chưa? |
| Kết quả thị trường | Lệnh có được tiếp nhận/khớp/hủy hay chưa? |

Không để trạng thái UI tự trở thành sự thật nghiệp vụ. “Đã gửi thành công từ trình duyệt” có thể chỉ nói kết nối đã bắt đầu hoặc đã nhận phản hồi HTTP, tùy hợp đồng.

## Idempotency: một ý định, một kết quả nghiệp vụ

Khi người dùng nhấn hai lần, reload, hoặc ứng dụng retry sau lỗi mạng, backend cần nhận biết đâu là **cùng một ý định**. Một khóa idempotency gắn với ý định đó giúp yêu cầu gửi lại trả về kết quả của lần xử lý trước thay vì tạo lệnh thứ hai.

| Tình huống | Hành vi mong muốn |
| --- | --- |
| Cùng khóa, cùng nội dung, lần gửi lại | Trả về cùng kết quả/lệnh đã tạo. |
| Cùng khóa, nội dung khác | Báo mâu thuẫn; không âm thầm dùng lại hay tạo mới. |
| Khóa mới, ý định mới | Đánh giá như yêu cầu độc lập. |

Khóa kỹ thuật không thay thế validation nghiệp vụ. Một lệnh bị từ chối cũng cần có phản hồi rõ để UI biết đó là kết quả của ý định nào.

## Timeout là trạng thái “chưa biết”

| Điều xảy ra | Điều client biết chắc | Việc nên làm |
| --- | --- | --- |
| Không gửi được yêu cầu | Có thể chưa đến server | Cho phép gửi lại với cùng khóa khi phù hợp. |
| Timeout khi chờ phản hồi | Không biết server đã xử lý hay chưa | Tra cứu theo định danh/khóa trước khi tạo ý định mới. |
| Server báo từ chối nghiệp vụ | Đã có kết quả rõ | Hiển thị lý do có thể hành động. |
| Server xác nhận tiếp nhận | Có lệnh/đề nghị được ghi nhận | Chuyển sang theo dõi vòng đời, không tự báo khớp. |

## Bài tập

Lan bấm Mua. Mạng hết hạn chờ nhưng server thực ra đã tạo lệnh. Cô bấm lại lần nữa. Hãy nêu:

1. rủi ro nếu mỗi lần bấm sinh khóa mới;
2. dữ liệu UI cần lưu để phục hồi sau reload;
3. màn hình nên nói gì trước khi tra cứu xong.

**Đáp án gợi ý:** có thể tạo hai lệnh và giữ tài sản hai lần; lưu khóa ý định, thông tin tối thiểu của yêu cầu và định danh lệnh nếu đã có; hiển thị “đang kiểm tra trạng thái yêu cầu”, không khẳng định thất bại.

**Tham khảo tùy chọn:** [Ngày 9 — API đặt lệnh và chống tạo lệnh trùng](../archive/lo-trinh-28-ngay/ngay-09-api-dat-lenh-yeu-cau-huy-va-chong-tao-lenh-trung.md) và [Ngày 23 — Tích hợp OMS từ giao diện](../archive/lo-trinh-28-ngay/ngay-23-tich-hop-oms-tu-giao-dien-timeout-retry-va-khoi-phuc-sau-reload.md).
