# Hướng dẫn frontend

## Mục tiêu ưu tiên

1. Mã dễ đọc, dễ thay đổi và dễ kiểm thử.
2. Mỗi component, composable, hàm và tệp có một trách nhiệm rõ ràng.
3. Giữ giao diện nhất quán, accessible và responsive mà không thêm độ phức tạp không cần thiết.

## Nền tảng và lệnh kiểm tra

- Bắt buộc dùng Vue 3, TypeScript, Vite và Tailwind CSS. Không thêm React, JSX/TSX hoặc dependency dành riêng cho React.
- Dùng Vue Single-File Components với `<script setup lang="ts">` và Composition API.
- Sau thay đổi frontend, chạy từ `projects/frontend/`:

  ```bash
  npm run build
  ```

## Cấu trúc và trách nhiệm

- Tổ chức theo tính năng khi ứng dụng phát triển: component đặc thù tính năng đặt cạnh feature; component tái sử dụng thật sự đặt trong `src/components/`.
- Component chỉ chịu trách nhiệm render, nhận props, phát emit và điều phối tương tác UI. Tách logic trạng thái hoặc luồng tái sử dụng sang `src/composables/`.
- Tập trung gọi HTTP, cấu hình base URL, mapping DTO và lỗi API vào `src/services/` hoặc `src/api/`. Không rải `fetch` và kiểu response API trong nhiều component.
- Đặt kiểu API/kiểu nghiệp vụ cạnh feature; chỉ chuyển sang `src/types/` khi được dùng bởi từ hai nơi trở lên.
- `main.ts` chỉ bootstrap ứng dụng. CSS global chỉ dành cho reset, token/theme và quy tắc toàn cục; ưu tiên Tailwind cho style theo component.
- Không tạo `utils`, `helpers` hoặc component dùng chung quá sớm. Mã chỉ trở thành dùng chung khi có nhu cầu thực tế ở ít nhất hai nơi.

## Hàm, composable và component

- Dùng `type` rõ ràng cho props, emits, dữ liệu API và trạng thái; không dùng `any`. Ưu tiên union type cho các trạng thái hữu hạn như loading/success/error.
- Mỗi composable quản lý một luồng UI hoặc use case; trả về public API nhỏ và rõ ràng thay vì để component thao tác chi tiết nội bộ.
- Đặt tên theo mục đích (`useSystemOverview`, `formatVnd`, `OrderForm`), không dùng tên chung chung như `handle`, `process` hoặc `data` nếu thiếu ngữ cảnh.
- Hiển thị trạng thái loading, empty, error và success một cách tường minh; không im lặng nuốt lỗi hoặc chỉ log lỗi rồi để UI ở trạng thái mơ hồ.
- Hàm/composable dài quá khoảng 40 dòng hoặc có nhiều trách nhiệm là tín hiệu cần tách. Component dài quá khoảng 200 dòng là tín hiệu tách component con hoặc composable. Đây là ngưỡng xem xét, không phải lý do để chia nhỏ máy móc.
- Tránh state toàn cục, watcher và lifecycle hook khi computed property, props/emits hoặc composable cục bộ đã đủ.

## API, UX và khả năng truy cập

- Đọc biến môi trường client qua `import.meta.env.VITE_*`; không đưa secret vào frontend. Cập nhật `.env.example` khi thêm biến môi trường công khai.
- Kiểm tra `response.ok`, xử lý lỗi mạng và chuyển DTO bên ngoài thành dữ liệu phù hợp với UI trong service/composable.
- Không để component phụ thuộc trực tiếp vào chi tiết endpoint hoặc định dạng response có thể thay đổi.
- Dùng HTML semantic; input phải có label, button có tên/hành vi rõ ràng và thao tác chính dùng được bằng bàn phím.
- Giữ tương phản màu, focus state, thông báo lỗi và vùng trạng thái dễ nhận biết. Bố cục mới phải dùng được từ màn hình nhỏ trở lên.
- Không dùng `v-html` với dữ liệu không tin cậy. Escape/nội suy mặc định của Vue là lựa chọn chuẩn.

## Quy tắc thay đổi

- Giữ thay đổi nhỏ, đúng phạm vi; không chỉnh sửa mã hoặc lockfile không liên quan.
- Không thêm dependency khi Vue, TypeScript, browser API hoặc Tailwind hiện có đáp ứng tốt yêu cầu.
- Khi thay đổi hành vi hiển thị hoặc dữ liệu, xác nhận các trạng thái loading, error, empty và success vẫn hợp lý, rồi chạy build trước khi hoàn tất.
