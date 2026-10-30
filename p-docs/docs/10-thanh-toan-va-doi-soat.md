# Buổi 10 — Thanh toán và đối soát

## 1. Mục tiêu và tiến độ

- Khớp lệnh xác lập giao dịch; thanh toán thực hiện nghĩa vụ sau đó.
- Tài sản chờ và tài sản khả dụng có thể cùng tồn tại trong một khoảng thời gian.
- Đối soát là tìm và giải thích chênh lệch, không chỉ là so hai con số.

**Các mục sẽ học:** nghĩa vụ và thanh toán; lịch; đối soát.

## 2. Kiến thức theo từng phần

### Ba mốc phải tách

| Mốc | Điều đã xảy ra |
| --- | --- |
| Đặt/tiếp nhận lệnh | Ý định được kiểm tra và có thể cần giữ tài sản. |
| Khớp lệnh | Phần giao dịch được xác lập, tạo execution và nghĩa vụ. |
| Thanh toán | Nghĩa vụ tiền/chứng khoán đến hạn được hoàn tất theo quy trình áp dụng. |

Ví dụ khớp mua 40 AAA giá 24.900 tạo nghĩa vụ trả 996.000 VND và nhận 40 AAA. Không vì vậy mà kết luận ngay 40 AAA đã có thể bán; cần xem trạng thái thanh toán/chính sách sản phẩm.

### Lịch và tính đúng hạn

Ngày giao dịch, ngày thanh toán dự kiến và thời điểm xử lý không phải một trường. Chu kỳ được mô tả bằng ngày làm việc và lịch có thể có ngoại lệ; không đơn giản là cộng số giờ cố định. Trong công việc, dùng lịch do nghiệp vụ/vận hành cung cấp thay vì tự mã hóa suy đoán.

### Đối soát bằng biến động

Với một execution, lập bảng kiểm:

| Điều cần đối chiếu | Câu hỏi |
| --- | --- |
| Lệnh và execution | Tổng execution có vượt/có thiếu so với lệnh không? |
| Nghĩa vụ | Mỗi execution đã tạo đúng một nghĩa vụ theo hướng mua/bán chưa? |
| Khoản giữ | Phần hủy đã giải phóng, phần khớp đã chuyển đúng chưa? |
| Tiền/chứng khoán | Tổng biến động có khớp số dư trước-sau và bút toán không? |
| Trạng thái xử lý | Nghĩa vụ đã thanh toán, đang xử lý hay bị lỗi? |

Nếu batch thanh toán được chạy lại sau lỗi, hệ thống phải nhận biết nghĩa vụ nào đã hoàn tất để không chuyển tiền/chứng khoán lần hai. Đây là yêu cầu về idempotency ở cấp xử lý hậu giao dịch.

### Ví dụ sai lệch

Báo cáo cho biết 40 AAA đã thanh toán, nhưng danh mục chỉ tăng 20. Đừng kết luận ngay “frontend hiển thị sai”. Hãy kiểm tra theo thứ tự: định danh tài khoản/tiểu khoản, execution và nghĩa vụ, trạng thái từng phần của settlement, biến động chứng khoán, thời điểm dữ liệu báo cáo và các sự kiện điều chỉnh nếu có.

## 3. Liên hệ fullstack

- **Frontend:** phân biệt tài sản chờ và đã thanh toán.
- **Backend:** xử lý nghĩa vụ và tránh thanh toán trùng khi chạy lại.
- **Dữ liệu:** liên kết lệnh, execution, nghĩa vụ và bút toán.
- **Trạng thái:** đến hạn không có nghĩa đã thanh toán thành công.

## 4. Tình huống vận dụng

Một lệnh mua 100 AAA khớp 40 rồi hủy phần còn lại. Lô xử lý thanh toán bị ngắt giữa chừng và cần chạy lại. Chọn điểm còn vướng; khi học tương tác, chờ câu trả lời trước khi phản hồi.

1. Một lệnh hủy sau khi khớp 40 có còn tạo thanh toán không?
2. Vì sao chạy lại batch không được mặc định là vô hại?
3. Ba định danh nào hữu ích để nối một chênh lệch từ lệnh đến thanh toán?

## 5. Tổng kết và tiến độ

Nội dung chính: nghĩa vụ, tài sản chờ và đối soát. Ghi **đã trao đổi:** …; **còn vướng:** …; **đã được ghi nhận hoàn thành:** … . Không mặc định hoàn thành vì đã đọc. Tiếp theo: [Buổi 11](./11-ranh-gioi-he-thong-va-kha-nang-phuc-hoi.md).

**Tham khảo tùy chọn:** [Ngày 13 — Thanh toán và đối soát](../archive/lo-trinh-28-ngay/ngay-13-thanh-toan-va-doi-soat.md).
