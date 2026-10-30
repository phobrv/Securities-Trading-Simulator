# Lộ trình học — Nghiệp vụ chứng khoán cho dev fullstack

## Đích đến

Sau khoảng 20 ngày linh hoạt, bạn có thể theo dõi một giao dịch mua/bán từ lúc người dùng bấm nút đến khi thanh toán; phân biệt dữ liệu thị trường, lệnh, lần khớp và tài sản; đồng thời trao đổi rõ ràng với BA, QA, vận hành và developer khác.

Khóa học gồm 12 buổi chính và 2 buổi bổ sung. Mỗi buổi độc lập tương đối, nhưng nên học theo thứ tự vì các tình huống sau dùng lại khái niệm trước đó.

## Phần 1 — Nền tảng thị trường

| Buổi | Chủ đề | Trọng tâm |
| --- | --- | --- |
| [1](./01-buc-tranh-thi-truong-va-hanh-trinh-giao-dich.md) | Bức tranh thị trường và hành trình giao dịch | Các bên, thị trường thứ cấp, lệnh, lần khớp, thanh toán. |
| [2](./02-chung-khoan-va-du-lieu-danh-muc.md) | Chứng khoán và dữ liệu danh mục | Cổ phiếu, trái phiếu, ETF; định danh, giá và vị thế. |
| [3](./03-bang-gia-va-du-lieu-thi-truong.md) | Bảng giá và dữ liệu thị trường | Giá, dư mua/bán, khối lượng; snapshot và đơn vị dữ liệu. |
| [4](./04-phien-giao-dich-va-loai-lenh.md) | Phiên giao dịch và loại lệnh | Phiên liên tục/định kỳ, LO/ATO/ATC, điều kiện tiếp nhận. |
| [5](./05-so-lenh-va-khop-lenh.md) | Sổ lệnh và khớp lệnh | Ưu tiên giá-thời gian, khớp một phần và phần còn lại. |
| [6](./06-tai-khoan-va-tai-san-kha-dung.md) | Tài khoản và tài sản khả dụng | Tiểu khoản, tài sản tổng, chờ/đang giữ, tiền mua và chứng khoán bán được. |

## Phần 2 — Hệ thống giao dịch và tài sản

| Buổi | Chủ đề | Trọng tâm |
| --- | --- | --- |
| [7](./07-oms-va-vong-doi-lenh.md) | OMS và vòng đời lệnh | Trạng thái, sự kiện, khớp, hủy và khớp trong lúc chờ hủy. |
| [8](./08-tu-giao-dien-den-xu-ly-lenh.md) | Từ giao diện đến xử lý lệnh | Ý định, xác nhận, UI state, API, retry, timeout và idempotency. |
| [9](./09-giu-tai-san-danh-muc-va-suc-mua.md) | Giữ tài sản, danh mục và sức mua | Khoản giữ, sổ cái, vị thế, giá vốn, lãi lỗ và margin. |
| [9 bổ sung](./09-bo-sung-danh-muc-gia-von-va-margin.md) | Danh mục, giá vốn và margin | Áp dụng chính sách được cho vào tình huống mới. |
| [10](./10-thanh-toan-va-doi-soat.md) | Thanh toán và đối soát | Nghĩa vụ tiền/chứng khoán, tài sản chờ và phát hiện sai lệch. |

## Phần 3 — Độ tin cậy và công việc fullstack

| Buổi | Chủ đề | Trọng tâm |
| --- | --- | --- |
| [11](./11-ranh-gioi-he-thong-va-kha-nang-phuc-hoi.md) | Ranh giới hệ thống và khả năng phục hồi | Trách nhiệm module, phân quyền, concurrency, event trùng, outbox, realtime. |
| [11 bổ sung](./11-bo-sung-nhat-quan-va-phuc-hoi-he-thong.md) | Nhất quán và phục hồi hệ thống | Phân tích cạnh tranh, event trùng và dữ liệu realtime cũ. |
| [12](./12-truy-vet-va-dieu-tra-su-co.md) | Truy vết và điều tra sự cố | Timeline, log, audit, định danh và kiểm chứng giả thuyết. |
| [Ôn tập](./on-tap-va-tinh-huong-cong-viec.md) | Ôn tập và tình huống công việc | Luồng mua → khớp một phần → hủy → thanh toán; đọc yêu cầu và điều tra sự cố. |

## Nhịp học gợi ý

- Khoảng 20 ngày là ước tính chung; thời lượng mỗi buổi chưa ấn định. Điều chỉnh nhịp học theo tiến độ và những điểm còn vướng.
- Buổi bổ sung nên học sau khi đã trao đổi nội dung của buổi chính tương ứng; quay lại buổi chính nếu còn vướng.
- Mỗi buổi theo [khung học năm phần](./README.md), không cần viết code. Khi học tương tác, người hướng dẫn chờ bạn trả lời tình huống trước khi phản hồi.
- Không cố suy luận quy tắc thị trường thực tế từ tình huống đơn giản hóa. Khi vào việc, luôn kiểm tra chính sách sản phẩm, quy định hiện hành và nguồn dữ liệu chính thức của công ty.

## Bằng chứng hoàn thành

Không mặc định một mục đã hoàn thành chỉ vì đã đọc hoặc được trình bày. Sau khi trao đổi, ghi riêng nội dung đã trao đổi, còn vướng và những mục đã được người học/người hướng dẫn xác nhận hoàn thành. Có thể dùng các năng lực sau làm bằng chứng, không cần code:

1. Vẽ timeline và bảng trạng thái của một lệnh khớp một phần rồi hủy.
2. Giải thích vì sao tổng tài sản, tài sản khả dụng và tài sản chờ không giống nhau.
3. Nêu điều frontend được phép khẳng định và điều phải chờ xác nhận từ backend/thị trường.
4. Đặt câu hỏi đúng khi số liệu, sự kiện hoặc dữ liệu realtime mâu thuẫn nhau.

Để đào sâu một thuật ngữ kỹ thuật, xem bộ [tham khảo 28 ngày](../archive/lo-trinh-28-ngay/lo-trinh-28-ngay.md); việc đó là tùy chọn.
