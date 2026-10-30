# Buổi 9 — Giữ tài sản, danh mục và sức mua

## 1. Mục tiêu và tiến độ

- Khoản giữ là cam kết tạm thời để tránh dùng cùng tài sản cho nhiều lệnh.
- Sổ cái giải thích **vì sao** số dư thay đổi; số dư hiện tại chỉ là ảnh chụp.
- Vị thế, giá vốn, lãi/lỗ và sức mua dùng dữ liệu khác nhau.

**Các mục sẽ học:** khoản giữ; sổ cái; danh mục và sức mua.

## 2. Kiến thức theo từng phần

### Giữ tài sản theo vòng đời lệnh

| Sự kiện | Mua | Bán |
| --- | --- | --- |
| Lệnh được tiếp nhận | Giữ tiền theo chính sách/giá giới hạn | Giữ chứng khoán có thể bán |
| Khớp một phần | Chuyển phần tương ứng thành nghĩa vụ/ghi nhận giao dịch | Cập nhật phần đã bán và nghĩa vụ tiền/chứng khoán |
| Hủy phần còn lại | Giải phóng phần tiền không còn cần cho lệnh | Giải phóng phần chứng khoán chưa khớp |
| Từ chối | Không tạo hoặc hoàn trả giữ phù hợp | Không tạo hoặc hoàn trả giữ phù hợp |

Khoản giữ không phải chi tiêu cuối cùng. Nó là cách bảo vệ “khả dụng” trong khi kết quả lệnh còn thay đổi.

### Sổ cái và ảnh chụp số dư

| Loại dữ liệu | Mục đích |
| --- | --- |
| Số dư/vị thế hiện tại | Trả lời nhanh “hiện có bao nhiêu?”. |
| Bút toán/biến động | Giải thích “vì sao lại thành số này?”. |
| Khoản giữ | Giải thích phần không thể dùng cho lệnh mới. |
| Nghĩa vụ chờ thanh toán | Phân biệt giao dịch đã khớp với tài sản đã hoàn tất hậu giao dịch. |

Khi số dư bị nghi sai, đừng chỉ sửa con số hiển thị. Hãy lần theo các biến động, khóa liên kết tới lệnh/execution và kiểm tra có bị ghi hai lần hoặc bỏ sót không.

### Danh mục, giá vốn và lãi/lỗ

Giả sử Lan đã thanh toán 100 AAA giá vốn bình quân 24.500. Giá thị trường hiện là 25.100.

| Chỉ số | Cách đọc | Giá trị theo giả định |
| --- | --- | ---: |
| Số lượng | Vị thế đang nắm | 100 |
| Giá vốn bình quân | Chi phí bình quân theo chính sách | 24.500 |
| Giá trị thị trường | 100 × 25.100 | 2.510.000 |
| Lãi/lỗ chưa thực hiện | 2.510.000 − 2.450.000, trước phí/thuế nếu chưa tính | 60.000 |

Phải hỏi chính sách giá vốn (ví dụ bình quân, FIFO), thời điểm ghi nhận và phí/thuế có được đưa vào không trước khi so sánh số liệu.

### Sức mua và margin

Sức mua không chỉ là tiền mặt. Với sản phẩm margin, nó có thể phụ thuộc vào tiền, giá trị tài sản bảo đảm sau tỷ lệ, dư nợ, hạn mức và chính sách rủi ro. Trong lộ trình này, không có một công thức mặc định: khi nhận yêu cầu, hãy yêu cầu rõ **đầu vào, tỷ lệ, ngưỡng, thời điểm định giá và lý do từ chối**.

## 3. Liên hệ fullstack

- **Frontend:** phân biệt số dư, giữ, vị thế và sức mua.
- **Backend:** ghi nhận biến động và áp dụng chính sách risk.
- **Dữ liệu:** nối bút toán, khoản giữ và execution bằng định danh.
- **Trạng thái:** theo dõi phần giữ, chờ thanh toán và đã giải phóng riêng.

## 4. Tình huống vận dụng

Với vị thế Lan ở trên, giả sử một execution được gửi lại; chọn câu hỏi theo điểm còn vướng và chờ câu trả lời trước khi phản hồi.

1. Vì sao lệnh mua mới không nên nhìn thẳng vào tổng tiền?
2. Nếu một bút toán execution được xử lý lại, rủi ro gì với danh mục?
3. Giá vốn có phải là giá khớp gần nhất không?

## 5. Tổng kết và tiến độ

Nội dung chính: khoản giữ, sổ cái, danh mục và margin. Ghi **đã trao đổi:** …; **còn vướng:** …; **đã được ghi nhận hoàn thành:** … . Không mặc định hoàn thành vì đã đọc. Tiếp theo: [Buổi 9 bổ sung](./09-bo-sung-danh-muc-gia-von-va-margin.md).

**Tham khảo tùy chọn:** [Ngày 10 — Giữ tiền và sổ cái tiền](../archive/lo-trinh-28-ngay/ngay-10-giu-tien-va-so-cai-tien.md), [Ngày 11 — Danh mục, giá vốn và lãi/lỗ](../archive/lo-trinh-28-ngay/ngay-11-danh-muc-gia-von-va-lai-lo.md), [Ngày 12 — Margin](../archive/lo-trinh-28-ngay/ngay-12-margin-tai-san-bao-dam-va-suc-mua.md).
