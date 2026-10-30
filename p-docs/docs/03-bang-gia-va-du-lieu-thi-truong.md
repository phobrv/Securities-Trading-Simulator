# Buổi 3 — Bảng giá và dữ liệu thị trường

## Cần hiểu sau buổi học

- Đọc được giá tham chiếu, giá khớp, dư mua/bán và các loại khối lượng.
- Phân biệt ảnh chụp dữ liệu hiện thời (snapshot) với thay đổi tăng dần (delta).
- Không suy ra sai về giá có thể khớp từ một dòng bảng giá.

## Đọc một dòng bảng giá

| Thông tin | Giá trị giả định | Ý nghĩa |
| --- | ---: | --- |
| Giá tham chiếu | 25.000 | Mốc so sánh của phiên trong tình huống. |
| Giá khớp gần nhất | 25.100 | Giá của lần giao dịch gần nhất. |
| KL khớp gần nhất | 100 | Khối lượng của riêng lần khớp đó. |
| Tổng KL khớp | 400 | Tổng khối lượng đã khớp từ đầu phiên. |
| Mua tốt nhất | 25.000 / 500 | Nhu cầu mua đang chờ ở mức tốt nhất. |
| Bán tốt nhất | 25.200 / 300 | Chào bán đang chờ ở mức tốt nhất. |

Giá khớp gần nhất không phải lời hứa rằng lệnh mua mới sẽ khớp ở giá đó. Dư mua/bán là các lệnh đang chờ, có thể đổi trước khi lệnh của người dùng đến thị trường.

## Đơn vị và phép tính

Nếu có ba lần khớp: 100 × 25.000, 200 × 25.100, 100 × 25.200, tổng giá trị giao dịch là 10.040.000 VND. Không lấy giá khớp gần nhất 25.200 nhân với tổng khối lượng 400.

Trước khi so sánh số liệu, luôn hỏi:

- Giá đang hiển thị theo VND, nghìn đồng hay đơn vị khác?
- Khối lượng theo cổ phiếu, lô hay nghìn đơn vị?
- Thời điểm và thứ tự bản tin là gì?

## Snapshot, delta và trạng thái hiển thị

| Cách nhận dữ liệu | Ý nghĩa | Rủi ro cần nhận biết |
| --- | --- | --- |
| Snapshot | Một ảnh đầy đủ tại thời điểm A | Có thể cũ ngay khi vừa nhận. |
| Delta | Chỉ trường thay đổi sau A | Mất một bản tin có thể làm màn hình sai. |
| Resync | Lấy lại snapshot mới | Cần khi phát hiện thiếu/thứ tự không tin cậy. |

Frontend nên giữ thông tin về thời điểm hoặc số thứ tự dữ liệu nếu hợp đồng có cung cấp. Khi không chắc dữ liệu còn mới, hiển thị trạng thái “đang đồng bộ lại” tốt hơn là giữ vẻ chính xác giả tạo.

## Tự kiểm tra

1. Tổng khối lượng 400 và lần khớp gần nhất 100 có mâu thuẫn không?
2. Với giá mua tốt nhất 25.000 và bán tốt nhất 25.200, có thể kết luận ngay sẽ có khớp mới không?
3. Một delta đến trước snapshot dùng làm nền nên được xử lý thế nào ở mức sản phẩm?

**Đáp án ngắn:** Không; chúng đo hai tập khác nhau. Không; còn phụ thuộc lệnh đến sau và quy tắc khớp. Cần tránh dùng delta không có nền tin cậy và yêu cầu/tái lập đồng bộ theo hợp đồng hệ thống.

**Tham khảo tùy chọn:** [Ngày 3 — Market Data realtime](../archive/lo-trinh-28-ngay/ngay-03-market-data-realtime.md).
