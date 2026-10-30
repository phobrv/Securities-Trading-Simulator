# Buổi 7 — OMS và vòng đời lệnh

## 1. Mục tiêu và tiến độ

- OMS trả lời “lệnh khách hàng đang ở đâu?”, khác với nơi tổ chức khớp.
- Trạng thái tổng quan và lịch sử sự kiện cùng cần thiết.
- Yêu cầu hủy là một quá trình; lệnh vẫn có thể khớp trong lúc chờ hủy.

**Các mục sẽ học:** trách nhiệm OMS; trạng thái lệnh; khớp trong khi chờ hủy.

## 2. Kiến thức theo từng phần

### OMS nằm ở đâu?

| Thành phần | Câu hỏi nó chịu trách nhiệm |
| --- | --- |
| OMS | Lệnh đã được nhận, chấp nhận, khớp, hủy hay từ chối thế nào? |
| Matching/đối tác thị trường | Lệnh nào gặp nhau và tạo ra lần khớp nào? |
| Tài khoản/risk | Có đủ tài sản, quyền và điều kiện để tiếp nhận không? |
| Thanh toán | Nghĩa vụ của phần đã khớp được hoàn tất ra sao? |

OMS có thể đã lưu một yêu cầu nhưng chưa có xác nhận từ thị trường. Vì vậy “đã có bản ghi lệnh” không đồng nghĩa “lệnh đang giao dịch”.

### Một state machine tối giản

| Trạng thái lệnh | Ý nghĩa |
| --- | --- |
| `PENDING_NEW` | Đã nhận ý định, đang chờ kết quả tiếp nhận. |
| `NEW` | Đã được chấp nhận, chưa có lần khớp. |
| `PARTIALLY_FILLED` | Đã khớp một phần và còn phần hoạt động. |
| `FILLED` | Đã khớp hết. |
| `CANCELED` | Phần chưa khớp đã được hủy xác nhận. |
| `REJECTED` | Không được chấp nhận để trở thành lệnh hoạt động. |

Trạng thái lệnh không đủ để mô tả mọi thứ. Ví dụ, việc người dùng vừa gửi yêu cầu hủy có thể là trạng thái phụ `cancelPending`; kết quả cuối vẫn chưa biết.

### Ví dụ “hủy nhưng vẫn khớp”

| Thời điểm | Sự kiện | Đã khớp | Còn lại | Cách nói đúng trên UI |
| --- | --- | ---: | ---: | --- |
| 10:00:00 | Lệnh mua 100 được chấp nhận | 0 | 100 | Đang chờ khớp |
| 10:00:01 | Khớp 40 | 40 | 60 | Khớp một phần |
| 10:00:02 | Người dùng gửi hủy | 40 | 60 | Đã gửi yêu cầu hủy, chờ xác nhận |
| 10:00:03 | Khớp thêm 20 | 60 | 40 | Khớp thêm trong khi chờ hủy |
| 10:00:04 | Hủy được xác nhận | 60 | 0 | Đã hủy phần còn lại 40 |

Kết quả cuối là 60 đã khớp và 40 đã hủy. Không được sửa lịch sử để biến 60 đã khớp thành 40 chỉ vì người dùng đã từng muốn hủy 60.

## 3. Liên hệ fullstack

- **Frontend:** tách nút “đã gửi hủy” khỏi nhãn “đã hủy”; hiển thị đã khớp/còn lại không chỉ trạng thái cuối.
- **Backend:** duy trì chuyển trạng thái hợp lệ và ghi sự kiện theo thứ tự/timestamp nhận được.
- **Dữ liệu:** `quantity`, `filledQuantity`, `canceledQuantity` cần đối chiếu được; số còn lại không âm.
- **Trạng thái:** trạng thái tổng hợp có thể được tính từ sự kiện, nhưng sự kiện là bằng chứng để giải thích tranh chấp.

## 4. Tình huống vận dụng

Dựa vào timeline khớp và hủy ở trên, chọn điểm còn vướng; khi học tương tác, chờ câu trả lời trước khi phản hồi.

1. Lệnh `CANCELED` có thể có `filledQuantity > 0` không?
2. Khi nào frontend được đổi nhãn từ “đang hủy” thành “đã hủy”?
3. Hai dữ liệu nào cần xem trước khi kết luận lệnh hủy sai?

## 5. Tổng kết và tiến độ

Nội dung chính: trạng thái lệnh, sự kiện khớp và hủy. Ghi **đã trao đổi:** …; **còn vướng:** …; **đã được ghi nhận hoàn thành:** … . Không mặc định hoàn thành vì đã đọc. Tiếp theo: [Buổi 8](./08-tu-giao-dien-den-xu-ly-lenh.md).

**Tham khảo tùy chọn:** [Ngày 8 — OMS và vòng đời lệnh](../archive/lo-trinh-28-ngay/ngay-08-oms-va-vong-doi-lenh.md).
