# Ôn tập — Tình huống công việc fullstack

## Kịch bản xuyên suốt

Lan có 10.000.000 VND khả dụng. Cô gửi mua 100 AAA giá giới hạn 25.000. Lệnh được chấp nhận; 40 cổ phiếu khớp ở giá 24.900. Lan yêu cầu hủy 60 còn lại. Trong lúc yêu cầu hủy chờ xử lý, không có lần khớp thêm; sau đó việc hủy được xác nhận. Đến kỳ xử lý hậu giao dịch, 40 cổ phiếu đã khớp được thanh toán theo chính sách được cho.

Mọi con số dưới đây bỏ qua phí/thuế và chỉ dùng để ôn tập khái niệm.

## Bài 1 — Dựng timeline

Lập bảng của bạn trước, sau đó đối chiếu cấu trúc sau:

| Mốc | Sự kiện | Lệnh | Phần đã khớp | Phần còn hoạt động | Ý nghĩa tài sản |
| --- | --- | --- | ---: | ---: | --- |
| T0 | Gửi ý định | Chưa có kết quả | 0 | Chưa xác định | Không khẳng định giữ tiền. |
| T1 | Tiếp nhận | `NEW` | 0 | 100 | Giữ tối đa 2.500.000 theo giả định. |
| T2 | Execution 40 × 24.900 | `PARTIALLY_FILLED` | 40 | 60 | Phát sinh 996.000 nghĩa vụ tiền và 40 chứng khoán chờ. |
| T3 | Yêu cầu hủy | Vẫn `PARTIALLY_FILLED`, hủy đang chờ | 40 | 60 | Chưa giải phóng chỉ vì người dùng vừa bấm hủy. |
| T4 | Hủy xác nhận | `CANCELED` | 40 | 0 | Giải phóng phần giữ của 60 chưa khớp. |
| T5 | Thanh toán | Lệnh đã kết thúc | 40 | 0 | Hoàn tất nghĩa vụ của phần 40 theo chính sách. |

Nhận xét bắt buộc: `CANCELED` không đồng nghĩa toàn bộ 100 bị hủy; giá trị phần đã khớp là 996.000 VND, không phải 1.000.000 VND theo giá giới hạn.

## Bài 2 — Đọc một yêu cầu tính năng

Yêu cầu: “Thêm nút Hủy và hiển thị số tiền được hoàn ngay sau khi bấm.”

Hãy trả lời trước khi nhận triển khai:

| Chủ đề | Câu hỏi cần làm rõ |
| --- | --- |
| Trạng thái UI | Nút chuyển sang “đang hủy” hay “đã hủy”? Có cho gửi lại không? |
| Nghiệp vụ | Hủy toàn bộ phần còn lại hay cho hủy một phần? Lệnh có thể khớp khi chờ hủy không? |
| Tài sản | Phần nào được giải phóng khi có xác nhận? Có phí/thuế/chính sách giữ riêng không? |
| API/retry | Yêu cầu hủy có định danh/idempotency ra sao? Timeout được tra cứu thế nào? |
| Dữ liệu/audit | Cần lưu ai gửi, lúc nào, kết quả nào, liên kết với lệnh nào? |

Kết luận hợp lý thường là: UI có thể báo **đã gửi yêu cầu hủy**, nhưng chỉ hiển thị khoản giải phóng đã xác nhận theo nguồn sự thật; không cam kết “hoàn ngay” trước khi quy tắc và phản hồi được xác định.

## Bài 3 — Điều tra sự cố

Triệu chứng: bảng giá hiển thị 25.000 sau khi trước đó đã thấy 25.100; kết nối màn hình vẫn báo “online”.

| Giả thuyết | Bằng chứng cần kiểm tra | Hành động an toàn tạm thời |
| --- | --- | --- |
| Bản tin cũ đến muộn | sequence/timestamp snapshot và delta | Không áp dụng bản cũ; hiển thị đang đồng bộ nếu cần. |
| Mất delta rồi reconnect | khoảng sequence, log reconnect | Lấy snapshot mới theo giao thức. |
| Cache/UI ghi đè | nguồn payload, phiên bản client, thời điểm render | Khoanh phạm vi client và tránh khẳng định giá realtime. |
| Nguồn thị trường phát dữ liệu điều chỉnh | metadata/loại bản tin, thông báo vận hành | Tuân theo ngữ nghĩa nguồn dữ liệu, không tự bỏ qua. |

Không kết luận “WebSocket bị lỗi” chỉ vì UI online. Kết nối và tính mới/đủ của dữ liệu là hai thuộc tính khác nhau.

## Checklist trước giai đoạn thử việc

Bạn đã sẵn sàng thảo luận một ticket khi có thể:

- [ ] Phân biệt order, execution, nghĩa vụ và settlement.
- [ ] Diễn giải trạng thái lệnh có khớp một phần, chờ hủy và hủy xác nhận.
- [ ] Nói rõ dữ liệu thị trường, dữ liệu tài khoản và dữ liệu audit thuộc nguồn nào.
- [ ] Không gọi timeout là “thất bại chắc chắn” hay response HTTP là “đã khớp”.
- [ ] Hỏi chính sách trước khi tính sức mua, margin, giá vốn hoặc tài sản có thể bán.
- [ ] Dùng timeline, định danh và bút toán để kiểm tra một chênh lệch.
- [ ] Nêu được bất biến quan trọng: không dùng quá tài sản, không ghi nhận execution hai lần, không để dữ liệu realtime cũ ghi đè mới.

Nếu một mục chưa chắc, quay lại buổi liên quan và tự làm lại tình huống bằng bảng trạng thái. Khi vào môi trường thực tế, hãy thay giả định của tài liệu bằng quy định và hợp đồng dữ liệu của công ty.
