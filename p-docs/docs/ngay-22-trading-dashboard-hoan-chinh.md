# Ngày 22 — Trading Dashboard hoàn chỉnh

Hôm nay bạn ghép các chức năng đã xây thành một màn hình giao dịch:

> **Xem giá → chọn tài khoản → nhập lệnh → theo dõi trạng thái → kiểm tra tiền và danh mục.**

Trọng tâm là giao diện phản ánh đúng backend, có loading và lỗi rõ ràng, đồng thời không làm người dùng hiểu nhầm “đã gửi” thành “đã khớp”.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Thông tin cần trước và sau giao dịch | Hiểu cách trình bày trạng thái |
| 30 phút kỹ thuật | Component, state và liên kết API | Có cấu trúc frontend rõ ràng |
| 30–60 phút thực hành | Ghép dashboard và kiểm tra thao tác | Giao dịch được trên một màn hình |

**Sản phẩm cuối buổi gồm:**

- `QuoteBoard`
- `OrderEntry`
- `OrderList`
- `BalancePanel`
- `PortfolioPanel`
- Trạng thái phiên và kết nối dữ liệu.
- Chi tiết timeline của một lệnh.

Bài bắt buộc dùng **BUY LO với `sec-001`**. Chỉ bật SELL nếu backend đã có đầy đủ luồng giữ chứng khoán và xử lý tài sản tương ứng.

---

## 2. Nghiệp vụ — thông tin người dùng cần thấy

### 2.1. Trước khi đặt lệnh

| Thông tin | Mục đích |
|---|---|
| Tài khoản đang chọn | Tránh giao dịch nhầm tài khoản |
| Mã và thị trường | Tránh nhầm chứng khoán cùng symbol |
| Trạng thái chứng khoán và phiên | Biết điều kiện giao dịch hiện tại |
| Giá và dư mua/bán | Quan sát thị trường |
| Tiền khả dụng | Hiểu nguồn lực hiện tại |
| Giá trị lệnh dự kiến | Kiểm tra trước khi gửi |
| Tình trạng dữ liệu | Biết bảng giá đã đồng bộ hay chưa |

Phân biệt:

```text
Giá trị dự kiến của LO = giá giới hạn × khối lượng.
```

với giá trị khớp thực tế sau này.

### 2.2. Sau khi gửi

| Trạng thái backend | Nhãn gợi ý |
|---|---|
| `PENDING_NEW` | Đã ghi nhận yêu cầu |
| `NEW` | Đã được chấp nhận |
| `PARTIALLY_FILLED` | Khớp một phần |
| `FILLED` | Đã khớp toàn bộ |
| `CANCELED` | Đã hủy phần còn lại |
| `REJECTED` | Bị từ chối |

Trạng thái yêu cầu hủy hiển thị riêng:

```text
Đang chờ phản hồi hủy.
```

Không thay trạng thái chính thành “Đã hủy” chỉ vì người dùng vừa nhấn nút.

### 2.3. Trình bày khối lượng rõ ràng

Ví dụ lệnh mua 100, khớp40 rồi hủy60:

```text
Đặt: 100
Đã khớp: 40
Đang chờ: 0
Đã hủy: 60
```

Không chỉ hiện:

```text
CANCELED
```

vì người dùng có thể hiểu nhầm toàn bộ lệnh chưa từng khớp.

---

## 3. Bố cục dashboard

| Vùng | Nội dung |
|---|---|
| Thanh trên | Người dùng, tài khoản, phiên, kết nối |
| Bảng giá | Mã, giá, dư mua/bán, khối lượng |
| Form lệnh | Mã, BUY, LO, giá, số lượng, giá trị dự kiến |
| Danh sách lệnh | Trạng thái, khớp, còn lại, hủy |
| Số dư | Tiền khả dụng, tiền giữ, nghĩa vụ mua |
| Danh mục | Lượng kinh tế, lượng có thể bán, giá vốn, P&L |
| Chi tiết lệnh | Timeline và các thông tin liên quan |

Không cần xây biểu đồ giá hoặc nhiều trang trong ngày 22.

Các nút vận hành như tạo execution giả lập, thay Clock hoặc chạy settlement không nằm trong thao tác khách hàng thông thường.

