# Buổi 11 — Ranh giới hệ thống và khả năng phục hồi

## Cần hiểu sau buổi học

- Mỗi dữ liệu cần có một chủ sở hữu và ranh giới ghi rõ ràng.
- Transaction nội bộ không tự giải quyết mọi lỗi giữa nhiều hệ thống.
- Sự kiện trùng, request đồng thời và dữ liệu realtime cũ là trạng thái bình thường cần thiết kế trước.

## Bản đồ trách nhiệm

| Module/miền | Sở hữu chính | Không nên tự quyết thay |
| --- | --- | --- |
| Market Data | Snapshot, delta, thời điểm/sequence dữ liệu thị trường | Trạng thái lệnh của khách hàng |
| OMS | Lệnh, lịch sử vòng đời, liên kết execution | Số dư được phép dùng nếu Accounts/Risk là nguồn sự thật |
| Accounts/Risk | Tiền, chứng khoán, khoản giữ, quyết định đủ điều kiện | Giá thị trường hay kết quả khớp ngoài hệ thống |
| Portfolio | Vị thế, giá vốn, định giá theo chính sách | Tự tạo execution mới để sửa số liệu |
| Settlement | Nghĩa vụ và trạng thái thanh toán | Đổi lịch sử khớp lệnh |

Ranh giới không có nghĩa các module không giao tiếp. Nó giúp trả lời: **ai được quyền ghi**, ai chỉ đọc bản sao, và khi dữ liệu lệch thì truy về đâu.

## Ba dạng “đúng một lần” cần phân biệt

| Vấn đề | Ví dụ | Biện pháp ở mức khái niệm |
| --- | --- | --- |
| Request trùng | Client retry tạo lệnh | Khóa idempotency gắn ý định người dùng. |
| Event trùng | Cùng execution được giao lại | Dùng định danh sự kiện và ghi nhận đã xử lý. |
| Xử lý đồng thời | Hai lệnh cùng dùng một khoản tiền | Kiểm tra và giữ tài sản trong vùng nhất quán có kiểm soát cạnh tranh. |

Không có một cờ “deduplicated” chung xử lý cả ba. Mỗi loại có định danh, thời điểm và chủ sở hữu khác nhau.

## Transactional outbox

Tình huống: hệ thống đã lưu execution và cập nhật tài sản, nhưng gặp lỗi trước khi gửi thông báo cho Portfolio. Nếu chỉ “lưu xong rồi gửi” theo hai bước độc lập, có thể mất thông báo. Transactional outbox là cách lưu bản ghi nghiệp vụ và một mục cần gửi trong cùng một giao dịch nội bộ; một tiến trình sau đó gửi lại mục chưa hoàn tất.

Outbox giảm nguy cơ **bỏ quên sự kiện**, không bảo đảm người nhận chỉ thấy một lần. Consumer vẫn cần chống xử lý trùng.

## Realtime: snapshot, delta và dữ liệu cũ

Một client nhận snapshot có sequence 100, sau đó cần áp delta 101, 102… Nếu nhận 103 trước 102, hoặc reconnect sau thời gian mất mạng, nó không nên tự ghép dữ liệu bằng suy đoán. Hành vi an toàn thường là phát hiện khoảng trống, đánh dấu dữ liệu chưa đồng bộ và lấy snapshot mới theo hợp đồng.

## Góc nhìn fullstack

- **Frontend:** cho người dùng thấy “đang đồng bộ” hoặc thời điểm dữ liệu khi tính mới không được bảo đảm.
- **Backend:** bảo toàn bất biến như “khả dụng không âm” dù request đến đồng thời.
- **Dữ liệu:** mang định danh lệnh, execution, event, phiên bản/thứ tự dữ liệu để truy vết và chống trùng.
- **Vận hành:** retry có thể xảy ra bất cứ lúc nào; đánh giá kết quả bằng dữ liệu cuối cùng và audit, không chỉ log “đã gọi”.

## Tự kiểm tra

1. Outbox có làm consumer không cần chống event trùng không?
2. Hai lệnh cùng nhìn thấy 10 triệu khả dụng rồi cùng muốn giữ 8 triệu: bất biến nào đang bị đe dọa?
3. Khi thiếu delta 102, client có nên áp 103 ngay không?

**Đáp án ngắn:** Không. Tổng phần giữ có thể vượt tiền và làm khả dụng âm. Không; cần cơ chế resync/đánh dấu chưa tin cậy theo hợp đồng.

**Tham khảo tùy chọn:** [Ngày 15 — Kiến trúc](../archive/lo-trinh-28-ngay/ngay-15-kien-truc-tong-the-va-quyen-so-huu-du-lieu.md), [Ngày 17 — Snapshot và delta](../archive/lo-trinh-28-ngay/ngay-17-snapshot-delta-va-khoi-phuc-websocket.md), [Ngày 18 — Sự kiện](../archive/lo-trinh-28-ngay/ngay-18-su-kien-nghiep-vu-retry-va-chong-xu-ly-trung.md), [Ngày 19 — Concurrency](../archive/lo-trinh-28-ngay/ngay-19-concurrency-va-chong-su-dung-tai-san-vuot-muc.md) và [Ngày 20 — Transactional outbox](../archive/lo-trinh-28-ngay/ngay-20-transactional-outbox-khong-bo-quen-su-kien-sau-khi-commit.md).
