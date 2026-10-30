# Ngày 9 — API đặt lệnh, yêu cầu hủy và chống tạo lệnh trùng

Ngày 8 đã có state machine và lịch sử lệnh. Hôm nay bạn xây API sử dụng các quy tắc đó, tập trung vào tình huống:

> “Backend đã tạo lệnh nhưng client bị timeout. Nếu gửi lại, làm sao lấy đúng lệnh cũ?”

Môi trường tiếp tục dùng **Node.js + TypeScript, MySQL và OpenCode**.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Đặt, hủy, sửa và gửi lại yêu cầu | Phân biệt ý định giao dịch với HTTP request |
| 30 phút kỹ thuật | API contract, lỗi và idempotency | Có quy tắc xử lý yêu cầu trùng |
| 30–60 phút thực hành | API, bảng chống trùng và kiểm thử | Retry không tạo thêm lệnh |

**Sản phẩm cuối buổi:**

- `POST /api/orders`
- `POST /api/orders/:id/cancel`
- `GET /api/orders/:id`
- Lưu kết quả theo `Idempotency-Key`.
- Cùng khóa nhưng khác nội dung bị từ chối.

**Giới hạn:** hôm nay chưa giữ tài sản và chưa tự chuyển lệnh vào matching. Lệnh tạo thành công nằm ở `PENDING_NEW`; dùng phản hồi mô phỏng ngày 8 để tiếp tục vòng đời.

---

## 2. Nghiệp vụ — 30 phút

### 2.1. Một ý định có thể tạo nhiều HTTP request

Ví dụ:

```text
Người dùng muốn mua 100 cổ phiếu.
→ Gửi request A.
→ Backend tạo lệnh.
→ Phản hồi bị mất.
→ Client gửi lại request B.
```

A và B là hai HTTP request nhưng cùng một ý định giao dịch.

Nếu backend xử lý cả hai như yêu cầu mới:

```text
Ý định: mua 100.
Kết quả: hai lệnh, mỗi lệnh mua 100.
```

`Idempotency-Key` giúp backend nhận diện các lần gửi lại thuộc cùng một ý định.

