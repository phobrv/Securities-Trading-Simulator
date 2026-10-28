# Securities Trading Simulator

Dự án được xây dựng nhằm giúp người học làm quen với các khái niệm cốt lõi của thị trường và giao dịch chứng khoán.

Thông qua việc mô phỏng các tình huống và quy trình giao dịch, người học có thể hiểu rõ hơn về cách thị trường vận hành, từ đó tự tin hơn khi tiếp cận các dự án trong lĩnh vực chứng khoán.

Dự án phục vụ mục đích học tập và không được sử dụng cho giao dịch thực tế hoặc làm cơ sở cho các quyết định đầu tư.

## Cấu trúc dự án

Dự án được chia thành hai phần bổ trợ cho nhau:

- **`p-docs/`** — Không gian tài liệu học tập. Thư mục `docs/` lưu lộ trình 28 buổi, bài học theo từng ngày và các nội dung tham khảo về khái niệm, quy ước và tình huống giao dịch.
- **`projects/`** — Không gian thực hành mô phỏng. Đây là nơi người học áp dụng kiến thức từ tài liệu vào các tình huống như theo dõi thị trường, quản lý thông tin chứng khoán, đặt lệnh và quản lý danh mục.

Người học nên theo trình tự: đọc bài học trong `p-docs/`, sau đó thực hành và quan sát kết quả mô phỏng trong `projects/`.

## Matching Simulator (Ngày 5)

Backend cung cấp mô phỏng sổ lệnh cho riêng `sec-001` (`SIMAAA`) trong phiên `CONTINUOUS`:

- `POST /api/simulator/orders` — gửi lệnh giới hạn `LO` mua hoặc bán.
- `GET /api/simulator/order-books/sec-001` — xem độ sâu sổ lệnh cộng gộp theo giá.
- `GET /api/simulator/executions?securityId=sec-001` — xem các lần khớp theo thứ tự tạo.

Ví dụ chạy demo trong phiên liên tục:

```dotenv
SIM_CLOCK_MODE=FIXED
SIM_NOW=2026-10-20T10:00:00+07:00
```

Matching Simulator chỉ phục vụ học tập: sổ lệnh và executions nằm trong bộ nhớ của một backend instance, nên sẽ mất khi backend khởi động lại. Chưa có settlement hoặc khôi phục sau sự cố.

## Tài khoản và tài sản khả dụng (Ngày 6)

Migration tạo hai tài khoản fixture độc lập `acc-001` và `acc-002`. Mỗi account là một tiểu khoản CASH, dùng VND và chưa có margin, phí, thuế hay ứng trước tiền bán.

- `GET /api/accounts/acc-001/balances` — đọc các thành phần tiền và tiền khả dụng.
- `GET /api/accounts/acc-001/positions` — đọc vị thế và lượng có thể bán.
- `POST /api/accounts/acc-001/availability-checks` — kiểm tra thử một yêu cầu BUY/SELL LO.

Khả dụng được tính khi đọc, không lưu thành một cột riêng:

```text
availableCash = settledCash - reservedCash - buyPayable - blockedCash
availableQuantity = settledQuantity - pendingSellQuantity
                    - activeReservedQuantity - blockedQuantity
```

`pendingReceivable` không tăng tiền khả dụng; `pendingBuyQuantity` không tăng lượng có thể bán. Tiền được trả trong JSON dưới dạng chuỗi số nguyên để không mất chính xác `bigint`.

Fixture `acc-001` có `availableCash = 6000000` và `sec-001` có `availableQuantity = 550`; reservation `RELEASED` không bị tính. Chạy migration từ `projects/backend/`:

```bash
npm run migration:run
```

Availability check chỉ đọc dữ liệu, không gửi lệnh, không giữ tài sản và không làm thay đổi số dư. Vì vậy kết quả preview không bảo đảm tài sản vẫn đủ khi có request đồng thời; thao tác kiểm tra và giữ nguyên tử sẽ được bổ sung ở các phần sau.

## Lộ trình học 4 tuần (28 buổi)

Mỗi tuần gồm 7 buổi. Nội dung đi từ kiến thức nền tảng đến quan sát và mô phỏng một quy trình giao dịch hoàn chỉnh.

### Tuần 1 — Nền tảng về thị trường chứng khoán

1. Tổng quan về thị trường chứng khoán và vai trò của các bên tham gia.
2. Khái niệm cổ phiếu, trái phiếu, chứng chỉ quỹ và các loại chứng khoán cơ bản.
3. Doanh nghiệp niêm yết, mã chứng khoán và sàn giao dịch.
4. Chỉ số thị trường và ý nghĩa của biến động chỉ số.
5. Giá tham chiếu, giá trần, giá sàn và biên độ dao động giá.
6. Khối lượng giao dịch, thanh khoản và cung cầu.
7. Ôn tập tuần 1 qua tình huống quan sát thị trường đơn giản.

