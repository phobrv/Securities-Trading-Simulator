# Ngày 23 — Tích hợp OMS từ giao diện: timeout, retry và khôi phục sau reload

Ngày 22 đã có dashboard và form đặt lệnh. Hôm nay bạn hoàn thiện tình huống dễ tạo giao dịch trùng:

> “Người dùng bấm đặt lệnh, chưa nhận được kết quả rồi reload trang. Làm sao ứng dụng tìm lại đúng yêu cầu cũ?”

Bạn sẽ nối **ý định trên frontend** với **idempotency của backend**, bảo đảm một lần thử lại không trở thành một lệnh mới ngoài ý muốn.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Ý định giao dịch, kết quả chưa xác định và retry | Biết khi nào được tạo yêu cầu mới |
| 30 phút kỹ thuật | Lưu intent, khôi phục và tra cứu kết quả | Có luồng xuyên frontend–backend |
| 30–60 phút thực hành | Timeout sau commit, reload và gửi lại | Một ý định chỉ tạo một lệnh |

**Sản phẩm cuối buổi:**

- Lưu khóa và payload trước khi gửi.
- Reload tìm lại được yêu cầu chưa rõ kết quả.
- Retry sử dụng đúng khóa và nội dung cũ.
- Không dùng response replay cũ để làm trạng thái lệnh lùi.
- Phân quyền vẫn được kiểm tra khi khôi phục.

Phạm vi bắt buộc tiếp tục là **BUY LO**. Chưa mở rộng nghiệp vụ tài sản mới.

---

## 2. Nghiệp vụ — một ý định khác nhiều lần gửi

### 2.1. Ba định danh cần nhớ

| Định danh | Đại diện cho | Khi retry |
|---|---|---|
| `requestId` | Một lần gọi HTTP | Thay đổi |
| `Idempotency-Key` | Một ý định thực hiện thao tác | Giữ nguyên |
| `orderId` | Lệnh đã được tạo | Giữ nguyên |

Ví dụ:

```text
Ý định: mua100 @25000.

Lần gửi1: req-A, key-K.
Lần gửi2: req-B, key-K.
Kết quả: cùng orderId.
```

Backend không biết hai request thuộc cùng ý định nếu frontend tự tạo khóa mới mỗi lần.

### 2.2. Khi nào tạo khóa mới?

| Tình huống | Khóa |
|---|---|
| Timeout rồi gửi lại | Giữ nguyên |
| Reload để tìm kết quả cũ | Giữ nguyên |
| Mất response nhưng backend có thể đã commit | Giữ nguyên |
| Đã xác định kết quả, người dùng chủ động đặt lệnh khác | Tạo mới |
| Người dùng sửa nội dung để tạo ý định mới | Tạo mới, sau khi xử lý rõ yêu cầu cũ |

Không cho phép sửa payload của một intent đang chưa rõ kết quả rồi gửi bằng khóa cũ.

Cũng không âm thầm tạo khóa mới để tránh lỗi `IDEMPOTENCY_KEY_REUSED`.

### 2.3. Đã nhận yêu cầu không phải đã khớp

Sau HTTP202, ý định đặt lệnh đã có kết quả tiếp nhận:

```text
orderId = ord-001.
```

Nhưng lệnh có thể tiếp tục:

```text
PENDING_NEW → NEW → PARTIALLY_FILLED → ...
```

Frontend cần quản lý riêng:

- Kết quả gửi yêu cầu.
- Trạng thái hiện tại của order.

---

## 3. Thiết kế Order Intent trên frontend

Đề xuất:

```ts
type OrderIntent = {
  schemaVersion: 1;

  intentId: string;
  ownerUserId: string;
  accountId: string;

  operation: "CREATE_ORDER";
  idempotencyKey: string;

  payload: {
    accountId: string;
    securityId: string;
    side: "BUY";
    orderType: "LO";
    price: number;
    quantity: number;
  };

  state:
    | "PREPARED"
    | "SUBMITTING"
    | "UNKNOWN"
    | "RECOVERING"
    | "ACKNOWLEDGED"
    | "REJECTED"
    | "CONFLICT";

  orderId: string | null;
  createdAt: string;
};
```

Các thời điểm frontend chỉ phục vụ hiển thị và điều phối client, không quyết định phiên hoặc quyền giao dịch.

**Quy tắc cốt lõi:**

```text
Intent đã tạo
→ Payload cố định
→ Key cố định
```