Stripe cũng dùng cơ chế khóa idempotency để hỗ trợ retry mà không thực hiện thêm cùng thao tác; đây là một ví dụ triển khai thực tế, còn chính sách cụ thể của simulator sẽ được định nghĩa dưới đây. [Stripe API Reference](https://docs.stripe.com/api/idempotent_requests?...=\&utm_source=chatgpt.com)

### 2.2. Phân biệt ba định danh

| Định danh | Đại diện cho | Khi retry |
|---|---|---|
| `requestId` | Một lần gọi HTTP | Thay đổi |
| `Idempotency-Key` | Một ý định thực hiện thao tác | Giữ nguyên |
| `orderId` | Lệnh đã được tạo | Giữ nguyên |

Ví dụ:

| Lần gọi | requestId | Idempotency-Key | orderId |
|---|---|---|---|
| Lần đầu | req-A | intent-buy-001 | ord-001 |
| Gửi lại | req-B | intent-buy-001 | ord-001 |

Backend không tạo `ord-002`.

### 2.3. Timeout chưa chứng minh lệnh thất bại

Khi client timeout, có thể xảy ra:

1. Request chưa tới backend.
2. Backend chưa commit.
3. Backend đã commit nhưng phản hồi chưa tới client.

Vì vậy, UI nên báo:

```text
Chưa xác định được kết quả. Đang kiểm tra lại yêu cầu.
```

Client gửi lại **cùng khóa và cùng nội dung** để lấy kết quả.

Không tạo khóa mới chỉ vì lần gọi trước timeout.

### 2.4. Hủy lệnh là một yêu cầu riêng

```text
Đặt lệnh: một ý định.
Hủy lệnh đó: một ý định khác.
```

Dùng hai khóa riêng:

```text
Đặt: intent-buy-001
Hủy: intent-cancel-001
```

Hủy thành công ở API hôm nay nghĩa **đã ghi nhận yêu cầu hủy**, chưa phải phần còn lại đã được hủy trên thị trường.

HTTP `202 Accepted` phù hợp với việc đã nhận yêu cầu xử lý nhưng quá trình chưa hoàn tất. [rfc-editor.org](https://www.rfc-editor.org/rfc/rfc9110.html?utm_source=chatgpt.com)

### 2.5. Sửa lệnh khác hủy rồi đặt lại

| Thao tác | Điểm cần hiểu |
|---|---|
| Yêu cầu sửa | Có quy tắc về trường được sửa và ưu tiên sau sửa |
| Hủy rồi đặt mới | Hủy lệnh cũ, sau đó tạo một lệnh khác |
| Hủy chưa xác nhận rồi đặt mới | Lệnh cũ có thể vẫn tiếp tục khớp |

Ngày 9 chưa triển khai sửa lệnh. Không giả lập sửa bằng cách cập nhật trực tiếp `price` hoặc `quantity` trong database.

---

## 3. API đặt lệnh

### 3.1. Request

```http
POST /api/orders
Content-Type: application/json
Idempotency-Key: intent-buy-001
```

```json
{
  "accountId": "acc-001",
  "securityId": "sec-001",
  "side": "BUY",
  "orderType": "LO",
  "price": 25000,
  "quantity": 100
}
```

Phạm vi hôm nay:

- Chỉ LO và `sec-001`.
- Tài khoản phải hoạt động.
- Chứng khoán phải được giao dịch.
- Phiên phải cho phép LO.
- Giá theo cấu hình demo: trong khoảng 23.000–27.000, bước 100.
- Khối lượng nguyên dương; chưa áp dụng lô thực tế.
- Có thể dùng Accounts ngày 6 để kiểm tra tài sản sơ bộ.

**Kiểm tra tài sản sơ bộ chưa giữ tài sản.** Hai ý định khác nhau vẫn có thể cùng vượt qua kiểm tra trên cùng một số dư. Ngày 10 và 19 sẽ giải quyết luồng giữ tiền và cạnh tranh tài sản.

### 3.2. Response lần đầu

HTTP 202:

```json
{
  "data": {
    "orderId": "ord-001",
    "accountId": "acc-001",
    "securityId": "sec-001",
    "status": "PENDING_NEW",
    "cancelRequestStatus": "NONE",
    "quantity": 100,
    "filledQuantity": 0,
    "remainingQuantity": 100,
    "canceledQuantity": 0,
    "version": 1
  }
}
```

Có thể thêm:

```http
Location: /api/orders/ord-001
Idempotency-Replayed: false
```

Thông điệp UI:

```text
Đã ghi nhận yêu cầu đặt lệnh.
```

Chưa hiển thị “Đã khớp” hoặc “Đã được thị trường chấp nhận”.

### 3.3. Gửi lại cùng yêu cầu

Cùng phạm vi, cùng khóa và cùng payload:

```text
Không tạo thêm order.
Không tạo thêm OrderReceived.
Trả lại HTTP status và body đã lưu.
```

Header:

```http
Idempotency-Replayed: true
```

Nếu lệnh hiện đã chuyển sang `PARTIALLY_FILLED`, response replay vẫn có thể là kết quả `PENDING_NEW` ban đầu đã lưu.

Muốn biết trạng thái mới nhất, gọi:

```http
GET /api/orders/ord-001
```

**Kết quả của thao tác ban đầu và trạng thái hiện tại là hai dữ liệu khác nhau.**

### 3.4. Cùng khóa nhưng đổi khối lượng

Ví dụ lần sau gửi:

```json
{
  "accountId": "acc-001",
  "securityId": "sec-001",
  "side": "BUY",
  "orderType": "LO",
  "price": 25000,
  "quantity": 200
}
```

HTTP 409:

```json
{
  "error": {
    "code": "IDEMPOTENCY_KEY_REUSED",
    "message": "Khóa đã được dùng cho một yêu cầu có nội dung khác."
  }
}
```

Không sửa lệnh cũ và không tạo lệnh mới.

---

## 4. API yêu cầu hủy

```http
POST /api/orders/ord-001/cancel
Idempotency-Key: intent-cancel-001
Content-Type: application/json
```

```json
{}
```

Điều kiện:

- Lệnh tồn tại.
- Lệnh ở `NEW` hoặc `PARTIALLY_FILLED`.
- Chưa có yêu cầu hủy đang chờ.
- Phạm vi bài này chưa nhận yêu cầu hủy khi `PENDING_NEW`.

Xử lý bằng state machine ngày 8:

```text
Áp dụng CancelRequested.
Giữ nguyên status chính.
cancelRequestStatus = PENDING.
```

Response HTTP 202:

```json
{
  "data": {
    "orderId": "ord-001",
    "status": "PARTIALLY_FILLED",
    "cancelRequestStatus": "PENDING",
    "filledQuantity": 40,
    "remainingQuantity": 60
  }
}
```

Replay cùng khóa trả kết quả cũ và không ghi thêm `CancelRequested`.

Nếu dùng khóa mới khi đã có yêu cầu hủy đang chờ:

```text
409 CANCEL_ALREADY_PENDING
```

Nếu lệnh đã `FILLED`:

```text
409 ORDER_NOT_CANCELABLE
```

Sau này, khi nhận `CancelConfirmed`, OMS mới chuyển phần còn lại sang lượng đã hủy.

---

## 5. Chuẩn hóa lỗi

Dùng một cấu trúc chung:

```json
{
  "error": {
    "code": "INVALID_PRICE",
    "message": "Giá không phù hợp với cấu hình giao dịch.",
    "details": {
      "price": 25050,
      "tickSize": 100
    }
  },
  "requestId": "req-001"
}
```

| HTTP | Mã lỗi | Trường hợp |
|---:|---|---|
| 400 | `INVALID_REQUEST` | Sai cấu trúc, sai kiểu |
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Thiếu khóa |
| 404 | `ACCOUNT_NOT_FOUND` | Không có tài khoản |
| 404 | `SECURITY_NOT_FOUND` | Không có chứng khoán |
| 404 | `ORDER_NOT_FOUND` | Không có lệnh |
| 422 | `ACCOUNT_NOT_ACTIVE` | Tài khoản không hoạt động |
| 422 | `SECURITY_NOT_TRADABLE` | Chứng khoán không được giao dịch |
| 422 | `INVALID_SESSION` | Phiên không cho phép |
| 422 | `INVALID_PRICE` | Sai biên hoặc bước giá demo |
| 422 | `INSUFFICIENT_CASH` | Không đủ tiền ở bước kiểm tra sơ bộ |
| 422 | `INSUFFICIENT_SECURITIES` | Không đủ chứng khoán ở bước kiểm tra sơ bộ |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Cùng khóa, khác nội dung |
| 409 | `ORDER_NOT_CANCELABLE` | Lệnh không thể nhận yêu cầu hủy |
| 503 | `SERVICE_UNAVAILABLE` | Hạ tầng chưa sẵn sàng |

Ngày 16 mới bổ sung xác thực và phân quyền đầy đủ. Các API hiện tại tiếp tục là API local/demo, không xem `accountId` do client gửi là bằng chứng quyền sở hữu.

---

## 6. Thiết kế idempotency trong MySQL

### 6.1. Phạm vi của khóa

Không dùng khóa trần trên toàn hệ thống.

Phạm vi đề xuất:

```text
Đặt lệnh:
requester + accountId + CREATE_ORDER

Hủy:
requester + accountId + CANCEL_ORDER + orderId
```

Ngày 9 dùng requester cố định từ cấu hình demo. Sau này thay bằng danh tính đã xác thực, không lấy tùy ý từ request body.

### 6.2. Chuẩn hóa payload trước khi hash

Không hash trực tiếp chuỗi JSON thô:

```json
{"price":25000,"quantity":100}
```

và:

```json
{"quantity":100,"price":25000}
```

phải được hiểu như nhau.

Sau khi validate, dựng object chuẩn với thứ tự trường cố định:

```ts
const canonicalPayload = {
  accountId,
  securityId,
  side,
  orderType,
  price: BigInt(price).toString(),
  quantity
};
```

Hash object chuẩn bằng SHA-256.

Không đưa `requestId`, thời gian gửi hoặc các header không liên quan vào hash.

### 6.3. Bảng kết quả yêu cầu

```sql
CREATE TABLE idempotency_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    scope_hash BINARY(32) NOT NULL,
    idempotency_key VARBINARY(128) NOT NULL,
    request_hash BINARY(32) NOT NULL,

    order_id VARCHAR(36) NULL,
    http_status SMALLINT UNSIGNED NULL,
    response_body JSON NULL,

    created_at TIMESTAMP(3) NOT NULL
        DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (id),

    UNIQUE KEY uq_idempotency_scope_key (
        scope_hash,
        idempotency_key
    ),

    FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

`scope_hash` là SHA-256 của phạm vi đã chuẩn hóa. `VARBINARY` giúp khóa được so sánh theo byte, không phụ thuộc quy tắc chữ hoa/thường của collation.

Các trường response cho phép `NULL` trong lúc transaction đang xử lý. **Không commit bản ghi thành công khi chưa điền kết quả.**

Trong demo, chưa tự động xóa khóa. Nếu xóa sớm, một retry cũ có thể bị xử lý như yêu cầu mới.

---

## 7. Transaction đặt lệnh và chống request đồng thời

### 7.1. Luồng xử lý

```text
Validate cấu trúc request và khóa
→ Chuẩn hóa payload và tính hash
→ BEGIN
→ INSERT idempotency_requests để giành khóa
→ Kiểm tra nghiệp vụ
→ INSERT order PENDING_NEW
→ INSERT OrderReceived
→ Lưu HTTP status và response vào idempotency_requests
→ COMMIT
→ Gửi response
```

Ba phần phải commit cùng nhau:

1. Lệnh.
2. Sự kiện tạo lệnh.
3. Kết quả idempotency.

Hôm nay chỉ lưu kết quả thao tác thành công. Lỗi validation hoặc nghiệp vụ làm rollback, không để lại khóa đã commit. Vì vậy, không cam kết replay nguyên kết quả lỗi khi điều kiện nghiệp vụ sau đó thay đổi.

### 7.2. Nếu khóa đã tồn tại

Không làm theo kiểu:

```text
SELECT chưa thấy khóa
→ INSERT order
```

Hai request có thể cùng thấy chưa có khóa.

Dùng `UNIQUE` làm điểm phân xử:

- Request thắng tạo lệnh và commit.
- Request còn lại có thể phải chờ.
- Khi nhận lỗi trùng đúng constraint idempotency, rollback transaction của request đó.
- Đọc bản ghi đã commit bằng một transaction/truy vấn mới.
- Cùng hash: replay.
- Khác hash: 409.

MySQL phân biệt rollback một statement và rollback toàn transaction; lỗi duplicate key không có nghĩa toàn bộ transaction đã tự kết thúc. Code cần chủ động rollback trước khi chuyển sang luồng đọc kết quả cũ. [dev.mysql.com](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html?utm_source=chatgpt.com)

Không coi mọi lỗi duplicate key trong hệ thống là replay thành công.

### 7.3. Với yêu cầu hủy

Trong cùng transaction:

```text
Giành khóa idempotency
→ Đọc và khóa order
→ Kiểm tra trạng thái
→ Áp dụng CancelRequested
→ UPDATE order và INSERT event
→ Lưu response
→ COMMIT
```

Không gọi network hoặc matching trong bộ nhớ khi đang giữ transaction này.

---

## 8. Thực hành — 30–60 phút

| Thời gian | Công việc |
|---|---|
| 10 phút | Migration bảng idempotency và chuẩn hóa request |
| 15–20 phút | API đặt lệnh và replay |
| 10–15 phút | API yêu cầu hủy |
| 10–15 phút mở rộng | Kiểm tra timeout và request đồng thời |

**Bài 1 — Đặt cùng yêu cầu hai lần**

```bash
curl -i -X POST \
  "http://localhost:3000/api/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: intent-buy-001" \
  -d '{
    "accountId": "acc-001",
    "securityId": "sec-001",
    "side": "BUY",
    "orderType": "LO",
    "price": 25000,
    "quantity": 100
  }'
```

Chạy lại đúng lệnh trên.

Kỳ vọng:

```text
Cùng orderId.
Chỉ một order mới.
Chỉ một OrderReceived.
Lần hai có Idempotency-Replayed: true.
```

**Bài 2 — Cùng khóa, đổi quantity thành 200**

Kỳ vọng:

```text
409 IDEMPOTENCY_KEY_REUSED.
Không phát sinh lệnh.
```

**Bài 3 — Hủy lệnh khớp một phần**

Dùng endpoint mô phỏng ngày 8:

```text
OrderAccepted
→ ExecutionReceived 40
```

Sau đó gọi API hủy bằng khóa mới.

Kỳ vọng:

```text
status = PARTIALLY_FILLED
cancelRequestStatus = PENDING
filledQuantity = 40
remainingQuantity = 60
```

Gửi lại cùng yêu cầu hủy: không thêm event.

**Bài 4 — Timeout sau commit**

Trong kiểm thử, dùng hook hoặc lớp HTTP thử nghiệm để trì hoãn response **sau khi transaction đã commit**. Không trì hoãn bên trong transaction.

Client timeout rồi gửi lại cùng khóa.

Kỳ vọng: lấy lại đúng `orderId`, không có lệnh thứ hai.

---

## 9. Kiểm thử bắt buộc và debug

| Kiểm thử | Kết quả |
|---|---|
| Cùng khóa, cùng payload | Một lệnh |
| Cùng khóa, payload khác | 409 |
| JSON khác thứ tự trường | Vẫn replay |
| Hai request cùng khóa chạy đồng thời | Một lệnh và một event tạo |
| Backend restart sau commit | Khóa vẫn replay được từ MySQL |
| Order thay đổi trạng thái sau lần đầu | Replay kết quả gốc; GET trả trạng thái mới |
| Lỗi ghi event hoặc lưu response | Order và khóa rollback |
| Hủy cùng khóa hai lần | Một `CancelRequested` |
| Hủy lệnh filled | 409 |
| Timeout sau commit | Retry lấy đúng lệnh cũ |

**Debug A — Frontend tạo khóa trong hàm retry**

Lỗi:

```ts
async function sendOrder() {
  const key = crypto.randomUUID();
  // Mỗi lần retry gọi lại hàm sẽ có key mới.
}
```

Cách sửa: tạo khóa khi hình thành ý định, giữ cả khóa và payload trong suốt quá trình xác định kết quả.

Nếu người dùng sửa giá hoặc khối lượng để tạo ý định mới, dùng khóa mới.

**Debug B — Khóa được ghi sau khi tạo lệnh bằng transaction khác**

Backend có thể dừng sau khi tạo order nhưng trước khi lưu khóa.

Retry sẽ tạo thêm order.

Cách sửa: order, event và kết quả idempotency cùng transaction.

**Debug C — Replay trả lại kết quả nhưng lại ghi thêm event**

Replay là đọc lại kết quả đã lưu. Không chạy lại service tạo lệnh hoặc yêu cầu hủy.

---

## 10. Prompt cho OpenCode

```text
Tôi đang học ngày 9 của Securities Trading Simulator:
API đặt lệnh, yêu cầu hủy và idempotency.

Môi trường:
- Node.js + TypeScript, MySQL.
- OpenCode, cấu hình model hiện tại.
- Giữ modular monolith và OMS ngày 8.

Trước khi code:
1. Đọc orders, order_events, state machine và transaction.
2. Đọc Accounts, Security Master, Market Session.
3. Kiểm tra kiểu dữ liệu tiền và cách trả lỗi hiện tại.
4. Đề xuất phạm vi 30–60 phút.

Phạm vi:
- Local/demo, chỉ LO và sec-001.
- Requester cố định từ config demo, chưa coi là auth thật.
- Tạo order PENDING_NEW.
- Chưa giữ tài sản hoặc tự gửi vào matching.
- Dùng endpoint mô phỏng ngày 8 để tiếp tục vòng đời.
- Chưa sửa lệnh.

API:
- POST /api/orders.
- POST /api/orders/:id/cancel.
- GET /api/orders/:id.
- Hai POST bắt buộc Idempotency-Key.

Validation tạo:
- Account tồn tại và ACTIVE.
- Security tồn tại, TRADABLE, thuộc phạm vi demo.
- Phiên cho phép LO.
- Giá nguyên dương an toàn, trong [23000,27000], bước 100.
- Quantity nguyên dương, trong phạm vi schema.
- Kiểm tra tài sản sơ bộ qua calculator ngày 6.
- Không diễn giải precheck thành đã giữ tài sản.

Idempotency:
- Scope CREATE_ORDER theo requester + account.
- Scope CANCEL_ORDER theo requester + account + orderId.
- Key tối đa 128 byte, so sánh theo byte.
- Validate và canonicalize trước khi hash.
- Canonical price là chuỗi số nguyên.
- SHA-256 cho scope và request.
- Cùng scope/key/hash: replay status và body đã lưu.
- Cùng scope/key nhưng khác hash: 409 IDEMPOTENCY_KEY_REUSED.
- Replay không tạo thêm order hoặc event.
- Replay kết quả gốc; GET order trả trạng thái hiện tại.

Database:
- Tạo idempotency_requests theo schema bài học.
- UNIQUE(scope_hash,idempotency_key).
- Order, OrderReceived và response idempotency cùng transaction.
- Chỉ commit khi đã điền response thành công.
- Hôm nay chỉ lưu kết quả thành công.
- Business/validation error rollback, không để key đã commit.
- Chưa tự xóa key.

Cạnh tranh cùng key:
- INSERT unique để giành khóa, không chỉ SELECT trước.
- Nếu duplicate đúng constraint idempotency:
  rollback transaction hiện tại rồi đọc kết quả đã commit
  bằng truy vấn/transaction mới.
- Không coi duplicate ở bảng khác là replay.
- Có timeout hữu hạn và xử lý lỗi lock/deadlock rõ ràng.
- Không có network call trong transaction.

Cancel:
- Đọc khóa order trong transaction.
- Chỉ NEW/PARTIALLY_FILLED, chưa có cancel pending.
- Áp dụng CancelRequested bằng state machine.
- Giữ status chính và các lượng khớp/còn.
- Chỉ cancelRequestStatus chuyển PENDING.
- Update order, event và response idempotency cùng transaction.
- Một key mới khi đã pending: 409 CANCEL_ALREADY_PENDING.
- FILLED/CANCELED/REJECTED/PENDING_NEW không được nhận hủy
  trong phạm vi demo.
- Không tự gọi CancelConfirmed.

Response:
- Hai thao tác nhận thành công trả 202.
- Có orderId và trạng thái, Location cho tạo order.
- Header Idempotency-Replayed true/false.
- Chuẩn hóa error code/message/details/requestId.
- Giữ requestId riêng cho từng lần HTTP;
  không đưa requestId vào hash nghiệp vụ.

Kiểm thử:
- Cùng key/payload hai lần chỉ một order và OrderReceived.
- Thứ tự JSON khác nhau vẫn replay.
- Cùng key khác payload trả 409.
- Hai request cùng key đồng thời chỉ tạo một order.
- Restart backend vẫn replay từ MySQL.
- Order đổi trạng thái: replay gốc, GET trạng thái mới.
- Ghi event hoặc lưu response thất bại rollback toàn bộ.
- Hủy replay không thêm CancelRequested.
- Timeout sau commit, retry cùng key lấy đúng order cũ.
- Precheck và API không thay đổi tài sản.

Sau khi làm:
- Chạy kiểm tra phù hợp, báo kết quả thực tế.
- Cập nhật README về idempotency và giới hạn demo.
- Giải thích một tình huống timeout sau commit.
- Nêu rõ chống trùng không thay thế giữ tài sản.
```

## Ngày 9 hoàn thành khi:

- [ ] API đặt và yêu cầu hủy dùng lại state machine ngày 8.
- [ ] Retry cùng khóa trả đúng kết quả cũ.
- [ ] Cùng khóa nhưng khác nội dung bị từ chối.
- [ ] Hai request cùng khóa không tạo hai lệnh.
- [ ] Lệnh, event và kết quả idempotency commit cùng nhau.
- [ ] Timeout không khiến client kết luận sai rằng lệnh chưa được tạo.
- [ ] Yêu cầu hủy chưa làm lệnh thành `CANCELED`.

Ngày 10 sẽ bổ sung **giữ tiền và sổ cái tiền**, để đặt lệnh và dành tài sản cho lệnh trở thành một luồng nghiệp vụ được bảo vệ.
