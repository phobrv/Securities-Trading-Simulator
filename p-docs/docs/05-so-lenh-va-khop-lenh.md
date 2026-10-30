# Buổi 5 — Sổ lệnh và khớp lệnh

## Cần hiểu sau buổi học

- Sổ lệnh ghi các lệnh chờ, còn execution ghi các lần đã khớp.
- Áp dụng ưu tiên giá rồi thời gian vào một tình huống đơn giản.
- Tính được khối lượng đã khớp, còn lại và giá trị giao dịch.

## Quy tắc trực giác cần dùng

- Bên mua: giá cao hơn thường được ưu tiên trước; nếu cùng giá, lệnh đến trước được ưu tiên.
- Bên bán: giá thấp hơn thường được ưu tiên trước; nếu cùng giá, lệnh đến trước được ưu tiên.
- Khi giá mua và giá bán tương thích, một hoặc nhiều lần khớp có thể xuất hiện.

Đây là mô hình học tối giản. Cơ chế xác định giá và quy tắc thực tế thay đổi theo loại phiên, thị trường và chính sách áp dụng.

## Tình huống

Sổ bán đang có:

| Thứ tự đến | Giá bán | Khối lượng còn lại |
| --- | ---: | ---: |
| A | 24.900 | 30 |
| B | 25.000 | 50 |
| C | 25.000 | 40 |

Một lệnh mua LO 100 cổ phiếu giá 25.000 được gửi vào. Với giả định khớp theo thứ tự đang có, lệnh mua gặp A trước, rồi B, sau đó C.

| Lần khớp | Đối tác | Giá | Khối lượng | Giá trị |
| --- | --- | ---: | ---: | ---: |
| 1 | A | 24.900 | 30 | 747.000 |
| 2 | B | 25.000 | 50 | 1.250.000 |
| 3 | C | 25.000 | 20 | 500.000 |
| **Tổng** |  |  | **100** | **2.497.000** |

Lệnh mua đã khớp đủ; C còn 20 trên sổ. Nếu lệnh mua chỉ là 90, C còn 30 và lệnh mua không còn phần dư. Nếu chỉ có A và B, lệnh mua 100 sẽ khớp 80 và còn 20 chờ, nếu loại lệnh/chính sách cho phép.

## Góc nhìn fullstack

- **Frontend:** một dòng lệnh cần có tổng đặt, đã khớp, còn lại; bảng giá có thể chỉ là ảnh tham khảo trước khi đặt.
- **Backend:** lệnh và execution là hai dữ liệu riêng; tổng execution không được vượt tổng khối lượng lệnh.
- **Dữ liệu:** giá trị giao dịch là tổng của từng lần khớp, không phải một giá bình quân nhân bừa.
- **Trạng thái:** khớp một phần vẫn là lệnh hoạt động nếu còn phần chờ.

## Tự kiểm tra

1. Lệnh mua 120 trong tình huống trên khớp bao nhiêu, còn bao nhiêu?
2. Vì sao không được chỉ lưu một giá khớp cho toàn bộ lệnh 100?
3. Khi hủy lệnh khớp 80 trên tổng 100, phần nào có thể bị hủy?

**Đáp án ngắn:** khớp 120 nếu tổng bán 120; trong bảng này tổng là 120 nên hết. Có nhiều lần khớp với giá khác nhau. Chỉ 20 chưa khớp được hủy.

**Tham khảo tùy chọn:** [Ngày 5 — Sổ lệnh và khớp lệnh](../archive/lo-trinh-28-ngay/ngay-05-so-lenh-va-khop-lenh.md).
