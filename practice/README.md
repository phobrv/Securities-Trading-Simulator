# Luyện tập tự luận

Thư mục này chứa đề luyện tập, công cụ lưu bài làm và API cục bộ cho giao diện luyện tập trong `p-docs`. Việc chấm bài được thực hiện trong OpenCode theo rubric; CLI và API không tự gọi AI.

## Các bài hiện có

| Mã bài    | Nội dung        |
| --------- | --------------- |
| `01`      | Bài ngắn buổi 1 |
| `01-long` | Bài dài buổi 1  |
| `02`      | Bài buổi 2      |

Đề và rubric nằm trong `tests/`. Mỗi lượt lưu một bản sao đề, câu trả lời và các lần chấm trong SQLite. Mặc định database là `practice/practice.sqlite3`; có thể đặt biến môi trường `SECURITIES_PRACTICE_DB` để dùng đường dẫn khác. Dùng cùng đường dẫn cho CLI và API nếu muốn truy cập cùng dữ liệu.

## Làm bài với OpenCode

Mở OpenCode tại thư mục `p-docs`, sau đó:

1. Chạy `/practice 01`, `/practice 01-long` hoặc `/practice 02` để bắt đầu; ghi lại ID lượt được cấp.
2. Trả lời lần lượt các câu hỏi và xác nhận nộp sau khi hoàn thành. Có thể tiếp tục lượt chưa nộp bằng `/practice-resume ID`.
3. Chạy `/practice-grade ID` để chấm bài đã nộp, hoặc `/practice-result ID` để xem lại kết quả.

Sau khi nộp, câu trả lời không thể chỉnh sửa; muốn làm lại hãy tạo lượt mới. Có thể chấm lại và các lần chấm được giữ trong lịch sử. Chi tiết quy trình dành cho OpenCode có trong [WORKFLOW.md](WORKFLOW.md).

## Làm bài trên giao diện web

Từ thư mục gốc dự án, chạy API trong một terminal:

```bash
python3 practice/server.py
```

Trong terminal khác, chạy giao diện `p-docs`:

```bash
cd p-docs
npm install
npm run dev
```

Mở địa chỉ localhost do Vite hiển thị và chọn **Bài luyện tập**. API mặc định nghe tại `127.0.0.1:8765`; cần giữ cả API và Vite đang chạy. Sau khi nộp trên web, chạy `/practice-grade ID` trong OpenCode tại `p-docs`, rồi làm mới trang để xem kết quả. Xem thêm [hướng dẫn p-docs](../p-docs/README.md).

## Cấu trúc và kiểm thử

- `cli.py`: quản lý lượt làm bài và kết quả chấm qua JSON/SQLite.
- `server.py`: API cục bộ cho giao diện web.
- `tests/`: dữ liệu các đề luyện tập.
- `test_cli.py`, `test_server.py`: kiểm thử CLI và API.
- `AGENTS.md`: quy ước nội dung và hiển thị Markdown.

Chạy kiểm thử Python từ thư mục gốc dự án:

```bash
python3 -m unittest discover -s practice -p 'test_*.py'
```
