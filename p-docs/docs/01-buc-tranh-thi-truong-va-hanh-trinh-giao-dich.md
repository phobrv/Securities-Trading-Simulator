# Buổi 1 — Bức tranh thị trường và hành trình giao dịch

## 1. Mục tiêu và tiến độ

Sau buổi này, bạn có thể giải thích vai trò các bên trong giao dịch cổ phiếu thứ cấp và các bước chính từ đặt lệnh đến thanh toán.

Hai mục kiến thức của buổi học:

1. Các bên tham gia và thị trường thứ cấp.
2. Phân biệt lệnh, lần khớp và thanh toán trong một giao dịch.

Bạn có thể dừng lại hỏi ở bất kỳ phần nào; không cần viết code.

## 2. Kiến thức theo từng phần

### 2.1. Các bên tham gia

| Bên | Vai trò cần nắm |
| --- | --- |
| Nhà đầu tư | Đưa ra yêu cầu mua hoặc bán chứng khoán. |
| Công ty phát hành | Phát hành chứng khoán; không mặc nhiên là bên bán trong mọi giao dịch cổ phiếu của mình. |
| Công ty chứng khoán | Cung cấp dịch vụ cho nhà đầu tư, tiếp nhận và xử lý yêu cầu giao dịch. |
| Sở giao dịch chứng khoán | Tổ chức giao dịch và thực hiện khớp lệnh theo cơ chế áp dụng. |
| VSDC và các bên liên quan | Tham gia lưu ký, bù trừ và thanh toán theo vai trò của từng bên. |

### 2.2. Thị trường thứ cấp và ranh giới vai trò

Phát hành chứng khoán khác với việc mua bán lại chứng khoán đã phát hành trên **thị trường thứ cấp**. Trong giao dịch thứ cấp thông thường, nhà đầu tư bán cho nhà đầu tư khác; công ty chứng khoán cung cấp dịch vụ trung gian, không mặc nhiên là bên mua hoặc bên bán.

Ví dụ đơn giản hóa: Bình bán cổ phiếu công ty An Phát đang nắm giữ; Chi mua số cổ phiếu đó. Bình là bên bán và nhận tiền bán sau thanh toán; An Phát không nhận tiền chỉ vì là công ty phát hành. Trên thực tế, Bình và Chi không nhất thiết biết danh tính hoặc trực tiếp lựa chọn nhau.

Sở giao dịch xử lý việc khớp theo cơ chế áp dụng. Sau khớp, các nghĩa vụ tiền và chứng khoán còn phải đi qua quá trình bù trừ, thanh toán với các bên liên quan. **Đã khớp không đồng nghĩa thanh toán đã hoàn tất.**

### 2.3. Hành trình và ba khái niệm

> Nhà đầu tư gửi yêu cầu → Công ty chứng khoán tiếp nhận và xử lý → Lệnh đi vào quy trình giao dịch → Có thể phát sinh một hoặc nhiều lần khớp → Bù trừ và thanh toán nghĩa vụ.

Đây là sơ đồ học tập; chi tiết phụ thuộc thị trường và hệ thống. Trạng thái lệnh và tài sản có thể được cập nhật ở nhiều bước liên quan, không chỉ sau thanh toán.

| Khái niệm | Câu hỏi cần trả lời |
| --- | --- |
| Lệnh | Nhà đầu tư yêu cầu mua hoặc bán gì, với điều kiện nào? |
| Lần khớp | Bao nhiêu chứng khoán đã khớp và tại mức giá nào? |
| Thanh toán | Nghĩa vụ chuyển tiền và chứng khoán sau giao dịch đã được xử lý đến đâu? |

Ví dụ: một lệnh mua 100 cổ phiếu mới khớp 40. Lệnh mua ban đầu, lần khớp 40 và trạng thái thanh toán của phần đã khớp là những thông tin cần theo dõi riêng.

## 3. Liên hệ fullstack

- **Frontend:** phân biệt yêu cầu đã gửi với kết quả được hệ thống xác nhận; hiển thị rõ trạng thái lệnh và tài sản.
- **Backend:** tiếp nhận, xử lý và cập nhật sự kiện giao dịch theo trách nhiệm của hệ thống.
- **Dữ liệu:** không gộp lệnh, các lần khớp và thanh toán thành một thông tin duy nhất.
- **Trạng thái:** “đã gửi”, “đã khớp” và “đã thanh toán” biểu thị các bước khác nhau.

Chi tiết OMS, API, retry và đối soát sẽ học ở những buổi sau.

## 4. Tình huống vận dụng

Trở lại ví dụ Bình bán cổ phiếu An Phát và Chi mua. Sau khi hai lệnh được khớp, hệ thống thông báo giao dịch đang chờ thanh toán.

Hãy giải thích ai là bên bán, ai là bên mua và ai nhận tiền bán; sau đó nêu vì sao thông báo “đã khớp” chưa có nghĩa các nghĩa vụ đã được thanh toán. Khi học tương tác, người hướng dẫn chọn điểm bạn còn vướng, đặt câu hỏi và **chờ bạn trả lời** trước khi phản hồi; không cần hỏi lại cùng một ý nhiều lần.

## 5. Tổng kết và tiến độ

- **Nội dung buổi học:** các bên và thị trường thứ cấp; lệnh, lần khớp và thanh toán.
- **Đã trao đổi:** ghi những mục thực sự đã thảo luận: …
- **Còn vướng:** ghi câu hỏi hoặc ví dụ cần xem lại: …
- **Đã được ghi nhận hoàn thành:** chỉ ghi sau khi đã giải thích và được xác nhận, không mặc định hoàn thành vì đã đọc: …
- **Tiếp theo:** [Buổi 2 — Chứng khoán và dữ liệu danh mục](./02-chung-khoan-va-du-lieu-danh-muc.md).

**Tham khảo tùy chọn:** [Ngày 1 — Nền móng](../archive/lo-trinh-28-ngay/ngay-01-nen-mong.md).