Nếu form tiếp tục cho nhập, đó phải là draft riêng, không làm thay đổi intent đã gửi.

---

## 4. Lưu intent trước khi gửi

Trong bài học, dùng `sessionStorage` để hỗ trợ reload cùng tab. MDN mô tả dữ liệu này tồn tại qua reload trong phiên trang và được phân chia theo origin và tab; đóng tab kết thúc phạm vi lưu trữ đó. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage?utm_source=chatgpt.com)

Đề xuất namespace:

```text
trading:order-intents:v1:<userId>
```

Chỉ lưu:

- Chủ thể của intent.
- Tài khoản.
- Khóa.
- Payload.
- Trạng thái gửi.
- OrderId nếu đã biết.

Không lưu access token hoặc mật khẩu cùng intent.

**Thứ tự đúng:**

```text
Validate form
→ Chụp payload
→ Tạo intent/key
→ Lưu intent thành công
→ Gửi HTTP
```

Không làm ngược:

```text
Gửi HTTP
→ Sau đó mới lưu key
```

Nếu reload xảy ra giữa hai bước, ứng dụng có thể mất định danh cần để tìm lại yêu cầu.

Nếu không lưu được intent, không gửi âm thầm rồi vẫn hứa có khả năng khôi phục sau reload.

Phạm vi hôm nay là khôi phục trong cùng tab. Chưa bảo đảm khôi phục sau đóng tab hoặc chuyển thiết bị.

---

## 5. Backend bổ sung API tra cứu kết quả yêu cầu

Ngày 9 đã có `idempotency_requests`. Ngày 23 tận dụng bảng này, không cần tạo một bảng order thứ hai.

Đề xuất:

```http
GET /api/accounts/:accountId/request-results/:idempotencyKey
    ?operation=CREATE_ORDER
```

Backend phải:

1. Xác thực người gọi.
2. Kiểm tra quyền đọc tài khoản hiện tại.
3. Tính scope từ user đã xác thực, tài khoản và operation.
4. Tra bản ghi idempotency đã commit.
5. Chỉ trả thông tin thuộc scope đó.

**Có kết quả:**

```json
{
  "data": {
    "resultState": "COMMITTED",
    "operation": "CREATE_ORDER",
    "orderId": "ord-001",
    "originalHttpStatus": 202
  }
}
```

Sau đó frontend gọi:

```http
GET /api/orders/ord-001
```

**Chưa thấy kết quả đã commit:**

```json
{
  "data": {
    "resultState": "NOT_FOUND"
  }
}
```

Điểm quan trọng:

```text
NOT_FOUND
không chứng minh
request cũ chưa từng đến backend.
```

Transaction cũ có thể còn đang chạy, hoặc chưa commit nên truy vấn này chưa nhìn thấy.

Không tự động biến kết quả đó thành “Lệnh thất bại”.

API tra cứu chỉ đọc; bản thân nó không tạo lệnh.

---

## 6. Luồng gửi lần đầu

**Bước 1 — Chuẩn bị**

Người dùng nhập:

```text
acc-023.
sec-001.
BUY100.
LO25000.
```

Frontend tạo và lưu intent.

**Bước 2 — Gửi**

```http
POST /api/orders
Idempotency-Key: <key-của-intent>
```

Trong lúc gửi:

- Khóa thao tác gửi trùng cho cùng intent.
- Giữ payload cố định.
- Không tự thay giá theo quote.
- Không thay accountId theo account selector mới.

Đừng chỉ dựa vào việc nút được disable sau render. Cần một guard đồng bộ hoặc single-flight trong lớp quản lý submission để hai thao tác sát nhau không tạo hai intent.

**Bước 3 — Nhận HTTP202**

```text
Lưu orderId vào intent.
Chuyển ACKNOWLEDGED.
Đọc trạng thái order hiện tại.
Refresh số dư và danh sách lệnh.
```

Nếu tải chi tiết order thất bại, vẫn giữ kết quả đã biết:

```text
Đã ghi nhận yêu cầu.
Chưa tải được trạng thái mới nhất.
```

Không chuyển ngược thành “Đặt lệnh thất bại”.

---

## 7. Luồng timeout và retry

Khi timeout hoặc mất kết nối trong lúc gửi:

```text
Intent → UNKNOWN.
Giữ key và payload.
```

UI:

```text
Chưa xác định được kết quả.
Bạn có thể kiểm tra lại yêu cầu.
```

