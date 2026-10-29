# Stocknotes — Flashcard chứng khoán

Ứng dụng Vue 3 + TypeScript + Tailwind CSS để ôn tập kiến thức từ `p-docs/docs/`. Nội dung chỉ phục vụ học tập; các quy tắc giả lập không thay thế quy định thị trường hoặc tư vấn đầu tư.

## Chạy và build

Yêu cầu Node.js 20 trở lên và npm:

```bash
cd flashcards
npm ci
npm run dev
```

Chạy `npm run build` để tạo trang tĩnh trong `dist/`, hoặc `npm run preview` để xem bản build. Không cần backend. Tiến độ được lưu trong localStorage của trình duyệt, riêng cho từng origin và thiết bị; xóa dữ liệu trình duyệt sẽ xóa tiến độ.

## Triển khai GitHub Pages

Ứng dụng dùng `base: './'` để các tài nguyên chạy được cả dưới đường dẫn repository, ví dụ `https://<user>.github.io/<repo>/`. GitHub Pages không tự build mã Vue khi chọn một thư mục mã nguồn. Một cách triển khai bằng GitHub Actions:

1. Trong **Settings → Pages → Build and deployment**, chọn **GitHub Actions**.
2. Tạo workflow trong `.github/workflows/` ở thư mục gốc repository với nội dung bên dưới. Workflow chạy khi push lên nhánh `main`; đổi tên nhánh nếu cần.
3. Sau khi workflow thành công, mở URL được GitHub Pages cung cấp.

```yaml
name: Deploy flashcards
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: flashcards/package-lock.json
      - run: npm ci
        working-directory: flashcards
      - run: npm run build
        working-directory: flashcards
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: flashcards/dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Nội dung và thao tác

Các thẻ được biên soạn thủ công trong `src/cards.ts`, với ID ổn định để giữ tiến độ và tên tệp nguồn cho từng thẻ. Lọc theo chủ đề hoặc trạng thái, tìm kiếm, xáo trộn, nhấn thẻ để lật và đánh dấu tiến độ. Dùng phím mũi tên để chuyển thẻ và phím cách để lật khi không đang thao tác với điều khiển khác.
