# Buổi 6 — Tài khoản và tài sản khả dụng

## 1. Mục tiêu và tiến độ

- Tách tài khoản khách hàng, tiểu khoản và các lớp trạng thái tài sản.
- Phân biệt tổng sở hữu với phần có thể dùng ngay để mua/bán.
- Giải thích được vì sao đặt lệnh làm giảm khả dụng dù chưa khớp.

**Các mục sẽ học:** trạng thái tài sản; tiền mua; chứng khoán bán được.

## 2. Kiến thức theo từng phần

### Một tài sản có nhiều trạng thái

| Khái niệm | Câu hỏi nó trả lời |
| --- | --- |
| Tổng tiền/chứng khoán | Khách hàng đang có hoặc được ghi nhận tổng cộng bao nhiêu? |
| Khả dụng | Ngay lúc này còn được dùng cho lệnh mới bao nhiêu? |
| Đang giữ (`reserved`) | Phần nào đã dành cho lệnh đang hoạt động? |
| Chờ về/chờ thanh toán | Phần nào phát sinh từ giao dịch đã khớp nhưng chưa hoàn tất hậu giao dịch? |

Tên trường cụ thể khác nhau giữa công ty; điều quan trọng là định nghĩa và phép đối chiếu nhất quán.

### Ví dụ tiền mua

Lan có 10.000.000 VND khả dụng. Cô gửi mua 100 AAA, giá giới hạn 25.000. Bỏ qua phí/thuế. Giả định tiền tổng chưa giảm trước thanh toán, còn tiền khả dụng bằng tiền tổng trừ tiền giữ cho phần chưa khớp và nghĩa vụ tiền của phần đã khớp.

| Bước | Tiền tổng | Tiền giữ | Tiền khả dụng | Ghi chú |
| --- | ---: | ---: | ---: | --- |
| Trước đặt lệnh | 10.000.000 | 0 | 10.000.000 | Có thể dùng toàn bộ. |
| Đã tiếp nhận lệnh | 10.000.000 | 2.500.000 | 7.500.000 | Giữ theo mức giá giới hạn. |
| Khớp 40 tại 24.900 | 10.000.000 | 1.500.000 | 7.504.000 | Còn nghĩa vụ tiền 996.000; giải phóng chênh lệch giá 4.000. |
| Hủy 60 còn lại | 10.000.000 | 0 | 9.004.000 | Giải phóng 1.500.000 giữ cho phần chưa khớp; nghĩa vụ 996.000 vẫn còn. |

Đừng áp dụng máy móc công thức một cột. Hãy xác định rõ hệ thống đang hiển thị tiền mặt, tiền phải trả, tiền giữ và tiền khả dụng theo chính sách nào.

### Chứng khoán bán được

Một vị thế 200 AAA có thể không có nghĩa là bán được 200 ngay: một phần có thể đang giữ cho lệnh bán khác, chờ thanh toán, bị phong tỏa hoặc không đủ điều kiện theo chính sách. Trước yêu cầu “sao không bán hết được?”, cần xem số lượng **khả dụng để bán** và lý do từng phần bị loại trừ.

## 3. Liên hệ fullstack

- **Frontend:** phân biệt tổng tài sản, phần giữ và khả dụng.
- **Backend:** kiểm tra quyền tiểu khoản và điều kiện sử dụng tài sản.
- **Dữ liệu:** định nghĩa rõ số dư, khoản giữ và tài sản chờ.
- **Trạng thái:** một phần tài sản có thể chưa dùng được dù đã được ghi nhận.

## 4. Tình huống vận dụng

Dựa vào tài khoản Lan và vị thế 200 AAA ở trên, chọn điểm còn vướng; khi học tương tác, chờ câu trả lời trước khi phản hồi.

1. Vì sao không thể dùng số tiền tổng làm điều kiện mua trực tiếp?
2. Lệnh mua đã khớp một phần có còn cần thông tin khoản giữ không?
3. Liệt kê ba nguyên nhân khiến tổng chứng khoán khác chứng khoán có thể bán.

## 5. Tổng kết và tiến độ

Nội dung chính: tài khoản, khoản giữ và tài sản khả dụng. Ghi **đã trao đổi:** …; **còn vướng:** …; **đã được ghi nhận hoàn thành:** … . Không mặc định hoàn thành vì đã đọc. Tiếp theo: [Buổi 7](./07-oms-va-vong-doi-lenh.md).

**Tham khảo tùy chọn:** [Ngày 6 — Tài khoản và tài sản khả dụng](../archive/lo-trinh-28-ngay/ngay-06-tai-khoan-va-tai-san-kha-dung.md).
