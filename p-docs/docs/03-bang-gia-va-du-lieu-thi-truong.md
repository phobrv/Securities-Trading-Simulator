# Buổi 3 — Bảng giá và dữ liệu thị trường

## 1. Mục tiêu và tiến độ

- Đọc được giá tham chiếu, giá khớp, dư mua/bán và các loại khối lượng.
- Phân biệt ảnh chụp dữ liệu hiện thời (snapshot) với thay đổi tăng dần (delta).
- Không suy ra sai về giá có thể khớp từ một dòng bảng giá.

**Các mục sẽ học:** bảng giá; đơn vị và phép tính; snapshot và delta.

## 2. Kiến thức theo từng phần

### Đọc một dòng bảng giá

| Thông tin | Giá trị giả định | Ý nghĩa |
| --- | ---: | --- |
| Giá tham chiếu | 25.000 | Mốc so sánh của phiên trong tình huống. |
| Giá khớp gần nhất | 25.100 | Giá của lần giao dịch gần nhất. |
| KL khớp gần nhất | 100 | Khối lượng của riêng lần khớp đó. |
| Tổng KL khớp | 400 | Tổng khối lượng đã khớp từ đầu phiên. |
| Mua tốt nhất | 25.000 / 500 | Nhu cầu mua đang chờ ở mức tốt nhất. |
| Bán tốt nhất | 25.200 / 300 | Chào bán đang chờ ở mức tốt nhất. |

Giá khớp gần nhất không phải lời hứa rằng lệnh mua mới sẽ khớp ở giá đó. Dư mua/bán là các lệnh đang chờ, có thể đổi trước khi lệnh của người dùng đến thị trường.

### Đơn vị và phép tính

Nếu có ba lần khớp: 100 × 25.000, 200 × 25.100, 100 × 25.200, tổng giá trị giao dịch là 10.040.000 VND. Không lấy giá khớp gần nhất 25.200 nhân với tổng khối lượng 400.

Trước khi so sánh số liệu, luôn hỏi:

- Giá đang hiển thị theo VND, nghìn đồng hay đơn vị khác?
- Khối lượng theo cổ phiếu, lô hay nghìn đơn vị?
- Thời điểm và thứ tự bản tin là gì?

### Snapshot, delta và trạng thái hiển thị

| Cách nhận dữ liệu | Ý nghĩa | Rủi ro cần nhận biết |
| --- | --- | --- |
| Snapshot | Một ảnh đầy đủ tại thời điểm A | Có thể cũ ngay khi vừa nhận. |
| Delta | Chỉ trường thay đổi sau A | Mất một bản tin có thể làm màn hình sai. |
| Resync | Lấy lại snapshot mới | Cần khi phát hiện thiếu/thứ tự không tin cậy. |

Frontend nên giữ thông tin về thời điểm hoặc số thứ tự dữ liệu nếu hợp đồng có cung cấp. Khi không chắc dữ liệu còn mới, hiển thị trạng thái “đang đồng bộ lại” tốt hơn là giữ vẻ chính xác giả tạo.

## 3. Liên hệ fullstack

- **Frontend:** phân biệt giá chờ, giá khớp và trạng thái đồng bộ.
- **Backend:** cung cấp snapshot và delta theo hợp đồng dữ liệu.
- **Dữ liệu:** ghi rõ đơn vị, thời điểm và số thứ tự nếu có.
- **Trạng thái:** dữ liệu có thể cũ hoặc chưa đồng bộ dù kết nối còn mở.

## 4. Tình huống vận dụng

Dùng dòng bảng giá và các bản tin ở trên; chọn câu hỏi theo điểm còn vướng và chờ câu trả lời trước khi phản hồi.

1. Tổng khối lượng 400 và lần khớp gần nhất 100 có mâu thuẫn không?
2. Với giá mua tốt nhất 25.000 và bán tốt nhất 25.200, có thể kết luận ngay sẽ có khớp mới không?
3. Một delta đến trước snapshot dùng làm nền nên được xử lý thế nào ở mức sản phẩm?

## 5. Tổng kết và tiến độ

Nội dung chính: giá, khối lượng, đơn vị và đồng bộ dữ liệu. Ghi **đã trao đổi:** …; **còn vướng:** …; **đã được ghi nhận hoàn thành:** … . Không mặc định hoàn thành vì đã đọc. Tiếp theo: [Buổi 4](./04-phien-giao-dich-va-loai-lenh.md).

**Tham khảo tùy chọn:** [Ngày 3 — Market Data realtime](../archive/lo-trinh-28-ngay/ngay-03-market-data-realtime.md).