### Tuần 2 — Cơ chế và quy tắc giao dịch

8. Tài khoản giao dịch, tiền mặt và danh mục đầu tư.
9. Lệnh mua, lệnh bán và vòng đời của một lệnh.
10. Các loại lệnh cơ bản và điều kiện khớp lệnh.
11. Nguyên tắc ưu tiên giá, ưu tiên thời gian và khớp lệnh.
12. Bảng giá chứng khoán: các trường thông tin cần đọc.
13. Phí giao dịch, thuế và cách tính giá trị giao dịch.
14. Ôn tập tuần 2 bằng bài tập đặt và theo dõi lệnh mô phỏng.

### Tuần 3 — Phân tích thông tin và quản trị rủi ro

15. Báo cáo tài chính: doanh thu, lợi nhuận, tài sản và nợ phải trả.
16. Các chỉ số cơ bản: EPS, P/E, P/B và cổ tức.
17. Thông tin doanh nghiệp, tin tức thị trường và sự kiện có thể ảnh hưởng đến giá.
18. Khái niệm phân tích cơ bản và mục đích sử dụng.
19. Khái niệm phân tích kỹ thuật: xu hướng, hỗ trợ và kháng cự.
20. Rủi ro thị trường, rủi ro thanh khoản và rủi ro thông tin.
21. Ôn tập tuần 3 bằng tình huống đánh giá một mã chứng khoán giả định.

### Tuần 4 — Thực hành mô phỏng giao dịch

22. Xây dựng mục tiêu học tập và quy tắc giao dịch cá nhân.
23. Lập danh mục mô phỏng và nguyên tắc phân bổ vốn.
24. Lập kế hoạch cho một giao dịch mua.
25. Theo dõi lệnh, trạng thái khớp lệnh và biến động danh mục.
26. Lập kế hoạch cho một giao dịch bán và ghi nhận kết quả.
27. Đánh giá hiệu quả giao dịch: lãi/lỗ, tỷ suất sinh lời và bài học rút ra.
28. Tổng kết: thực hành một chu trình giao dịch mô phỏng từ quan sát đến đánh giá.

## Dự án xuyên suốt

Trong toàn bộ quá trình học, người học thực hiện dự án **Danh mục đầu tư mô phỏng**. Dự án tái hiện hành trình cơ bản của một nhà đầu tư: tìm hiểu thị trường, lựa chọn mã chứng khoán, lập kế hoạch giao dịch, theo dõi danh mục và đánh giá kết quả.

Mục tiêu của dự án là vận dụng kiến thức của từng buổi học vào một bối cảnh thống nhất, thay vì học các khái niệm một cách rời rạc. Toàn bộ quyết định và kết quả trong dự án chỉ mang tính mô phỏng.

### Các mốc thực hiện

- **Tuần 1:** Chọn một số mã chứng khoán giả định để theo dõi; ghi nhận thông tin cơ bản, giá tham chiếu và biến động giá.
- **Tuần 2:** Thiết lập số vốn mô phỏng; thực hành ghi nhận lệnh mua, lệnh bán, trạng thái khớp lệnh, phí và số dư.
- **Tuần 3:** Phân tích thông tin doanh nghiệp, chỉ số cơ bản, tin tức và các rủi ro liên quan đến từng mã theo dõi.
- **Tuần 4:** Xây dựng danh mục, thực hiện các giao dịch mô phỏng, theo dõi biến động và tổng kết hiệu quả.

### Kết quả cần hoàn thành

Khi kết thúc dự án, người học có:

- Danh sách mã chứng khoán đã theo dõi cùng lý do lựa chọn.
- Nhật ký giao dịch mô phỏng, bao gồm quyết định mua/bán và kết quả khớp lệnh.
- Danh mục mô phỏng với số lượng nắm giữ, giá vốn, giá trị hiện tại và lãi/lỗ.
- Bản tổng kết nêu hiệu quả danh mục, các rủi ro đã gặp và bài học rút ra.

## Cấu trúc một buổi học

Mỗi buổi học có thể triển khai theo cấu trúc sau:

1. **Mục tiêu buổi học** — Xác định khái niệm hoặc kỹ năng cần nắm được.
2. **Khái niệm trọng tâm** — Giải thích thuật ngữ, nguyên tắc và bối cảnh sử dụng.
3. **Ví dụ hoặc tình huống** — Minh họa khái niệm bằng dữ liệu hay kịch bản mô phỏng.
4. **Thực hành** — Quan sát, phân tích hoặc thực hiện thao tác giao dịch mô phỏng.
5. **Câu hỏi tự kiểm tra** — Kiểm tra mức độ hiểu và khả năng áp dụng kiến thức.
6. **Tổng kết** — Ghi lại các điểm chính, thuật ngữ mới và nội dung cần ôn lại.