Thao tác **“Kiểm tra kết quả”**:

1. Tra API request-results.
2. Nếu có orderId, đọc order.
3. Nếu chưa thấy kết quả, giữ trạng thái chưa xác định.

Thao tác **“Gửi lại cùng yêu cầu”**:

```text
POST cùng URL.
Cùng key.
Cùng payload đã lưu.
```

Đây có thể là lần đầu request thực sự được backend xử lý nếu lần trước chưa đến nơi. Vì vậy, không tự động POST chỉ vì người dùng mở lại trang.

Cơ chế retry bằng cùng khóa là cách các API idempotent nhận diện thao tác đã thực hiện và tránh tạo thêm đối tượng. Chính sách lưu lỗi hay thời hạn khóa vẫn phải theo backend của dự án, không sao chép mặc định từ dịch vụ khác. [docs.stripe.com](https://docs.stripe.com/api/idempotent_requests?utm_source=chatgpt.com)

---

## 8. Khôi phục sau reload

Auth ngày 16 đang lưu token trong bộ nhớ. Sau reload, có thể cần đăng nhập lại.

Luồng đúng:

```text
Reload
→ Xác thực lại nếu cần
→ Xác định user hiện tại
→ Đọc intent thuộc user đó
→ Kiểm tra schema và cấu trúc
→ Tra kết quả backend
→ Khôi phục orderId và trạng thái hiện tại
```

Nếu cần, bổ sung:

```http
GET /api/me
```

để frontend lấy userId từ phiên đã được backend xác thực.

**Quy tắc khôi phục:**

| Intent lưu trước reload | Sau reload |
|---|---|
| `SUBMITTING` | Xem như chưa rõ kết quả, bắt đầu kiểm tra |
| `UNKNOWN` | Tra kết quả |
| `ACKNOWLEDGED`, có orderId | Đọc order hiện tại |
| `CONFLICT` | Không tự gửi lại |
| Payload sai schema | Không gửi; báo lỗi dữ liệu lưu |

Không tự chạy `POST /api/orders` trong Effect khởi tạo trang.

Chỉ tự thực hiện những bước đọc để xác định kết quả. Gửi lại yêu cầu là một thao tác rõ ràng của người dùng trong phạm vi bài này.

---

## 9. Đăng nhập khác người dùng và thu hồi quyền

### 9.1. User B đăng nhập sau reload

Nếu intent thuộc A:

```text
Không hiển thị chi tiết intent của A trong phiên B.
Không dùng token B để retry.
Không đổi ownerUserId của intent thành B.
```

Namespace phía trình duyệt hỗ trợ tổ chức dữ liệu, nhưng không phải cơ chế bảo mật. Backend vẫn xác thực và phân quyền.

### 9.2. A bị thu hồi quyền

A có thể đã tạo lệnh thành công trước khi quyền bị thu hồi.

Khi tra cứu hoặc replay hiện bị từ chối:

```text
Không suy ra rằng lệnh cũ chưa được tạo.
Không tạo key mới.
Không tiếp tục retry bằng đường khác.
```

UI nên diễn đạt:

```text
Không thể xác minh kết quả do quyền truy cập hiện tại.
```

### 9.3. Token hết hạn

401 yêu cầu xác thực lại. Nó không đảo ngược giao dịch có thể đã commit từ trước.

Giữ riêng trạng thái xác thực và trạng thái kết quả intent.

---

## 10. Xử lý response mà không làm order lùi

Ví dụ:

```text
Request ban đầu trả PENDING_NEW.
Order hiện đã PARTIALLY_FILLED, version3.
Replay trả lại body PENDING_NEW ban đầu.
```

Không dùng body replay để ghi đè order đang hiển thị.

Cách xử lý:

```text
Replay giúp tìm orderId.
GET order giúp lấy trạng thái hiện tại.
```

Với dữ liệu order cùng ID:

- Không áp dụng response có version thấp hơn bản đã biết.
- Không so version giữa hai order khác nhau.
- Query cần gắn với userId và accountId.
- Callback từ phiên đăng nhập cũ không cập nhật giao diện phiên mới.

---

## 11. Bài thực hành chính

Tạo fixture mới:

```text
acc-023.
Tiền đầu kỳ10 triệu.
Có OPENING ledger.
Membership TRADE.
Không có thanh khoản bán.
```

Đặt:

```text
BUY100 @25000.
```

**Kịch bản A — timeout sau commit**

1. Lưu intent.
2. Backend commit order và khoản giữ.
3. Chặn response.
4. UI chuyển UNKNOWN.
5. Nhấn kiểm tra kết quả.
6. Tìm được orderId.

Kỳ vọng:

```text
Một order.
Một OrderReceived.
Một khoản giữ2.500.000.
Available cash7.500.000.
```

**Kịch bản B — reload trước khi có response**

1. Gửi request với cùng cơ chế gây chậm response.
2. Reload.
3. Đăng nhập lại đúng người dùng.
4. Khôi phục intent từ sessionStorage.
5. Tra kết quả.
6. Hiển thị đúng order.

Không có POST đặt lệnh mới tự phát sinh từ quá trình mount.

**Kịch bản C — request chưa đến backend**

1. Intent đã được lưu.
2. Chặn request trước khi backend nhận.
3. Reload và tra kết quả: NOT_FOUND.
4. UI chưa kết luận thất bại.
5. Người dùng chọn gửi lại cùng yêu cầu.

Kết quả: tạo đúng một lệnh bằng khóa ban đầu.

**Kịch bản D — đổi payload của intent cũ**

Cùng khóa nhưng quantity đổi thành200:

```text
409 IDEMPOTENCY_KEY_REUSED.
```

UI không tự chữa lỗi bằng cách tạo khóa khác và gửi ngay.

---

## 12. Kiểm thử và các lỗi debug

| Kiểm thử | Kết quả |
|---|---|
| Lưu intent trước gửi | Reload còn key/payload |
| Double-click sát nhau | Không tạo hai ý định ngoài ý muốn |
| Timeout sau commit | Khôi phục cùng orderId |
| Reload khi SUBMITTING | Kiểm tra lại, không treo “đang gửi” mãi |
| NOT_FOUND | Không coi là bằng chứng request chưa xử lý |
| Retry | Giữ nguyên payload và key |
| Replay body cũ | Không làm trạng thái order lùi |
| Đổi user | Không retry intent của user khác |
| Mất quyền | Không kết luận giao dịch cũ chưa tồn tại |
| Storage lỗi hoặc dữ liệu hỏng | Không âm thầm gửi yêu cầu mới |

**Debug A — Key được tạo trong hàm retry**

Mỗi lần gọi tạo UUID mới, nên backend thấy các ý định khác nhau.

Tạo key lúc tạo intent; retry chỉ đọc lại intent đã lưu.

**Debug B — Chỉ lưu draft**

Reload có giá và quantity nhưng mất key. Draft không đủ để tìm lại giao dịch.

Lưu cả intent bất biến.

**Debug C — Abort request được hiểu là hủy lệnh**

`AbortController` dừng việc chờ ở client; nó không chứng minh backend đã dừng hoặc rollback.

Hủy HTTP request và hủy order là hai thao tác khác nhau.

**Debug D — Mọi 4xx đều chuyển thành REJECTED**

Một 403/404 do mất quyền sau khi request cũ có thể đã commit không chứng minh lệnh chưa được tạo.

Xử lý theo mã lỗi và ngữ cảnh, không chỉ nhóm HTTP status.

---

## 13. Prompt cho OpenCode

```text
Tôi đang học ngày23 của Securities Trading Simulator:
Tích hợp OMS từ UI, timeout, retry và reload recovery.

Môi trường:
- Vue 3 + TypeScript + Tailwind CSS, Node.js + TypeScript, MySQL.
- OpenCode, cấu hình model hiện tại.
- Giữ dashboard, auth và idempotency đã có.

Trước khi code:
1. Đọc useSubmitOrder, API client và auth state.
2. Đọc scope/canonical hash/idempotency ngày9.
3. Kiểm tra cách lưu order theo version.
4. Đề xuất phạm vi30–60 phút.

Phạm vi:
- BUY LO.
- Khôi phục reload cùng tab bằng sessionStorage.
- Chưa refresh token, cross-device hoặc đóng tab recovery.
- Không đổi nghiệp vụ giữ tiền hoặc matching.

OrderIntent:
- schemaVersion, intentId, ownerUserId, accountId.
- operation CREATE_ORDER.
- idempotencyKey.
- Immutable payload.
- State PREPARED/SUBMITTING/UNKNOWN/RECOVERING/
  ACKNOWLEDGED/REJECTED/CONFLICT.
- orderId nullable và createdAt.
- Không lưu token/password.
- Namespace theo userId.

Submit:
- Validate và chụp payload.
- Tạo/lưu intent trước HTTP.
- Storage thất bại không được âm thầm gửi rồi hứa có recovery.
- Có synchronous guard/single-flight,
  không chỉ trông chờ nút disabled sau render.
- Không thay payload theo draft/account selector về sau.
- Timeout giữ UNKNOWN và key/payload.
- Không tạo key mới trong retry.
- 202 lưu orderId rồi GET trạng thái mới.
- GET order lỗi không biến create đã acknowledged thành rejected.

Backend lookup:
GET /api/accounts/:id/request-results/:key
?operation=CREATE_ORDER.
- Authenticate và ACCOUNT_READ trước.
- Scope lấy userId từ principal, accountId, operation.
- Có result đã commit trả COMMITTED, orderId, originalHttpStatus.
- Chưa thấy trả NOT_FOUND trong authorized scope.
- NOT_FOUND không chứng minh request cũ chưa đến hoặc chưa chạy.
- Không lộ response của user khác.
- Không cần bảng order thứ hai.
- Nếu thiếu /api/me, thêm read endpoint trả user hiện tại tối thiểu.

Recovery:
- Sau reload xác thực trước.
- Chỉ khôi phục intent thuộc đúng user hiện tại.
- SUBMITTING được xem như chưa rõ kết quả.
- Tự GET tra kết quả được phép.
- Không tự POST đặt lệnh khi composable hoặc component được mount.
- Có nút Gửi lại cùng yêu cầu:
  dùng đúng key và payload đã lưu.
- Intent ACKNOWLEDGED có orderId thì GET order.
- Dữ liệu storage sai schema không được tự gửi.

Idempotency:
- Auth/authorization hiện tại trước replay.
- Replay result gốc dùng để lấy orderId.
- GET order lấy trạng thái hiện tại.
- Business validation chỉ chạy khi xử lý request mới;
  không từ chối một replay hợp lệ chỉ vì phiên đã thay đổi.
- Same key khác payload409, UI không tự đổi key để né.
- Giữ chính sách backend hiện có: không tự thêm TTL xóa key.
- RequestId mới mỗi HTTP, intent key giữ nguyên.

State consistency:
- Order version thấp hơn không overwrite version cao.
- Data/cache theo userId/accountId/orderId.
- Không nhận callback của auth session cũ.
- 401 yêu cầu login lại, không khẳng định order cũ không tồn tại.
- Quyền bị thu hồi: dừng recovery có side effect,
  không kết luận chưa tạo order.
- B đăng nhập không hiển thị/retry intent của A.
- Xóa protected UI state khi logout,
  xử lý pending intent theo owner scope mà không đổi chủ sở hữu.

Fixture:
- acc-023 mới10tr, OPENING ledger, TRADE membership.
- Không sell liquidity.
- BUY100@25000.
- Sau một create thành công:
  một order/event/hold2500000, available7500000.

Tests:
- Timeout sau commit rồi lookup/retry cùng orderId.
- Reload khi đang gửi, login lại cùng user và khôi phục.
- Intent lưu nhưng request chưa tới:
  lookup NOT_FOUND, chỉ gửi lại khi người dùng chọn.
- Double-click sát nhau.
- Same key khác quantity409.
- Replay PENDING_NEW không overwrite order version mới.
- User switch, revoke membership, expired token.
- Storage unavailable/corrupt.
- Không tự POST khi component mount hoặc lifecycle được chạy lại.

Sau khi làm:
- Chạy kiểm tra phù hợp, báo kết quả thực tế.
- Cập nhật README về intent lifecycle và recovery scope.
- Giải thích requestId, intent key và orderId bằng một ví dụ.
```

**Ngày 23 hoàn thành khi:**

- [ ] Key và payload được lưu trước khi gửi.
- [ ] Timeout không biến thành một ý định mới.
- [ ] Reload tìm lại được yêu cầu của đúng người dùng.
- [ ] NOT_FOUND không bị hiểu sai thành “chắc chắn chưa có lệnh”.
- [ ] Replay không làm trạng thái order lùi.
- [ ] Backend vẫn kiểm tra quyền khi tra cứu và gửi lại.
- [ ] Một ý định chỉ tạo một lệnh và một khoản giữ.

Ngày 24 sẽ tích hợp **Risk và kiểm soát tài sản trên cả mua lẫn bán**, đặc biệt là giữ chứng khoán để hai lệnh không cùng sử dụng vượt một vị thế.
