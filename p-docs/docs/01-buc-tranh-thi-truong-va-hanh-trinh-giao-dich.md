# Buổi 1 — Bức tranh thị trường và hành trình giao dịch

## Cần hiểu sau buổi học

- Ai làm gì trong một giao dịch chứng khoán trên thị trường thứ cấp.
- Khác biệt giữa **lệnh**, **lần khớp** và **thanh toán**.
- Một màn hình Mua/Bán không đồng nghĩa giao dịch đã hoàn tất.

## Bản đồ tối giản

| Bên tham gia | Vai trò trong tình huống học | Câu hỏi fullstack cần đặt |
| --- | --- | --- |
| Nhà đầu tư | Đưa ý định mua/bán qua ứng dụng | UI đã phản hồi đúng ý định và trạng thái chưa? |
| Công ty chứng khoán | Quản lý tài khoản, kiểm tra điều kiện, quản lý lệnh | Hệ thống nào là nguồn sự thật cho lệnh và tài sản? |
| Sở giao dịch | Nhận lệnh, tổ chức khớp theo quy tắc thị trường | Phản hồi thị trường đã về hay còn đang chờ? |
| Lưu ký/bù trừ/thanh toán | Xử lý nghĩa vụ sau giao dịch | Khi nào tiền và chứng khoán thực sự đổi trạng thái? |
| Tổ chức phát hành | Phát hành chứng khoán | Thông tin chứng khoán được quản lý ra sao? |

Trong lộ trình này, ta học **thị trường thứ cấp**: nhà đầu tư mua/bán lại chứng khoán đã phát hành. Chi tiết quy định thực tế có thể khác theo thị trường và chính sách sản phẩm.

## Ba thực thể không được gộp làm một

| Khái niệm | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| Lệnh (`order`) | Yêu cầu mua/bán có khối lượng, giá và điều kiện | Mua 100 AAA, giá giới hạn 25.000 |
| Lần khớp (`execution`) | Một kết quả khớp cụ thể của lệnh | Khớp 40 AAA tại 24.900 |
| Thanh toán (`settlement`) | Thực hiện nghĩa vụ tiền và chứng khoán của phần đã khớp | Trả tiền, nhận chứng khoán theo chu kỳ áp dụng |

Một lệnh có thể có nhiều lần khớp. Một lệnh hủy vẫn có thể đã khớp một phần. Vì vậy, không dùng một nhãn “thành công” để thay cho toàn bộ hành trình.

## Tình huống xuyên suốt

Giả sử Lan có 10.000.000 VND khả dụng, gửi lệnh mua 100 AAA giá 25.000. Sau khi công ty chứng khoán chấp nhận, hệ thống giữ tối đa 2.500.000 VND. Thị trường khớp 40 cổ phiếu ở giá 24.900, rồi Lan hủy phần còn lại.

| Thời điểm | Sự kiện | Điều chắc chắn đúng |
| --- | --- | --- |
| T0 | Lan bấm Mua | Mới có ý định trên giao diện. |
| T1 | Công ty chứng khoán chấp nhận lệnh | Có lệnh đang hoạt động và tiền cần được giữ theo chính sách. |
| T2 | Khớp 40 tại 24.900 | Phát sinh giao dịch 996.000 VND và nghĩa vụ hậu giao dịch cho 40 cổ phiếu. |
| T3 | Hủy phần còn lại được xác nhận | Chỉ phần chưa khớp được giải phóng/đóng. |
| T4 | Thanh toán đến hạn | Nghĩa vụ của 40 cổ phiếu được thực hiện. |

## Góc nhìn fullstack

- **Frontend:** phân biệt “đã gửi”, “đã tiếp nhận”, “đã khớp” và “đã hủy”; không tự suy ra kết quả chỉ từ việc người dùng bấm nút.
- **Backend:** lưu được lệnh và các sự kiện riêng; xử lý phản hồi từ thị trường không theo giả định một lần là xong.
- **Dữ liệu:** định danh lệnh, lần khớp và nghĩa vụ cần khác nhau; giá/tiền/khối lượng có đơn vị rõ ràng.
- **Trạng thái:** một trạng thái tổng quan của lệnh không thay thế được lịch sử các sự kiện.

## Tự kiểm tra

1. Khi Lan nhận thông báo “hủy thành công”, có thể kết luận giao dịch bằng 0 không? Vì sao?
2. Giá trị tối đa giữ ban đầu là bao nhiêu? Giá trị phần đã khớp là bao nhiêu?
3. Liệt kê một thông tin frontend nên hiển thị là “đang chờ xác nhận”.

**Đáp án ngắn:** Không; 40 cổ phiếu đã khớp vẫn tồn tại. Số tiền là 2.500.000 VND và 996.000 VND. Ví dụ đang chờ là kết quả tiếp nhận/hủy từ hệ thống phía sau.

**Tham khảo tùy chọn:** [Ngày 1 — Nền móng](../archive/lo-trinh-28-ngay/ngay-01-nen-mong.md).
