# Quy ước nội dung luyện tập

- Nội dung câu hỏi phải được viết theo định dạng Markdown (`.md`). Nếu câu hỏi được lưu trong JSON hoặc định dạng dữ liệu khác, giá trị nội dung câu hỏi vẫn phải là văn bản Markdown hợp lệ.
- Phần hiển thị nội dung câu hỏi phải hỗ trợ render Markdown, bao gồm ít nhất đoạn văn, xuống dòng, danh sách, chữ đậm, chữ nghiêng và mã nội tuyến.
- Nội dung giải thích câu trả lời phải là văn bản Markdown hợp lệ, kể cả khi được lưu trong JSON hoặc định dạng dữ liệu khác.
- Phần hiển thị giải thích câu trả lời, bao gồm trong lịch sử chấm, phải hỗ trợ render Markdown với ít nhất đoạn văn, xuống dòng, danh sách, chữ đậm, chữ nghiêng và mã nội tuyến.
- Khi render Markdown, xử lý nội dung an toàn: không cho phép HTML hoặc liên kết độc hại thực thi trong giao diện.
- Khi thay đổi cách lưu hoặc hiển thị câu hỏi, giải thích câu trả lời hoặc lịch sử chấm, giữ tương thích với các bài và lượt luyện tập hiện có; bổ sung hoặc cập nhật kiểm thử cho các định dạng được hỗ trợ.
