# Buổi 11 bổ sung — Nhất quán và phục hồi hệ thống

## 1. Mục tiêu và tiến độ

Phân tích ba lỗi thường gặp mà không cần thiết kế code: tranh chấp tài sản, giao lại sự kiện và dữ liệu realtime cũ. Mỗi phần đều yêu cầu nêu **điều đã biết, điều chưa biết và bằng chứng cần kiểm tra**.

**Các mục sẽ học:** cạnh tranh tài sản; sự kiện trùng; dữ liệu realtime cũ và phục hồi.

## 2. Kiến thức theo từng phần

### Ví dụ A — Hai yêu cầu cạnh tranh

Tài khoản có 10.000.000 VND khả dụng. Gần như đồng thời, hai thiết bị gửi hai lệnh mua hợp lệ, mỗi lệnh cần giữ 7.000.000 VND.

| Cách nhìn sai | Vì sao sai |
| --- | --- |
| Mỗi request đọc 10 triệu, nên cả hai đều được nhận | Hai lần đọc không bảo đảm quyền dùng cùng một khoản tiền. |
| Từ chối cả hai luôn an toàn nhất | Có thể không cần thiết và làm sai kỳ vọng nghiệp vụ; cần chính sách xử lý đồng thời. |
| Chỉ hiển thị lỗi trên một thiết bị là đủ | Cần xác định lệnh nào thật sự được tiếp nhận/giữ và trạng thái cuối của cả hai. |

**Bất biến:** tổng tiền đã giữ cộng các nghĩa vụ theo cách tính chính sách không được làm phần khả dụng âm. Khi điều tra, cần các mốc nhận request, định danh lệnh, thứ tự/phiên bản số dư hoặc bút toán giữ tiền.

### Ví dụ B — Event execution giao hai lần

Portfolio nhận cùng một `executionId` hai lần vì worker retry. Nếu lần nào cũng cộng 40 AAA, vị thế tăng 80 trong khi OMS chỉ có một execution 40.

| Cần có | Lý do |
| --- | --- |
| Định danh sự kiện và execution ổn định | Nhận ra lần giao lại là cùng việc đã xảy ra. |
| Dấu vết đã xử lý theo consumer | Consumer biết mình đã cập nhật projection/bút toán đó. |
| Cách tra cứu nguồn gốc | Phân biệt event trùng với hai execution thật có cùng số lượng/giá. |

Đừng dùng thời gian nhận event làm khóa chống trùng: retry có thể đến sau và hai execution khác nhau cũng có thể cùng thời điểm gần nhau.

### Ví dụ C — Realtime quay ngược

Client đang hiển thị giá 25.100 tại sequence 205. Sau reconnect, một bản tin cũ sequence 203 đến muộn và mang giá 25.000. Nếu UI ghi đè vô điều kiện, người dùng thấy giá quay ngược.

Hãy nêu cách hiển thị an toàn:

1. so sánh thứ tự/phiên bản nếu giao thức cung cấp;
2. bỏ qua hoặc không áp dụng dữ liệu cũ theo quy tắc;
3. khi phát hiện khoảng trống, chuyển sang trạng thái cần đồng bộ lại thay vì tự dựng chuỗi;
4. hiển thị thời điểm/trạng thái đồng bộ phù hợp để người dùng không hiểu dữ liệu cũ là realtime.

### Khung phân tích phục hồi

| Câu hỏi | Ví dụ trả lời mong đợi |
| --- | --- |
| Bất biến nào có thể bị phá? | Khả dụng không âm; execution không ghi nhận hai lần; sequence không lùi. |
| Nguồn sự thật là gì? | Sổ cái/OMS/event log có định danh, không phải chỉ ảnh UI. |
| Có thể retry phần nào? | Retry giao event/tra cứu với cùng định danh; không tạo lại tùy tiện. |
| Cần kiểm chứng gì sau phục hồi? | Số dư, khoản giữ, vị thế, timeline và dữ liệu realtime đã resync. |

## 3. Liên hệ fullstack

- **Frontend:** hiển thị trạng thái đồng bộ thay vì khẳng định dữ liệu cũ là mới.
- **Backend:** bảo vệ tài sản khi xử lý đồng thời và event giao lại.
- **Dữ liệu:** đối chiếu định danh execution, bút toán và sequence.
- **Trạng thái:** kiểm tra kết quả phục hồi thay vì chỉ xem trạng thái kết nối.

## 4. Tình huống vận dụng

Chọn một trong ba ví dụ trên theo điểm còn vướng; khi học tương tác, chờ câu trả lời trước khi phản hồi.

1. Event trùng và hai execution hợp lệ giống nhau về số lượng khác nhau ở đâu?
2. Một connection realtime “đang mở” chứng minh bảng giá mới nhất không?
3. Tại sao phải kiểm tra số dư sau retry thay vì chỉ log retry thành công?

## 5. Tổng kết và tiến độ

Nội dung chính: bất biến, chống trùng và phục hồi dữ liệu. Ghi **đã trao đổi:** …; **còn vướng:** …; **đã được ghi nhận hoàn thành:** … . Không mặc định hoàn thành vì đã đọc. Tiếp theo: [Buổi 12](./12-truy-vet-va-dieu-tra-su-co.md).
