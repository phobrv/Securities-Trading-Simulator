# Buổi 6 — Tài khoản và tài sản khả dụng

## Cần hiểu sau buổi học

- Tách tài khoản khách hàng, tiểu khoản và các lớp trạng thái tài sản.
- Phân biệt tổng sở hữu với phần có thể dùng ngay để mua/bán.
- Giải thích được vì sao đặt lệnh làm giảm khả dụng dù chưa khớp.

## Một tài sản có nhiều trạng thái

| Khái niệm | Câu hỏi nó trả lời |
| --- | --- |
| Tổng tiền/chứng khoán | Khách hàng đang có hoặc được ghi nhận tổng cộng bao nhiêu? |
| Khả dụng | Ngay lúc này còn được dùng cho lệnh mới bao nhiêu? |
| Đang giữ (`reserved`) | Phần nào đã dành cho lệnh đang hoạt động? |
| Chờ về/chờ thanh toán | Phần nào phát sinh từ giao dịch đã khớp nhưng chưa hoàn tất hậu giao dịch? |

Tên trường cụ thể khác nhau giữa công ty; điều quan trọng là định nghĩa và phép đối chiếu nhất quán.

## Tình huống tiền mua

Lan có 10.000.000 VND khả dụng. Cô gửi mua 100 AAA, giá giới hạn 25.000. Bỏ qua phí/thuế trong bài này.

| Bước | Tiền tổng | Tiền giữ | Tiền khả dụng | Ghi chú |
| --- | ---: | ---: | ---: | --- |
| Trước đặt lệnh | 10.000.000 | 0 | 10.000.000 | Có thể dùng toàn bộ. |
| Đã tiếp nhận lệnh | 10.000.000 | 2.500.000 | 7.500.000 | Giữ theo mức giá giới hạn. |
| Khớp 40 tại 24.900 | 10.000.000 | 1.500.000 | 7.500.000 | Phần đã khớp có nghĩa vụ 996.000; mức ghi nhận chi tiết phụ thuộc chính sách sổ cái. |
| Hủy 60 còn lại | 10.000.000 | 0 | tăng tương ứng | Chỉ hoàn phần không còn cần giữ. |

Đừng áp dụng máy móc công thức một cột. Hãy xác định rõ hệ thống đang hiển thị tiền mặt, tiền phải trả, tiền giữ và tiền khả dụng theo chính sách nào.

## Chứng khoán bán được

Một vị thế 200 AAA có thể không có nghĩa là bán được 200 ngay: một phần có thể đang giữ cho lệnh bán khác, chờ thanh toán, bị phong tỏa hoặc không đủ điều kiện theo chính sách. Trước yêu cầu “sao không bán hết được?”, cần xem số lượng **khả dụng để bán** và lý do từng phần bị loại trừ.

## Tự kiểm tra

1. Vì sao không thể dùng số tiền tổng làm điều kiện mua trực tiếp?
2. Lệnh mua đã khớp một phần có còn cần thông tin khoản giữ không?
3. Liệt kê ba nguyên nhân khiến tổng chứng khoán khác chứng khoán có thể bán.

**Đáp án ngắn:** tổng tiền có thể đã dành cho lệnh/nghĩa vụ khác. Có, để biết phần lệnh còn hoạt động và phần cần giải phóng khi hủy. Ví dụ: đang giữ cho lệnh, chờ thanh toán, bị hạn chế/phong tỏa.

**Tham khảo tùy chọn:** [Ngày 6 — Tài khoản và tài sản khả dụng](../archive/lo-trinh-28-ngay/ngay-06-tai-khoan-va-tai-san-kha-dung.md).
