# Hướng dẫn backend

## Mục tiêu ưu tiên

1. Mã dễ đọc, dễ thay đổi và dễ kiểm thử.
2. Mỗi hàm, lớp và tệp có một trách nhiệm rõ ràng.
3. Giữ thay đổi nhỏ, đúng phạm vi; không thêm abstraction hoặc dependency khi chưa cần thiết.

## Nền tảng và lệnh kiểm tra

- Dùng Node.js 20+, TypeScript strict và ESM (`.js` trong import nội bộ TypeScript).
- Stack hiện tại là Express 5, `mysql2/promise`, Jest và Supertest. Không thêm framework HTTP, ORM hoặc thư viện validation nếu chưa có nhu cầu rõ ràng.
- Sau thay đổi backend, chạy từ `projects/backend/`:

  ```bash
  npm test
  npm run build
  ```

## Cấu trúc và trách nhiệm

- Tổ chức tính năng theo nghiệp vụ trong `src/modules/<domain>/`; không biến `app.ts`, `server.ts` hoặc một router chung thành nơi chứa logic tính năng.
- `app.ts` chỉ lắp ghép middleware, router và dependency ở cấp ứng dụng. `server.ts` chỉ khởi động/dừng tiến trình.
- Route/controller chỉ nhận và kiểm tra dữ liệu HTTP, gọi một use case/service, rồi chuyển kết quả thành status code và response.
- Service chỉ điều phối một use case và quy tắc nghiệp vụ; không biết chi tiết Express, `Request` hay `Response`.
- Repository/infrastructure là nơi duy nhất truy cập MySQL hoặc I/O bên ngoài. Định nghĩa interface nhỏ ở ranh giới để service có thể test bằng fake.
- Đặt kiểu request/response, DTO và kiểu nghiệp vụ cạnh module sử dụng. Chỉ đưa vào mã dùng chung khi có từ hai module trở lên thực sự cần cùng một khái niệm.
- Chỉ tạo `shared`, `utils` hoặc `helpers` khi tên và trách nhiệm cụ thể hơn không phù hợp; không dùng chúng làm nơi chứa mã không biết đặt ở đâu.

## Hàm và tệp

- Đặt tên theo hành vi cụ thể (`createOrder`, `validateOrderInput`, `findSecurityBySymbol`), không dùng tên mơ hồ như `handle`, `process`, `data` nếu thiếu ngữ cảnh.
- Mỗi hàm làm một việc, trả về một kết quả có nghĩa; tách parsing, validation, truy vấn, tính toán và định dạng response khi chúng là các trách nhiệm khác nhau.
- Ưu tiên hàm thuần cho tính toán nghiệp vụ; truyền dependency qua constructor/tham số thay vì đọc global trực tiếp.
- Hàm dài quá khoảng 40 dòng hoặc nhiều nhánh độc lập là tín hiệu cần tách. Tệp dài quá khoảng 250 dòng là tín hiệu cần chia theo trách nhiệm. Đây là ngưỡng xem xét, không phải mục tiêu để chia nhỏ máy móc.
- Tránh class/generic/abstraction chỉ để dự phòng. Chỉ trích xuất khi nó giảm trùng lặp hoặc làm ranh giới trách nhiệm rõ hơn.

## API, dữ liệu và bảo mật

- Validate mọi input không tin cậy tại ranh giới HTTP trước khi gọi service. Response phải ổn định và không để lộ stack trace, SQL, cấu hình hoặc lỗi kết nối.
- Dùng middleware lỗi thống nhất; route async phải chuyển lỗi về middleware thay vì tự trả nhiều định dạng lỗi khác nhau.
- Dùng query có tham số, không ghép giá trị người dùng vào SQL. Dùng transaction cho thay đổi dữ liệu gồm nhiều bước cần nguyên tử.
- Đặt tiền tệ, giá, số lượng và thời gian bằng kiểu/đơn vị rõ ràng; không dùng `number` hoặc chuỗi mơ hồ cho dữ liệu giao dịch. Giữ quy ước hiện tại: VND, `VND_PER_SHARE`, ISO 8601 và `Asia/Ho_Chi_Minh`.
- Không commit secrets. Đọc cấu hình qua `env.ts`; khi thêm biến môi trường, validate nó và cập nhật `.env.example` không chứa secret thật.

## Kiểm thử

- Thêm hoặc cập nhật test khi thay đổi endpoint, quy tắc nghiệp vụ hoặc xử lý lỗi.
- Dùng Supertest cho hợp đồng HTTP và fake dependency qua interface cho unit test service. Không phụ thuộc MySQL cục bộ trong test mặc định.
- Test đường thành công, validation/lỗi nghiệp vụ và tình huống dependency thất bại; kiểm tra status code và response body quan sát được.
