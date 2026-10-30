# Buổi 9 bổ sung — Danh mục, giá vốn và margin

## 1. Mục tiêu và tiến độ

Áp dụng các khái niệm buổi 9 vào một chính sách được cho trước. Bài này không dạy công thức margin thực tế; mục tiêu là đọc đúng giả định, tính nhất quán và biết chỗ nào phải hỏi lại.

**Các mục sẽ học:** chính sách giả định; giá vốn; sức mua; câu hỏi làm rõ yêu cầu.

## 2. Kiến thức theo từng phần

### Chính sách giả định cho bài tập

- Chỉ tính một mã AAA, không phí/thuế.
- Giá vốn bình quân gia quyền cho vị thế đang nắm.
- Giá trị tài sản bảo đảm được tính bằng giá thị trường × số lượng × 50%.
- Sức mua = tiền khả dụng + giá trị tài sản bảo đảm − dư nợ hiện hữu.
- Chỉ dùng số liệu sau khi đã xác định thời điểm giá và trạng thái tài sản hợp lệ.

Đây chỉ là chính sách học. Không dùng để suy ra điều kiện margin tại bất kỳ công ty nào.

### Ví dụ A — Giá vốn bình quân

Lan có 100 AAA giá vốn 24.000. Sau đó mua thêm 100 AAA giá 25.000; cả hai lô đã ở trạng thái được phép tính vào vị thế.

| Hạng mục | Phép tính | Kết quả |
| --- | --- | ---: |
| Tổng số lượng | 100 + 100 | 200 |
| Tổng chi phí | 100 × 24.000 + 100 × 25.000 | 4.900.000 |
| Giá vốn bình quân mới | 4.900.000 / 200 | 24.500 |

Nếu lô mua thứ hai mới khớp nhưng vẫn chờ thanh toán, chính sách sản phẩm phải nói rõ nó có được đưa vào màn hình nào: vị thế tổng, chờ về, giá vốn hay sức mua. Không tự đồng nhất chúng.

### Ví dụ B — Sức mua theo chính sách giả định

Lan có tiền khả dụng 1.000.000, 200 AAA hợp lệ làm tài sản bảo đảm, giá thị trường 25.000 và dư nợ 1.500.000.

| Thành phần | Phép tính | Giá trị |
| --- | --- | ---: |
| Tài sản bảo đảm | 200 × 25.000 × 50% | 2.500.000 |
| Sức mua | 1.000.000 + 2.500.000 − 1.500.000 | 2.000.000 |

Kết quả 2.000.000 chỉ đúng trong bốn giả định đầu bài. Nếu giá cập nhật cũ, AAA đang bị giữ để bán, hoặc tỷ lệ thay đổi theo mã, kết quả phải được đánh giá lại.

### Cách phân tích yêu cầu

Trước câu “hiển thị sức mua”, hãy tách:

| Cần chốt | Ví dụ câu hỏi |
| --- | --- |
| Phạm vi tài sản | Chứng khoán chờ về, đang giữ hay bị phong tỏa có được tính không? |
| Nguồn giá | Lấy giá nào, tại thời điểm nào, dữ liệu cũ hiển thị ra sao? |
| Chính sách | Tỷ lệ theo mã/nhóm/khách hàng? Có ngưỡng hay haircut không? |
| Khả năng giải thích | Có trả về từng thành phần và lý do từ chối không? |

## 3. Liên hệ fullstack

- **Frontend:** giải thích thành phần sức mua và thời điểm giá.
- **Backend:** áp dụng đúng chính sách và điều kiện tài sản.
- **Dữ liệu:** giữ nguồn giá, tỷ lệ, dư nợ và giá vốn rõ ràng.
- **Trạng thái:** phân biệt vị thế tổng với phần đủ điều kiện bảo đảm.

## 4. Tình huống vận dụng

Trong ví dụ B, giả sử toàn bộ AAA đang được giữ cho lệnh bán và chính sách chỉ tính phần khả dụng. Chọn điểm còn vướng; khi học tương tác, chờ câu trả lời trước khi phản hồi.

1. Nếu AAA bị giữ toàn bộ cho lệnh bán và chính sách chỉ tính phần khả dụng, có thể dùng ngay con số 2.500.000 không?
2. Nêu một lý do tại sao hai màn hình có thể hiển thị số lượng khác nhau mà chưa chắc hệ thống lỗi.

## 5. Tổng kết và tiến độ

Nội dung chính: giá vốn và sức mua theo giả định. Ghi **đã trao đổi:** …; **còn vướng:** …; **đã được ghi nhận hoàn thành:** … . Không mặc định hoàn thành vì đã đọc. Tiếp theo: [Buổi 10](./10-thanh-toan-va-doi-soat.md).