---

## 4. Tách ba nhóm state

Trong Vue, dùng `computed` cho dữ liệu suy ra thay vì sao chép vào reactive state giúp tránh state trùng lặp, dư thừa hoặc mâu thuẫn. Điều này đặc biệt hữu ích với giao diện giao dịch có nhiều trạng thái liên quan. [Vue](https://vuejs.org/guide/essentials/computed.html)

### 4.1. Server state

Dữ liệu backend quản lý:

```text
Danh mục chứng khoán.
Phiên.
Số dư.
Vị thế và danh mục.
Lệnh và timeline.
```

Frontend không tự sửa số dư hoặc khối lượng khớp để đoán kết quả.

### 4.2. Form state

Dữ liệu người dùng đang nhập:

```ts
type OrderDraft = {
  securityId: string;
  side: "BUY";
  orderType: "LO";
  priceInput: string;
  quantityInput: string;
};
```

Giữ input dạng chuỗi để xử lý được ô trống và trạng thái đang nhập. Chỉ parse sau khi kiểm tra định dạng.

Không tự cập nhật giá trong form theo mọi tick mới. Người dùng đã nhập giá thì giá đó phải ổn định cho đến khi họ chủ động sửa.

### 4.3. Connection và submission state

Kết nối quote tiếp tục dùng cơ chế ngày 17.

Trạng thái gửi lệnh có thể là:

```ts
type SubmissionState =
  | "IDLE"
  | "SUBMITTING"
  | "ACKNOWLEDGED"
  | "REJECTED"
  | "UNKNOWN";
```

`UNKNOWN` dùng khi chưa xác định được kết quả, chẳng hạn timeout.

Không gộp trạng thái form với trạng thái của order:

```text
Form đã gửi xong.
Order vẫn PENDING_NEW.
```

Hai điều này có thể đồng thời đúng.

---

## 5. Component và cấu trúc frontend

```text
src/features/trading/
  TradingDashboard.vue

  components/
    AccountSelector.vue
    SessionBanner.vue
    QuoteBoard.vue
    OrderEntry.vue
    OrderList.vue
    OrderDetails.vue
    BalancePanel.vue
    PortfolioPanel.vue

  composables/
    useAccountBalances.ts
    useAccountPortfolio.ts
    useAccountOrders.ts
    useSubmitOrder.ts
    useCancelOrder.ts

  api/
    trading.api.ts

  types/
    trading.types.ts
```

Dùng lại thư viện và cơ chế quản lý dữ liệu hiện có. Chưa cần thêm một thư viện state chỉ vì dashboard có nhiều panel.

Dùng Tailwind CSS trong template của các Vue SFC cho bố cục, khoảng cách, màu trạng thái và responsive. Computed/composable chịu trách nhiệm dữ liệu; không đưa quy tắc nghiệp vụ vào class CSS.

**Trách nhiệm chính:**

| Component | Không nên tự làm |
|---|---|
| QuoteBoard | Tự mở thêm publisher hoặc tạo tick |
| OrderEntry | Tự trừ tiền tài khoản |
| OrderList | Tự kết luận lệnh đã hủy |
| BalancePanel | Cộng thêm sức mua margin giả lập |
| PortfolioPanel | Ghi giá vốn hoặc sửa positions |

---

## 6. Liên kết API

| Chức năng | API |
|---|---|
| Tài khoản được phép xem | `GET /api/me/accounts` |
| Chứng khoán | `GET /api/securities` |
| Phiên | `GET /api/markets/:marketCode/session` |
| Bảng giá | Snapshot và WebSocket ngày 17 |
| Tiền | `GET /api/accounts/:id/balances` |
| Danh mục | `GET /api/accounts/:id/portfolio` |
| Đặt lệnh | `POST /api/orders` |
| Chi tiết lệnh | `GET /api/orders/:id` |
| Yêu cầu hủy | `POST /api/orders/:id/cancel` |

Nếu chưa có API danh sách lệnh, bổ sung một API đọc tối thiểu:

```http
GET /api/accounts/:id/orders?limit=50
```

Yêu cầu:

- Kiểm tra `ACCOUNT_READ`.
- Giới hạn số bản ghi.
- Sắp xếp ổn định theo thời điểm và ID.
- Chỉ trả lệnh của tài khoản được phép truy cập.
- Có `version` trong dữ liệu lệnh để hỗ trợ tránh ghi đè bằng trạng thái cũ.

Timeline có thể tải khi mở chi tiết, không cần tải toàn bộ timeline của mọi lệnh cùng lúc.

---

## 7. Luồng đặt lệnh trên giao diện

### 7.1. Kiểm tra trước khi gửi

Frontend kiểm tra:

- Đã chọn tài khoản.
- Có quyền TRADE.
- Chứng khoán và thị trường được hỗ trợ.
- Giá và số lượng hợp lệ theo phạm vi demo.
- Form không đang gửi.
- Các dữ liệu bắt buộc đã tải thành công.

Đây là kiểm tra hỗ trợ trải nghiệm. Backend vẫn quyết định cuối cùng.

Giá trị dự kiến tính bằng số nguyên chính xác:

```text
estimatedValue = price × quantity
```

Không đưa tiền chuỗi từ API qua `Number()` một cách tùy tiện nếu có thể vượt giới hạn số nguyên an toàn.

### 7.2. Khi nhấn gửi

1. Chụp payload cố định, gồm accountId và securityId.
2. Tạo Idempotency-Key cho ý định đó.
3. Khóa nút gửi và các trường liên quan khi request đang chạy.
4. Gọi API.
5. Hiển thị đúng kết quả.
6. Đọc lại lệnh và làm mới số dư liên quan.

Không để callback lấy `selectedAccountId` mới sau khi request đã gửi cho tài khoản cũ.

### 7.3. Sau HTTP 202

Hiển thị:

```text
Đã ghi nhận yêu cầu đặt lệnh.
```

Sau đó đọc trạng thái hiện tại:

```http
GET /api/orders/:id
```

Làm mới:

```text
OrderList.
BalancePanel.
PortfolioPanel khi cần.
```

Nếu chưa có kênh sự kiện tài khoản, có thể dùng polling có giới hạn và cleanup. Không tự đưa dữ liệu tài khoản vào WebSocket quote công khai.

### 7.4. Khi timeout

Chuyển sang `UNKNOWN`:

```text
Chưa xác định được kết quả yêu cầu.
```

Giữ lại payload và khóa của ý định đó; không biến lần thử tiếp theo thành ý định mới.

Ngày 23 sẽ đào sâu khôi phục ý định khi reload và retry từ giao diện. Trong ngày 22, không tự động gửi lại bằng khóa mới.

---

## 8. Luồng hủy trên giao diện

Chỉ hiển thị thao tác phù hợp với:

- Quyền TRADE.
- Trạng thái `NEW` hoặc `PARTIALLY_FILLED`.
- Chưa có yêu cầu hủy đang chờ.

Khi gửi:

```text
Tạo khóa cho ý định hủy.
Gửi API.
Hiển thị “Đang chờ phản hồi hủy”.
Đọc lại trạng thái backend.
```

Không làm ngay:

```ts
order.status = "CANCELED";
```

Backend có thể nhận thêm execution trong lúc chờ.

Nếu lệnh cuối cùng:

```text
filled = 60
canceled = 40
```

UI phải hiển thị đúng hai con số đó.

---

## 9. Loading, lỗi và dữ liệu thiếu

Mỗi panel có trạng thái riêng:

```text
LOADING
READY
EMPTY
ERROR
```

| Tình huống | Hiển thị |
|---|---|
| Chưa tải số dư | Loading |
| Số dư bằng 0 | 0 đồng |
| API số dư lỗi | Lỗi tải số dư |
| Chưa có vị thế | Chưa có chứng khoán |
| Không có quote | `—` |
| Thiếu giá vốn | Chưa có dữ liệu giá vốn |
| Token hết hạn | Yêu cầu đăng nhập lại |
| Không có quyền | Thông báo phù hợp, không lộ dữ liệu |

Không thay lỗi API bằng số 0. Người dùng có thể hiểu sai rằng tài khoản hết tiền hoặc không có tài sản.

Nếu giữ dữ liệu cũ trong khi refresh, cần ghi rõ đang cập nhật hoặc dữ liệu chưa được xác minh lại.

---

## 10. Đổi tài khoản và tránh response cũ

Tình huống:

```text
Đang tải số dư A.
Người dùng chọn B.
Response B về.
Response A về sau.
```

Không được để số dư A hiển thị dưới tiêu đề tài khoản B.

Cách xử lý:

- Key dữ liệu theo `userId + accountId`.
- Hủy request không còn cần bằng `AbortController`.
- Kiểm tra account/generation trước khi áp dụng response.
- Xóa dữ liệu riêng tư khi logout hoặc đổi người dùng.
- Không chỉ đổi tiêu đề tài khoản nhưng giữ nguyên số liệu.

Trong Vue, dùng `onUnmounted` và cleanup của watcher khi dependency đổi để dọn request, subscription và timer tương ứng. [Vue](https://vuejs.org/guide/essentials/lifecycle.html)

---

## 11. Bài thực hành — 30–60 phút

Dùng fixture mới hoặc fixture được xác nhận đang ở trạng thái đầu kỳ:

```text
Tiền đầu kỳ: 10 triệu.
Vị thế: 0.
Membership TRADE.
Phiên CONTINUOUS.
```

Thanh khoản giả lập:

```text
SELL40 @24.900.
SELL60 @25.100.
```

Thực hiện trên UI:

1. Đăng nhập và chọn tài khoản.
2. Xem tiền khả dụng 10 triệu.
3. Chọn `sec-001`, BUY100 LO25.000.
4. Gửi lệnh.
5. Theo dõi khớp40, còn60.
6. Xem tiền giữ1,5 triệu, payable996 nghìn.
7. Gửi yêu cầu hủy.
8. Xác nhận UI chuyển từ chờ hủy sang đã hủy phần còn lại.
9. Xem tiền khả dụng9.004.000.
10. Xem danh mục có40 mua chờ nhận, giá vốn24.900.

Settlement có thể chạy bằng công cụ vận hành đã có. Không thêm nút cho khách hàng tự chuyển ngày hoặc tự xác nhận thanh toán.

---

## 12. Kiểm thử giao diện quan trọng

| Kiểm thử | Điều cần chứng minh |
|---|---|
| Nhấn gửi liên tiếp | Một submission đang xử lý, backend vẫn chống trùng |
| Backend trả202 | UI không báo đã khớp |
| Backend từ chối | Hiển thị reason code/message phù hợp |
| Timeout | Không báo chắc chắn thất bại hoặc tạo khóa mới |
| Yêu cầu hủy | Chưa hiển thị canceled ngay |
| Đổi tài khoản nhanh | Không hiển thị số liệu chéo |
| Response order cũ đến muộn | Không làm trạng thái mới lùi |
| READ-only | Đọc được, không thao tác giao dịch |
| Token hết hạn | Không tiếp tục hiển thị phiên như còn hợp lệ |
| Quote mất delta | Giữ cơ chế sync ngày17 |
| Reload/hai tab | Không tự phát sinh lệnh |

Ưu tiên kiểm thử hành vi tại các điểm rủi ro. Không cần viết test chỉ để kiểm tra component render đúng từng thẻ HTML.

---

## 13. Prompt cho OpenCode

```text
Tôi đang học ngày22 của Securities Trading Simulator:
Trading Dashboard hoàn chỉnh.

Môi trường:
- Vue 3 + TypeScript + Tailwind CSS.
- Node.js + TypeScript, MySQL, Redis.
- OpenCode, cấu hình model hiện tại.
- Giữ API, auth, idempotency và quote sync đã có.

Trước khi code:
1. Đọc frontend và API thực tế.
2. Xác định component/composable có thể dùng lại.
3. Liệt kê endpoint còn thiếu.
4. Chọn phạm vi30–60 phút, không đổi stack hoặc thêm
   thư viện state nếu chưa cần.

Phạm vi:
- Một dashboard.
- BUY LO cho sec-001.
- Chỉ bật SELL nếu backend đã có đầy đủ luồng tài sản.
- Không đưa margin simulation vào tiền khả dụng.
- Không thêm biểu đồ giá hoặc nhiều trang.

Component:
- AccountSelector.
- SessionBanner và trạng thái quote connection/sync.
- QuoteBoard.
- OrderEntry.
- OrderList và OrderDetails/timeline.
- BalancePanel.
- PortfolioPanel.

State:
- Tách server data, form draft và submission/connection state.
- Input giá/quantity là chuỗi, validate trước parse.
- Không lưu trùng các giá trị suy ra không cần thiết.
- Data theo userId/accountId.
- Không dùng response account cũ cho account mới.
- Abort request cũ và kiểm tra generation/account.
- Logout đổi user phải xóa dữ liệu riêng tư.

API:
- Dùng /api/me/accounts.
- Bảo toàn authorization backend.
- Nếu thiếu GET /api/accounts/:id/orders,
  thêm read endpoint có ACCOUNT_READ, limit và sort ổn định.
- Lấy Portfolio API nguồn hiện tại,
  không tự thay bằng projection thử nghiệm ngày18.

Submit:
- Chụp payload cố định và tạo Idempotency-Key theo ý định.
- Khóa nút và trường liên quan khi đang gửi.
- AccountId của request không thay theo lựa chọn về sau.
- HTTP202 chỉ báo đã ghi nhận yêu cầu.
- GET order để lấy trạng thái mới.
- Refresh orders/balances/portfolio phù hợp.
- Không optimistic update tiền, filled hoặc order acceptance.
- Không tự đổi giá form theo mỗi tick.

Timeout:
- State UNKNOWN.
- Giữ payload/key trong bộ nhớ cho ý định hiện tại.
- Không tự retry bằng key mới.
- Chưa triển khai phục hồi qua reload; phần đó ngày23.
- Không cho UNKNOWN bị hiểu thành rejected.

Cancel:
- Chỉ cho thao tác theo quyền và trạng thái phù hợp.
- Dùng key riêng cho ý định hủy.
- Chỉ báo đang chờ phản hồi sau request.
- Không tự set CANCELED.
- Hiển thị filled/remaining/canceled riêng.

Data refresh:
- Dùng cơ chế hiện có.
- Nếu chưa có account event channel,
  polling có giới hạn/cleanup là đủ.
- Không đưa dữ liệu tài khoản vào public quote socket.
- Response order cũ không được ghi đè version mới.

UI:
- Loading/empty/error riêng từng panel.
- API lỗi không thay bằng0.
- Thiếu quote hoặc cost hiển thị rõ.
- Tiền API giữ chính xác, không tùy tiện Number().
- Session, connection và sync là thông tin khác nhau.
- Không có nút customer tự phát execution hoặc chạy settlement.

Fixture:
- Tài khoản mới10tr, OPENING ledger và TRADE membership.
- SELL40@24900 và SELL60@25100.
- UI BUY100 LO25000.
- Kỳ vọng partial40, remaining60,
  reserved1500000, payable996000, available7504000.
- Cancel confirm60:
  available9004000, pendingBuy40, cost996000.

Kiểm thử:
- Double submit.
- 202 không báo filled.
- Business rejection.
- Timeout UNKNOWN.
- Cancel pending.
- Account-switch response race.
- Read-only account.
- Auth expiry.
- Không có order do mount/reload/hai tab.
- Giữ quote sync ngày17 hoạt động.

Sau khi làm:
- Chạy kiểm tra phù hợp và báo kết quả thực tế.
- Cập nhật README chạy dashboard và kịch bản demo.
- Nêu phần đã nối API và phần còn là dữ liệu giả.
```

**Ngày 22 hoàn thành khi:**

- [ ] Các panel hoạt động trên một màn hình.
- [ ] Dữ liệu luôn gắn đúng người dùng và tài khoản.
- [ ] UI phân biệt đã gửi, đã nhận, đã khớp và đã hủy.
- [ ] Loading, lỗi và dữ liệu thiếu không bị nhầm thành số 0.
- [ ] Nhấn gửi hoặc hủy không tự suy diễn kết quả backend.
- [ ] Form và bảng giá không ghi đè trạng thái của nhau.

Ngày 23 sẽ đào sâu **tích hợp OMS từ giao diện**, đặc biệt là timeout, retry cùng khóa và khôi phục ý định khi người dùng reload trang.
