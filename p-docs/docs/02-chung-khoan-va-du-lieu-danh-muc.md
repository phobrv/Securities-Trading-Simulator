# Buổi 2 — Chứng khoán và dữ liệu danh mục

## Cần hiểu sau buổi học

- Phân biệt loại chứng khoán, mã giao dịch và định danh ổn định.
- Biết dữ liệu nào thuộc danh mục chứng khoán, dữ liệu nào là giá thị trường hoặc tài sản khách hàng.
- Đọc một vị thế mà không nhầm mã, số lượng và giá trị.

## Ba lớp thông tin

| Lớp | Ví dụ | Thay đổi khi nào? |
| --- | --- | --- |
| Security Master | ID chứng khoán, loại tài sản, tổ chức phát hành, mệnh giá | Ít thay đổi, có kiểm soát. |
| Niêm yết/giao dịch | Mã hiển thị, thị trường, trạng thái giao dịch, lô | Có thể thay đổi theo nơi/đợt niêm yết. |
| Dữ liệu thị trường | Giá tham chiếu, giá khớp, dư mua/bán | Thay đổi liên tục theo phiên. |

`AAA` dễ nhớ cho con người, nhưng không nên mặc định nó là khóa bất biến cho mọi hệ thống. Một định danh nội bộ ổn định giúp liên kết dữ liệu khi mã hoặc thông tin niêm yết thay đổi.

## Loại tài sản trong phạm vi học

| Loại | Mô tả ngắn | Điểm cần hỏi khi làm sản phẩm |
| --- | --- | --- |
| Cổ phiếu | Phần sở hữu trong doanh nghiệp | Mã, lô, quyền giao dịch và trạng thái niêm yết là gì? |
| Trái phiếu | Công cụ nợ với đặc tính/kỳ hạn riêng | Đơn vị, lãi, đáo hạn và cách hiển thị có giống cổ phiếu không? |
| ETF | Chứng chỉ quỹ giao dịch trên thị trường | Dữ liệu quỹ và dữ liệu mã giao dịch được phân biệt thế nào? |

Không tự áp dụng quy tắc của cổ phiếu sang mọi loại tài sản. Nếu yêu cầu chỉ ghi “chứng khoán”, hãy hỏi loại sản phẩm nào đang được hỗ trợ.

## Ví dụ đọc dữ liệu

| Trường | Giá trị | Diễn giải |
| --- | --- | --- |
| `securityId` | `sec-001` | Định danh nội bộ ổn định. |
| `symbol` | AAA | Mã hiển thị trên bảng giá. |
| `assetType` | EQUITY | Cổ phiếu trong ví dụ học. |
| `lastPrice` | 24.900 VND | Giá của lần khớp gần nhất, không phải giá vốn của Lan. |
| `settledQuantity` | 200 | Số cổ phiếu đã thanh toán trong vị thế của Lan. |

Giá thị trường là dữ liệu dùng để định giá tại một thời điểm. Giá vốn là dữ liệu riêng của tài khoản, hình thành từ các giao dịch của tài khoản đó.

## Góc nhìn fullstack

- **Frontend:** dùng mã để nhận diện nhanh, nhưng hiển thị rõ loại tài sản, trạng thái giao dịch và thời điểm giá.
- **Backend:** tách dữ liệu danh mục dùng chung khỏi vị thế riêng của từng tài khoản.
- **Dữ liệu:** quy định đơn vị và độ chính xác cho giá, tiền, khối lượng; không suy đoán từ chuỗi hiển thị.
- **Trạng thái:** “đang giao dịch” của mã khác với “có thể bán” của vị thế khách hàng.

## Tự kiểm tra

1. Vì sao giá khớp gần nhất 24.900 không nói Lan đã mua với giá nào?
2. Nếu mã hiển thị đổi, dữ liệu lịch sử nên liên kết bằng gì?
3. Nêu một câu hỏi phải hỏi trước khi dùng chung form đặt lệnh cho cổ phiếu và trái phiếu.

**Đáp án ngắn:** Giá khớp là dữ liệu thị trường; Lan có thể có nhiều lần mua khác giá. Dùng định danh ổn định. Hỏi quy tắc đơn vị, phiên, lô và loại lệnh có giống nhau không.

**Tham khảo tùy chọn:** [Ngày 2 — Security Master](../archive/lo-trinh-28-ngay/ngay-02-security-master.md).
