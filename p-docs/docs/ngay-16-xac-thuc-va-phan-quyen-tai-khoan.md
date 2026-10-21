# Ngày 16 — Xác thực và phân quyền tài khoản

Từ ngày 9–15, API đã xử lý lệnh và tài sản. Hôm nay bạn bổ sung câu hỏi phải trả lời trước những thao tác đó:

> “Người đang gọi API là ai, và họ có quyền truy cập tài khoản hoặc lệnh này không?”

Trọng tâm là **backend kiểm tra quyền trên từng tài nguyên**, thay vì chỉ ẩn tài khoản trên giao diện.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Đăng nhập, quyền tài khoản và xác nhận giao dịch | Phân biệt ba lớp kiểm soát |
| 30 phút kỹ thuật | JWT, membership, permission và audit | Có cơ chế kiểm tra quyền thống nhất |
| 30–60 phút thực hành | Hai người dùng, hai tài khoản và kiểm thử truy cập chéo | Chặn đọc và giao dịch trái quyền |

**Sản phẩm cuối buổi:**

- Đăng nhập nhận access token.
- Chỉ liệt kê tài khoản được cấp quyền.
- Kiểm tra quyền trên API số dư, danh mục, lệnh và hủy lệnh.
- Ghi audit cho thao tác giao dịch và truy cập bị từ chối.
- Các endpoint mô phỏng không trở thành đường bỏ qua phân quyền.

---

## 2. Nghiệp vụ — 30 phút

### 2.1. Phân biệt ba lớp

| Lớp | Câu hỏi |
|---|---|
| Xác thực — Authentication | Bạn là ai? |
| Phân quyền — Authorization | Bạn được làm gì với tài nguyên này? |
| Xác nhận giao dịch | Bạn có xác nhận thao tác cụ thể này không? |

Ví dụ:

```text
Đăng nhập thành công.
Có quyền xem acc-A.
Chưa chắc có quyền đặt lệnh trên acc-A.
```

Ngày 16 triển khai hai lớp đầu. Xác nhận giao dịch bổ sung chỉ là phần mở rộng, chưa tích hợp OTP thật.

### 2.2. Vì sao JWT hợp lệ chưa đủ?

Người A có token hợp lệ và gọi:

```http
GET /api/accounts/acc-B/balances
Authorization: Bearer <token-của-A>
```

Token chứng minh request đến từ A. Nó không chứng minh A được xem tài khoản B.

OWASP gọi nhóm lỗi truy cập đối tượng trái quyền này là **Broken Object Level Authorization**: API cần kiểm tra người gọi có được phép truy cập chính đối tượng đang được yêu cầu hay không. [OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0xa1-broken-object-level-authorization/?utm_source=chatgpt.com)

### 2.3. Không suy quyền từ giao diện

Frontend chỉ hiển thị `acc-A`, nhưng người dùng vẫn có thể:

- Sửa URL thành `acc-B`.
- Đổi `accountId` trong body.
- Gọi API trực tiếp.
- Thay `orderId` bằng lệnh của người khác.

Vì vậy, cả API đọc và API ghi đều phải kiểm tra quyền.

### 2.4. Quyền của khách hàng và vận hành khác nhau

| Nhóm | Quyền demo |
|---|---|
| Khách hàng | Đọc hoặc giao dịch trên tài khoản được cấp |
| Vận hành — OPS | Chạy công cụ vận hành được cho phép |
| Hệ thống nội bộ | Xử lý execution, settlement theo luồng ứng dụng |

Có vai trò OPS không tự động đồng nghĩa được giao dịch trên mọi tài khoản.

---

## 3. Mô hình quyền của bài học

Tách hai phạm vi:

**Vai trò toàn ứng dụng:**

```text
CUSTOMER
OPS
```

**Quyền trên từng tài khoản:**

```text
READ
TRADE
```

Trong demo:

- `READ`: xem số dư, vị thế, danh mục, lệnh và lịch sử.
- `TRADE`: bao gồm READ, được đặt và yêu cầu hủy lệnh.
- Không có membership đang hoạt động: không được truy cập.

| Người dùng | Tài khoản | Membership |
|---|---|---|
| `user-A` | `acc-016-A` | TRADE |
| `user-B` | `acc-016-B` | TRADE |

Không cấp quyền chéo.

Có thể tạm đổi membership của A thành READ trong kiểm thử để chứng minh:

```text
Xem được tài khoản.
Không đặt hoặc hủy lệnh được.
```

---

## 4. Database MySQL

Các bảng bổ sung:

| Bảng | Vai trò |
|---|---|
| `users` | Danh tính đăng nhập |
| `roles` | CUSTOMER, OPS |
| `user_roles` | Vai trò toàn ứng dụng |
| `account_memberships` | Quyền trên tài khoản |
| `audit_events` | Lịch sử thao tác và quyết định truy cập |

### 4.1. Người dùng

```sql
CREATE TABLE users (
    id VARCHAR(36) NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status ENUM('ACTIVE', 'DISABLED') NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Mật khẩu được hash bằng thư viện chuyên dụng, ưu tiên Argon2id theo hướng dẫn OWASP; không lưu plaintext hoặc tự thay bằng SHA-256 đơn thuần. [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html?utm_source=chatgpt.com)

### 4.2. Membership

```sql
CREATE TABLE account_memberships (
    user_id VARCHAR(36) NOT NULL,
    account_id VARCHAR(36) NOT NULL,

    access_level ENUM('READ', 'TRADE') NOT NULL,
    status ENUM('ACTIVE', 'REVOKED') NOT NULL,

    PRIMARY KEY (user_id, account_id),

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Không dùng `customer_ref` hiện tại thay cho kiểm tra membership. Đó là tham chiếu khách hàng từ fixture, không phải bằng chứng đăng nhập.

### 4.3. Audit

Các trường cần có:

```text
id
actor_user_id
action
resource_type
resource_id
account_id
outcome
reason_code
request_id
occurred_at
metadata
```

Ví dụ:

```json
{
  "actorUserId": "user-A",
  "action": "ORDER_CANCEL_REQUEST",
  "resourceType": "ORDER",
  "resourceId": "ord-A",
  "accountId": "acc-016-A",
  "outcome": "ACCEPTED",
  "requestId": "req-001"
}
```

Không đưa mật khẩu, access token hoặc toàn bộ Authorization header vào audit.

---

## 5. Đăng nhập và JWT

### 5.1. API đăng nhập

```http
POST /api/auth/login
```

```json
{
  "username": "demo-a",
  "password": "<mật-khẩu-fixture>"
}
```

Response:

```json
{
  "data": {
    "accessToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

900 giây là cấu hình demo, tương đương 15 phút.

Ngày 16 chưa cần refresh token, đăng ký hoặc quên mật khẩu.

Đăng nhập sai trả thông báo chung:

```text
Thông tin đăng nhập không hợp lệ.
```

Không phân biệt công khai “không có username” và “sai password”.

### 5.2. Nội dung token tối thiểu

```text
sub: userId
iss: issuer của ứng dụng
aud: API đích
iat: thời điểm phát hành
exp: thời điểm hết hạn
```

Khi nhận token, backend phải verify chữ ký, thuật toán được cấu hình, issuer, audience và thời hạn; không chỉ decode payload. OWASP nhấn mạnh việc xác minh các thành phần này khi xử lý JWT. [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/cheatsheets/Identity_Propagation_Patterns_Cheat_Sheet.html?utm_source=chatgpt.com)

Quy tắc demo:

- Dùng thư viện JWT phù hợp với project.
- Thuật toán được cấu hình cố định trong verifier.
- Khóa ký lấy từ cấu hình bí mật, không hardcode.
- Thiếu khóa ký thì báo lỗi khi khởi động.
- Không fallback sang người dùng demo khi token lỗi.

### 5.3. Dùng đồng hồ riêng cho xác thực

Dự án đang có `FixedClock` để giả lập ngày giao dịch và thanh toán.

Không dùng đồng hồ thị trường đó để kiểm tra thời hạn token.

| Đồng hồ | Mục đích |
|---|---|
| Market Clock | Phiên, ngày giao dịch, settlement |
| Auth Clock | Phát hành và kiểm tra token |

Nếu chuyển Market Clock từ 23/10 sang 28/10 để chạy settlement, token không được tự hết hạn theo bước nhảy nghiệp vụ đó.

Trong kiểm thử, inject hai clock riêng.

---

## 6. Kiểm tra quyền trong backend

Cấu trúc đề xuất:

```text
src/modules/auth/
  auth.routes.ts
  auth.service.ts
  token.service.ts

src/modules/authorization/
  authorization.service.ts
  account-membership.repository.ts

src/modules/audit/
  audit.service.ts
  audit.repository.ts
```

Interface:

```ts
type Principal = {
  userId: string;
};

type AccountPermission =
  | "ACCOUNT_READ"
  | "ORDER_CREATE"
  | "ORDER_CANCEL";
```

```ts
await authorization.assertAccountPermission({
  principal,
  accountId,
  permission: "ORDER_CREATE"
});
```

`principal` do backend tạo sau khi verify token. Không nhận `userId` hoặc `role` từ body làm căn cứ phân quyền.

Trong demo, đọc trạng thái user và membership từ database cho mỗi request được bảo vệ. Không nhét danh sách tài khoản vào token rồi coi đó là quyền luôn còn hiệu lực.

---

## 7. Bảo vệ API theo tài nguyên

### 7.1. API có accountId

Ví dụ:

```http
GET /api/accounts/acc-016-A/balances
```

Luồng:

```text
Verify token
→ Kiểm tra user ACTIVE
→ Kiểm tra ACCOUNT_READ
→ Đọc số dư
```

Áp dụng tương tự cho:

- Positions.
- Portfolio.
- Cash ledger.
- Settlement obligations.
- Availability checks.
- Danh sách lệnh theo tài khoản.

### 7.2. API chỉ có orderId

Ví dụ:

```http
POST /api/orders/ord-B/cancel
```

Backend phải:

1. Xác định tài khoản thật của `ord-B` từ database.
2. Kiểm tra quyền `ORDER_CANCEL` trên tài khoản đó.
3. Sau đó mới xử lý idempotency và yêu cầu hủy.

Không kiểm tra quyền trên `accountId` client tự thêm vào body.

Các API chi tiết lệnh, timeline và cash reservation cũng phải kiểm tra quyền thông qua tài khoản của lệnh.

### 7.3. API liệt kê

Bổ sung:

```http
GET /api/me/accounts
```

Chỉ trả các tài khoản có membership ACTIVE.

Không truy vấn tất cả tài khoản rồi trông chờ frontend tự lọc.

### 7.4. API vận hành và mô phỏng

Các endpoint từ những ngày trước cần được rà soát:

```text
/api/oms-demo/...
/api/simulator/...   — các thao tác ghi
/api/settlement-runs
```

Chính sách:

```text
Được bật trong cấu hình demo
AND
Người gọi có vai trò OPS
```

Hoặc không mount endpoint khi không cần.

Khách hàng không được tự gọi `ExecutionReceived`, `CancelConfirmed` hoặc chạy settlement để sửa tài sản.

Các kiểm thử tích hợp có thể dùng service nội bộ hoặc tài khoản vận hành fixture riêng.

---

## 8. Phân quyền phải xảy ra trước replay idempotency

Ngày 9 đã lưu response của một thao tác.

Ngày 16 phải bảo đảm:

```text
Xác thực
→ Kiểm tra quyền hiện tại
→ Tra cứu idempotency
→ Replay hoặc thực hiện thao tác
```

Không trả response cũ trước khi kiểm tra quyền.

Ví dụ:

```text
A từng có TRADE trên acc-A.
Sau đó membership bị thu hồi.
A gửi lại key cũ.
```

Backend vẫn phải từ chối truy cập, không tiết lộ response đã lưu.

Cập nhật scope idempotency để dùng **userId đã xác thực**, thay cho requester cố định của ngày 9.

Dùng fixture và khóa mới để kiểm thử sau thay đổi; không tự gán lại chủ sở hữu cho các bản ghi idempotency lịch sử.

---

## 9. Quy ước lỗi

| Tình huống | HTTP |
|---|---:|
| Thiếu token, token sai hoặc hết hạn | 401 |
| Token hợp lệ nhưng user bị vô hiệu hóa | 401 |
| Có READ nhưng không có TRADE | 403 |
| Không có quyền thấy tài khoản hoặc lệnh | 404 |
| Thao tác vận hành không có vai trò OPS | 403 |

Trong bài này, dùng 404 cho đối tượng không được phép thấy nhằm tránh tiết lộ nó có tồn tại hay không.

Ví dụ:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Không tìm thấy tài nguyên."
  },
  "requestId": "req-002"
}
```

Audit nội bộ vẫn có thể ghi rõ:

```text
ACCOUNT_ACCESS_DENIED
ORDER_ACCESS_DENIED
```

Không đưa thông tin chủ tài khoản khác vào response lỗi.

---

## 10. Audit và transaction

Với thao tác giao dịch được chấp nhận:

```text
Order / khoản giữ / event / idempotency / audit thành công
→ Cùng transaction
```

Với request bị từ chối:

- Không thay đổi order hoặc tài sản.
- Ghi audit từ chối bằng đường ghi riêng.
- Nếu ghi audit gặp lỗi, vẫn không cho request đi qua.

Replay có thể tạo một audit mới với outcome `REPLAYED`, nhưng không tạo thêm nghiệp vụ.

Phân biệt:

```text
Audit: ai đã yêu cầu làm gì.
Order event: lệnh đã thay đổi thế nào.
Cash ledger: tiền đã biến động vì sao.
```

Ba loại lịch sử không thay thế nhau.

---

## 11. Thực hành — 30–60 phút

**Bước 1 — Seed hai người dùng và tài khoản**

Tạo fixture mới:

| User | Account | Quyền |
|---|---|---|
| `user-A` | `acc-016-A` | TRADE |
| `user-B` | `acc-016-B` | TRADE |

Nếu kiểm thử đặt lệnh giữ tiền, mỗi tài khoản cần:

- Cash balance hợp lệ.
- OPENING ledger.
- Được khởi tạo theo luồng tiền ngày 10.
- Không ghi đè tài khoản các bài trước.

**Bước 2 — Đăng nhập và đọc tài khoản của mình**

```text
Token A → GET balances acc-016-A → 200.
Token B → GET balances acc-016-B → 200.
```

**Bước 3 — Thay accountId**

```text
Token A → GET balances acc-016-B → 404.
Token A → POST order cho acc-016-B → 404.
```

Xác nhận:

```text
Không có order.
Không có khoản giữ.
Không có cash ledger nghiệp vụ mới.
Có audit từ chối.
```

**Bước 4 — Thay orderId**

Tạo một lệnh thuộc B, rồi dùng token A:

```text
GET lệnh B → 404.
GET timeline lệnh B → 404.
POST hủy lệnh B → 404.
GET reservation lệnh B → 404.
```

**Bước 5 — Hạ quyền A xuống READ**

```text
Đọc số dư A → 200.
Đặt lệnh A → 403.
Hủy lệnh A → 403.
```

**Bước 6 — Kiểm tra token và Clock**

- Token hết hạn → 401.
- Sửa payload token nhưng giữ chữ ký cũ → 401.
- Sai issuer hoặc audience → 401.
- Chuyển Market Clock nhiều ngày → không ảnh hưởng thời hạn Auth Clock.

---

## 12. Các lỗi debug thường gặp

**A. Middleware chỉ kiểm tra JWT**

Request có token hợp lệ được đi tiếp, nhưng service chưa kiểm tra membership.

Cách sửa: authentication và authorization là hai bước riêng.

**B. API đọc được bảo vệ, API ghi thì không**

Đã chặn xem tài khoản B nhưng `POST /api/orders` vẫn nhận `accountId` của B.

Cần kiểm tra quyền tại mọi điểm vào của nghiệp vụ.

**C. Hủy kiểm tra accountId trong body**

Client gửi:

```text
orderId của B
accountId của A
```

Backend kiểm tra quyền A rồi hủy lệnh B.

Cách sửa: lấy accountId thật từ order.

**D. API chính có bảo vệ nhưng endpoint simulate còn mở**

Khách hàng không hủy được qua API thật nhưng gọi `CancelConfirmed` trực tiếp.

Cách sửa: kiểm soát cả công cụ demo và vận hành.

**E. Thu hồi quyền nhưng token vẫn được dùng toàn quyền**

Backend chỉ tin danh sách account trong JWT.

Cách sửa trong bài này: kiểm tra membership hiện tại từ database.

---

## 13. Prompt cho OpenCode

```text
Tôi đang học ngày 16 của Securities Trading Simulator:
Xác thực và phân quyền tài khoản.

Môi trường:
- Node.js + TypeScript, MySQL, Vue 3 + TypeScript + Tailwind CSS.
- OpenCode, cấu hình model hiện tại.
- Giữ kiến trúc và nghiệp vụ ngày 1–15.

Trước khi code:
1. Kiểm kê route đọc/ghi tài khoản, order, lịch sử,
   reservation, settlement và endpoint mô phỏng.
2. Xác định requester cố định đang dùng cho idempotency.
3. Phân biệt Market Clock và Auth Clock.
4. Đề xuất phạm vi 30–60 phút.

Database:
- users: id, username unique, password_hash, status.
- roles: CUSTOMER, OPS.
- user_roles.
- account_memberships:
  userId/accountId composite PK,
  accessLevel READ/TRADE, status ACTIVE/REVOKED.
- audit_events theo nội dung bài.

Fixture:
- user-A chỉ TRADE acc-016-A.
- user-B chỉ TRADE acc-016-B.
- Hai tài khoản mới có số dư và OPENING ledger hợp lệ
  nếu dùng để test đặt lệnh.
- Không ghi đè tài khoản cũ.
- Có thể thêm OPS fixture riêng nếu cần test công cụ vận hành.
- Hash mật khẩu bằng thư viện Argon2id, không lưu plaintext.
- Mật khẩu fixture lấy từ cấu hình/script local, không log.

Authentication:
- POST /api/auth/login.
- JWT access token TTL demo15 phút.
- Verify signature, allowed algorithm, issuer, audience,
  expiry và các claim bắt buộc.
- Dùng thư viện JWT, không tự viết crypto.
- Không chỉ decode.
- Key ký từ secret config; thiếu thì startup fail.
- Không fallback demo-user khi auth lỗi.
- Login error chung, không tiết lộ username tồn tại hay không.
- Không log password hoặc token.
- Auth Clock độc lập với Fixed Market Clock.

Authorization:
- Principal.userId từ token đã verify.
- Đọc user status và membership hiện tại từ DB.
- READ cho API đọc.
- TRADE bao gồm READ, cho create/cancel.
- Không tin userId/role/owner do client gửi.
- Route theo orderId phải lấy accountId thật từ order.
- Kiểm tra cả order detail, events và reservation.
- GET /api/me/accounts chỉ trả membership ACTIVE.
- Không dựa vào việc frontend ẩn tài khoản.

Idempotency:
- Authorize trước replay và trước side effect.
- Scope dùng userId đã xác thực.
- Request đã thu hồi quyền không được lấy response cũ.
- Không gán lại dữ liệu idempotency lịch sử cho user mới.
- Dùng fixture/key mới cho test ngày 16.

Quy ước:
- Token thiếu/sai/hết hạn hoặc user disabled:401.
- Có READ nhưng không TRADE:403.
- Tài nguyên không có quyền thấy:404 chung.
- Audit nội bộ giữ reason cụ thể.
- Rejected request không tạo order/hold/ledger nghiệp vụ.
- Audit từ chối là bản ghi riêng được phép phát sinh.

Endpoint vận hành:
- simulate/oms-demo, simulator writes, settlement runner:
  phải có OPS và được bật bằng config demo,
  hoặc không mount.
- OPS không tự động có quyền giao dịch mọi account.
- Customer không được gọi ExecutionReceived/CancelConfirmed.
- Public health/catalog/market data cần có policy rõ ràng;
  không vô tình mở API tài sản.

Audit:
- Giao dịch accepted ghi audit cùng transaction nghiệp vụ.
- Denied request ghi audit ngoài transaction đã rollback.
- Replay có thể ghi REPLAYED, không thêm business event.
- Không để lỗi audit biến deny thành allow.

Kiểm thử:
- A đọc/giao dịch account A thành công.
- A không đọc hoặc đặt lệnh trên B.
- A không đọc/hủy/tìm timeline/reservation của order B.
- READ-only đọc được nhưng create/cancel403.
- Membership bị revoke vẫn bị chặn dù JWT còn hạn.
- Replay key cũ sau revoke không lộ response.
- Token sửa payload, hết hạn, sai iss/aud bị401.
- Market Clock đổi ngày không làm token đổi hiệu lực.
- Customer không gọi endpoint vận hành.
- Các bài transaction và đối chiếu tài sản trước vẫn đúng.

Nếu còn thời gian:
- Trang đăng nhập Vue 3 + TypeScript + Tailwind CSS, token lưu trong bộ nhớ cho demo.
- Account selector lấy từ /api/me/accounts.
- Reload có thể yêu cầu login lại; chưa cần refresh token.
- Không coi UI là nơi quyết định quyền.

Sau khi làm:
- Chạy kiểm tra phù hợp, báo kết quả thực tế.
- Cập nhật README về quyền, auth clock và route policy.
- Liệt kê route được bảo vệ và public.
- Chưa tích hợp OTP thật hoặc hệ thống đăng nhập bên ngoài.
```

**Ngày 16 hoàn thành khi:**

- [ ] Token xác định đúng người dùng nhưng không thay thế kiểm tra quyền.
- [ ] Hai người dùng không đọc hoặc giao dịch trên tài khoản của nhau.
- [ ] Quyền READ và TRADE được phân biệt.
- [ ] `orderId` được kiểm tra qua tài khoản thật của lệnh.
- [ ] Replay idempotency vẫn phải qua phân quyền.
- [ ] Endpoint mô phỏng không tạo đường bỏ qua kiểm soát.
- [ ] Audit ghi được ai làm gì và vì sao bị từ chối.

Ngày 17 sẽ xử lý **snapshot, delta và khôi phục WebSocket**, giúp bảng giá đồng bộ đúng khi reconnect, thiếu bản tin hoặc nhận dữ liệu cũ.
