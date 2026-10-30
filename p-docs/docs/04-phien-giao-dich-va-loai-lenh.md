# Buổi 4 — Phiên giao dịch và loại lệnh

## Cần hiểu sau buổi học

- Ý nghĩa của phiên liên tục và phiên định kỳ trong tình huống học.
- Khác biệt cơ bản giữa LO, ATO và ATC.
- Một yêu cầu đặt lệnh phải qua những điều kiện nào trước khi được tiếp nhận.

## Phiên là một phần của điều kiện nghiệp vụ

| Phiên | Mô tả đơn giản | Ví dụ điều cần làm rõ |
| --- | --- | --- |
| Định kỳ mở cửa | Gom lệnh để xác định giá mở cửa theo quy tắc | Có nhận LO/ATO không, ưu tiên nào áp dụng? |
| Liên tục | Lệnh đến có thể khớp với lệnh chờ phù hợp | LO còn lại được giữ trên sổ ra sao? |
| Định kỳ đóng cửa | Gom lệnh để xác định giá đóng cửa theo quy tắc | ATO có còn hợp lệ không, ATC được tiếp nhận đến khi nào? |
| Ngoài giờ/đóng cửa | Không nhận loại lệnh thông thường | UI phải giải thích hay ẩn thao tác? |

Lịch, ngày nghỉ, giờ cắt và loại sản phẩm cần do nguồn cấu hình/chính sách đáng tin cậy quyết định. Không nên tự suy ra từ giờ trên thiết bị người dùng.

## Ba loại lệnh cần nhận diện

| Loại | Ý nghĩa ở mức khái niệm | Điều không nên tự giả định |
| --- | --- | --- |
| LO | Lệnh giới hạn: có mức giá xác định | Chắc chắn được khớp hoặc khớp đúng giá hiển thị. |
| ATO | Lệnh dùng trong giai đoạn xác định giá mở cửa | Giá cụ thể hoặc điều kiện áp dụng giống mọi thị trường. |
| ATC | Lệnh dùng trong giai đoạn xác định giá đóng cửa | Có thể gửi bất cứ lúc nào. |

## Kiểm tra tiếp nhận: đọc theo lớp

1. Người dùng có quyền dùng tài khoản/tiểu khoản này không?
2. Chứng khoán và loại lệnh có đang được phép giao dịch ở phiên này không?
3. Khối lượng, giá, bội số lô và giới hạn có hợp lệ theo chính sách không?
4. Tài sản khả dụng có đáp ứng không?
5. Yêu cầu này có phải bản gửi lại của cùng một ý định trước đó không?

Một yêu cầu qua các kiểm tra trên chỉ cho biết hệ thống công ty chứng khoán **tiếp nhận** nó. Đây chưa phải kết quả khớp lệnh.

## Bài tập tình huống

Ứng dụng hiển thị 14:29:59, nhưng backend đánh giá lệnh lúc 14:30:01 và phiên đã đóng. Người dùng nói “tôi đã bấm trước giờ”. Hãy ghi:

- dữ liệu thời gian nào cần xem;
- UI nên hiển thị điều gì khi chờ phản hồi;
- kết quả nghiệp vụ không được suy ra chỉ từ timestamp phía trình duyệt.

**Gợi ý đáp án:** dùng thời điểm nhận/đánh giá theo nguồn thời gian đáng tin cậy của hệ thống và quy tắc đã công bố; UI chỉ xác nhận “đã gửi” trước khi có kết quả; lưu định danh yêu cầu để truy vết.

**Tham khảo tùy chọn:** [Ngày 4 — Phiên giao dịch](../archive/lo-trinh-28-ngay/ngay-04-phien-giao-dich.md).
