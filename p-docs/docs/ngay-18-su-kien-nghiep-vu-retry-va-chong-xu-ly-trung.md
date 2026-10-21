# Ngày 18 — Sự kiện nghiệp vụ, retry và chống xử lý trùng

Ngày 17 xử lý bản tin giá bị thiếu hoặc đến muộn. Hôm nay bạn chuyển sang sự kiện nghiệp vụ:

> “Nếu cùng một execution được giao lại hai lần, làm sao consumer không cộng chứng khoán hoặc giá vốn lần thứ hai?”

Bạn sẽ xây một **consumer cập nhật projection danh mục**, với bản ghi chống trùng và cập nhật dữ liệu trong cùng transaction MySQL.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Sự kiện, giao lại, retry và xác nhận xử lý | Hiểu vì sao trùng là tình huống phải dự kiến |
| 30 phút kỹ thuật | Event envelope, dedup và transaction | Có cơ chế xử lý lặp an toàn |
| 30–60 phút thực hành | Consumer, projection và kiểm thử lỗi | Cùng sự kiện không tạo thêm tác động |

**Sản phẩm cuối buổi:**

- Một event contract rõ ràng.
- Bảng ghi nhận sự kiện đã xử lý theo consumer.
- Projection danh mục phục vụ đọc.
- Retry sau lỗi không mất cập nhật.
- Giao lại sau commit không cộng dữ liệu lần hai.

RabbitMQ là phần mở rộng. Bài bắt buộc có thể chạy bằng test harness hoặc bộ giao sự kiện nội bộ.

---

## 2. Nghiệp vụ — 30 phút

### 2.1. Phân biệt command và event

| Loại | Ý nghĩa | Ví dụ |
|---|---|---|
| Command | Yêu cầu thực hiện một việc | `PlaceOrder` |
| Event | Thông báo một việc đã xảy ra | `ExecutionApplied` |

Ví dụ:

```text
PlaceOrder:
“Tôi muốn mua 100 cổ phiếu.”

ExecutionApplied:
“Hệ thống đã ghi nhận khớp 40 cổ phiếu cho lệnh này.”
```

Consumer nhận event không tạo lại ý định đặt lệnh.

### 2.2. Vì sao cùng sự kiện có thể được giao lại?

Một tình huống điển hình:

```text
Consumer nhận event.
→ Cập nhật MySQL thành công.
→ Commit.
→ Chưa kịp xác nhận với bộ giao sự kiện.
→ Consumer mất kết nối.
→ Event được giao lại.
```

Consumer không thể kết luận:

```text
Được giao lại → lần trước chắc chưa xử lý.
```

RabbitMQ mô tả việc thông điệp có thể được giao lại khi mất xác nhận hoặc kết nối; consumer cần xử lý được tình huống đó. [RabbitMQ](https://www.rabbitmq.com/docs/reliability?utm_source=chatgpt.com)

### 2.3. Phân biệt ba cơ chế đã học

| Cơ chế | Đối tượng chống trùng |
|---|---|
| `Idempotency-Key` ngày 9 | Yêu cầu API của người dùng |
| Business key ngày 10–11 | Tác động của execution lên tiền và vị thế |
| Consumer dedup ngày 18 | Sự kiện được giao cho một consumer |

Ba lớp bổ trợ nhau. Không lấy `requestId` thay cho cả ba.

### 2.4. Một event có thể phục vụ nhiều consumer

Ví dụ:

```text
ExecutionApplied
→ Consumer projection danh mục
→ Consumer thống kê
→ Consumer thông báo
```

Consumer projection đã xử lý không có nghĩa consumer thống kê cũng đã xử lý.

Vì vậy, khóa chống trùng phải có:

```text
consumerName + eventId
```

`consumerName` là tên logic ổn định, ví dụ:

```text
portfolio-view-v1
```

Không dùng ID tiến trình hoặc UUID mới sau mỗi lần khởi động làm tên consumer.

---

## 3. Giữ nguyên nguồn dữ liệu tài sản

Đây là quyết định kiến trúc quan trọng.

Ngày 10–14 đã cập nhật nguyên tử:

```text
OMS + tiền + vị thế + giá vốn + nghĩa vụ thanh toán
```

Hôm nay **không tách các cập nhật đó ra chỉ để dùng event**.

Thay vào đó, consumer cập nhật một **read model riêng**:

```text
portfolio_projections
```

| Dữ liệu | Vai trò |
|---|---|
| `positions`, cash balances và ledger hiện tại | Nguồn dữ liệu nghiệp vụ |
| `portfolio_projections` | Bản sao dẫn xuất để học xử lý sự kiện |
| Risk và kiểm tra tài sản | Tiếp tục đọc nguồn Accounts hiện tại |

Không để consumer cộng lại vào `positions` nếu transaction execution đã cộng trước đó.

Ngày 18 cũng chưa thay thế Portfolio API đang hoạt động bằng projection mới.

---

## 4. Event contract

### 4.1. Dùng sự kiện sau khi execution đã được áp dụng

Tên sự kiện:

```text
ExecutionApplied
```

Nó có nghĩa transaction xử lý execution của tài khoản đã commit.

Ví dụ:

```json
{
  "eventId": "evt-001",
  "type": "ExecutionApplied",
  "schemaVersion": 1,

  "aggregateId": "ord-001",
  "aggregateVersion": 3,

  "occurredAt": "2026-10-23T03:00:00Z",

  "payload": {
    "accountId": "acc-018",
    "orderId": "ord-001",
    "securityId": "sec-001",
    "executionId": "exe-001",
    "side": "BUY",
    "quantity": 40,
    "price": "24900"
  }
}
```

### 4.2. Ý nghĩa các định danh

| Trường | Ý nghĩa |
|---|---|
| `eventId` | Định danh một sự kiện |
| `executionId` | Định danh giao dịch thực hiện |
| `aggregateId` | Đối tượng phát sinh thay đổi, ở đây là order |
| `aggregateVersion` | Phiên bản order tại thời điểm tạo sự kiện |
| `schemaVersion` | Phiên bản cấu trúc event |

Khi gửi lại cùng event, giữ nguyên `eventId`.

Nếu producer tạo UUID mới mỗi lần retry, dedup theo event ID sẽ không còn đủ.

### 4.3. Aggregate version khác sequence bảng giá

Ngày 17, mỗi update quote của một luồng có sequence liên tiếp.

Ngày 18, consumer chỉ nhận `ExecutionApplied`, trong khi order còn có:

```text
OrderAccepted
CancelRequested
CancelConfirmed
```

Vì vậy:

```text
aggregateVersion 3 rồi 5
```

chưa chứng minh thiếu execution. Phiên bản 4 có thể là sự kiện khác mà consumer không đăng ký.

Không áp dụng máy móc quy tắc `version phải tăng đúng 1` của luồng quote vào consumer này.

---

## 5. Phạm vi projection của bài

Để vừa sức trong một buổi, consumer chỉ xử lý **BUY execution**:

```text
economicQuantity += quantity
totalCost += price × quantity
```

Ví dụ:

| Event | Delta số lượng | Delta giá vốn |
|---|---:|---:|
| E1: BUY 40 @24.900 | +40 | +996.000 |
| E2: BUY 20 @25.000 | +20 | +500.000 |
| Tổng | **60** | **1.496.000** |

Giá vốn bình quân là dữ liệu suy ra:

```text
1.496.000 / 60 = 24.933,333333… đồng/cổ phiếu
```

Projection này chưa biểu diễn lượng có thể bán hoặc trạng thái thanh toán.

BUY cộng số lượng và chi phí có thể được tổng hợp theo cách này. SELL, điều chỉnh và giá vốn phân bổ cần thêm thiết kế thứ tự xử lý theo vị thế; chưa mở rộng vội trong ngày 18.

Event không thuộc phạm vi phải được báo rõ, không âm thầm coi như đã xử lý thành công.

---

## 6. Database MySQL

### 6.1. Bảng chống trùng

```sql
CREATE TABLE processed_events (
    consumer_name VARCHAR(64) NOT NULL,
    event_id VARCHAR(64) NOT NULL,

    event_type VARCHAR(64) NOT NULL,
    business_key VARCHAR(191) NOT NULL,

    event_hash BINARY(32) NOT NULL,
    business_hash BINARY(32) NOT NULL,

    processed_at TIMESTAMP(3) NOT NULL,

    PRIMARY KEY (consumer_name, event_id),

    UNIQUE KEY uq_consumer_business (
        consumer_name,
        business_key
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Business key đề xuất:

```text
BUY:<accountId>:<orderId>:<executionId>
```

Hai lớp kiểm tra:

| Trường hợp | Kết quả |
|---|---|
| Cùng event ID, cùng nội dung | Bản giao lại, không áp dụng thêm |
| Cùng event ID, nội dung khác | Xung đột dữ liệu |
| Event ID khác, cùng execution và nội dung nghiệp vụ | Business duplicate, không áp dụng thêm |
| Cùng execution nhưng giá/khối lượng khác | Xung đột, cần điều tra |

`event_hash` tính từ nội dung bất biến của event đã chuẩn hóa; không tính các metadata thay đổi theo lần giao như delivery attempt.

`business_hash` tính từ các thuộc tính nghiệp vụ như account, order, execution, security, side, quantity và price.

Không hash trực tiếp chuỗi JSON chưa chuẩn hóa.

### 6.2. Bảng projection

```sql
CREATE TABLE portfolio_projections (
    consumer_name VARCHAR(64) NOT NULL,
    account_id VARCHAR(36) NOT NULL,
    security_id VARCHAR(36) NOT NULL,

    economic_quantity BIGINT UNSIGNED NOT NULL DEFAULT 0,
    total_cost DECIMAL(20,0) NOT NULL DEFAULT 0,

    last_processed_at TIMESTAMP(3) NULL,

    PRIMARY KEY (
        consumer_name,
        account_id,
        security_id
    ),

    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (security_id) REFERENCES securities(id),

    CONSTRAINT chk_projection_cost CHECK (
        total_cost >= 0
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Có `consumer_name` trong projection để các consumer thử nghiệm độc lập không cùng cộng vào một hàng.

Tạo hàng projection rỗng cho fixture trước khi chạy bài. Không copy vị thế hiện tại vào projection rồi phát lại toàn bộ lịch sử trên đó — cách đó sẽ cộng trùng.

---

## 7. Transaction xử lý event

### 7.1. Luồng chuẩn

```text
Validate event
→ Chuẩn hóa, tính hash và business key
→ BEGIN
→ INSERT processed_events
→ Khóa projection
→ Cập nhật projection
COMMIT
→ Xác nhận đã xử lý với bộ giao sự kiện
```

Chèn marker trước cập nhật **vẫn an toàn nếu cả hai nằm trong cùng transaction và chưa commit riêng**.

Trạng thái “đã xử lý” chỉ có hiệu lực bền vững sau khi cả transaction commit.

### 7.2. Những cách làm sai

```text
Commit processed_events
→ Cập nhật projection thất bại
```

Retry thấy marker và bỏ qua. Dữ liệu bị mất cập nhật.

Hoặc:

```text
Commit projection
→ Ghi processed_events thất bại
```

Retry cộng projection lần hai.

### 7.3. Nếu gặp unique conflict

Sau khi lỗi trùng đúng constraint dedup:

1. Rollback transaction hiện tại.
2. Đọc bản ghi đã commit bằng truy vấn/transaction mới.
3. So sánh hash.
4. Trả kết quả duplicate hoặc conflict phù hợp.

MySQL có thể chỉ rollback statement gây duplicate key, không tự kết thúc toàn transaction. Vì vậy cần rollback rõ ràng trước khi chuyển sang luồng đọc bản ghi cũ. [dev.mysql.com](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html?utm_source=chatgpt.com)

Không coi mọi lỗi duplicate key ở mọi bảng là event đã xử lý.

### 7.4. Hai worker nhận cùng event

Unique constraint là điểm phân xử:

```text
Worker A giành được marker và cập nhật.
Worker B chờ hoặc gặp duplicate.
```

Nếu A rollback, B có thể xử lý event.

Nếu A commit, B đọc kết quả và không cập nhật thêm.

---

## 8. ACK, retry và lỗi

### 8.1. ACK sau commit

Nếu dùng RabbitMQ:

```text
Commit MySQL thành công
→ ACK delivery
```

ACK xác nhận consumer đã xử lý delivery; nó không phải publisher confirm. Hai cơ chế có trách nhiệm khác nhau. [RabbitMQ](https://www.rabbitmq.com////////////////////docs/confirms?utm_source=chatgpt.com)

Nếu commit thành công nhưng ACK thất bại, lần giao lại sẽ đi qua dedup.

Nếu gặp duplicate hợp lệ, có thể ACK mà không cập nhật projection.

### 8.2. Phân loại lỗi

| Lỗi | Cách xử lý |
|---|---|
| Deadlock hoặc lỗi kết nối tạm thời | Retry có giới hạn |
| Sai schema, giá hoặc quantity không hợp lệ | Không retry vô hạn |
| Cùng event ID nhưng nội dung khác | Đưa vào luồng điều tra/quarantine |
| Loại event chưa hỗ trợ | Báo rõ, không giả vờ xử lý xong |
| Projection chưa được khởi tạo đúng | Báo lỗi cấu hình/khởi tạo |

Đề xuất demo:

```text
Tối đa 5 lần thử.
Backoff có giới hạn.
Sau đó ghi nhận failed/quarantine để kiểm tra.
```

Không requeue liên tục một poison message khiến consumer chạy vòng lặp nóng.

Với test harness, chỉ cần mô phỏng `ack`, retry và quarantine. Chưa cần cài broker.

---

## 9. Giới hạn producer — phần ngày 20 sẽ giải quyết

Trong ngày 18, bạn có thể tạo event từ fixture hoặc giao thủ công sau khi transaction execution commit.

Nhưng vẫn có khoảng lỗi:

```text
Transaction execution commit.
Backend dừng trước khi phát event.
```

Consumer dedup không giải quyết việc **event chưa được phát**.

Ngày 20 sẽ bổ sung Transactional Outbox để lưu dữ liệu nghiệp vụ và event cần phát trong cùng transaction.

Hôm nay không phát event trước commit để né khoảng lỗi trên, vì khi rollback có thể để lại event mô tả giao dịch chưa tồn tại.

---

## 10. Bài thực hành — 30–60 phút

Dùng tài khoản fixture mới `acc-018` và projection ban đầu:

```text
economicQuantity = 0
totalCost = 0
consumerName = portfolio-view-v1
```

Không sửa số dư hoặc vị thế nguồn của tài khoản trong bài consumer.

**Bước 1 — Giao E1**

```text
eventId = evt-001
executionId = exe-001
BUY 40 @24.900
```

Kỳ vọng:

```text
Quantity = 40.
Cost = 996.000.
Có một processed event.
```

**Bước 2 — Giao lại E1**

Kỳ vọng:

```text
Quantity vẫn 40.
Cost vẫn 996.000.
Không thêm tác động.
```

**Bước 3 — Giao E2**

```text
eventId = evt-002
executionId = exe-002
BUY 20 @25.000
```

Kỳ vọng:

```text
Quantity = 60.
Cost = 1.496.000.
```

**Bước 4 — Lỗi trước commit**

Chủ động gây lỗi sau khi cập nhật projection nhưng trước commit.

Kỳ vọng:

```text
Projection rollback.
Marker rollback.
Retry xử lý được đúng một lần.
```

**Bước 5 — Lỗi sau commit, trước ACK**

Không gửi ACK ở lần đầu, rồi giao lại event.

Kỳ vọng: dữ liệu không tăng lần hai.

**Bước 6 — Trùng nghiệp vụ với event ID khác**

Tạo `evt-003` nhưng vẫn tham chiếu `exe-001` với nội dung giống E1.

Kỳ vọng: nhận diện business duplicate, không cộng thêm 40.

Đổi giá của cùng execution thành 24.800: phải báo conflict, không cập nhật.

---

## 11. Kiểm thử và debug

| Kiểm thử | Kết quả |
|---|---|
| Cùng event giao hai lần | Một tác động |
| Hai worker xử lý cùng event | Một tác động |
| Restart consumer rồi giao lại | Marker MySQL vẫn có hiệu lực |
| Cùng execution, event ID khác | Không cộng nghiệp vụ lần hai |
| Cùng ID, khác nội dung | Conflict |
| Lỗi sau insert marker | Rollback marker và projection |
| Lỗi sau update projection | Rollback cả hai |
| Commit rồi mất ACK | Giao lại không cộng thêm |
| Hai consumer logic độc lập | Mỗi consumer xử lý cho read model riêng |
| Quantity/price sai | Không có cập nhật |
| Consumer chạy nhiều lần | Accounts và cash ledger nguồn không đổi |

**Debug A — Marker lưu bằng Redis với TTL**

Marker hết hạn trong khi event cũ vẫn có thể được phát lại. Projection bị cộng thêm.

Bài này lưu marker bền trong MySQL; chưa tự xóa dedup history.

**Debug B — Mỗi lần retry đổi eventId**

Dedup event ID không nhận ra bản giao lại. Business key là lớp bảo vệ bổ sung, nhưng producer vẫn phải giữ event ID ổn định.

**Debug C — Đổi consumerName khi restart**

Tên mới làm mọi event trông như chưa được xử lý.

Dùng consumer name logic cố định. Nếu chủ động tạo projection phiên bản mới, cần kế hoạch khởi tạo/backfill riêng.

**Debug D — Consumer cập nhật cả projection lẫn positions**

Execution nguồn đã cập nhật positions. Consumer lại cộng positions lần nữa.

Consumer hôm nay chỉ ghi bảng projection và marker do nó quản lý.

---

## 12. Quan sát và quyền truy cập

Log tối thiểu:

```text
consumerName
eventId
executionId
accountId
orderId
attempt
outcome
durationMs
```

Outcome gợi ý:

```text
APPLIED
DUPLICATE
BUSINESS_DUPLICATE
CONFLICT
RETRY
QUARANTINED
```

Không đưa token hoặc mật khẩu vào event/log.

Nếu thêm API xem projection:

```http
GET /api/accounts/:id/portfolio-projection
```

áp dụng `ACCOUNT_READ` của ngày 16 và ghi rõ đây là dữ liệu dẫn xuất thử nghiệm.

Không mở API cho khách hàng tùy ý POST event tài sản. Việc giao event đi qua harness nội bộ hoặc nguồn được cấu hình tin cậy.

---

## 13. Prompt cho OpenCode

```text
Tôi đang học ngày 18 của Securities Trading Simulator:
Sự kiện, retry và chống xử lý trùng.

Môi trường:
- Node.js + TypeScript, MySQL.
- OpenCode, cấu hình model hiện tại.
- Giữ kiến trúc và authorization ngày 1–17.

Trước khi code:
1. Đọc execution handler và dedup nghiệp vụ ngày 10–11.
2. Xác định dữ liệu đã được cập nhật trong transaction nguồn.
3. Đề xuất phạm vi 30–60 phút.
4. Không chuyển cập nhật tài sản nguồn sang async hôm nay.

Phạm vi:
- Event ExecutionApplied schemaVersion1.
- Consumer portfolio-view-v1.
- Chỉ BUY.
- Ghi read model riêng portfolio_projections.
- Không ghi positions, cash_balances, reservations hoặc ledger nguồn.
- Broker chưa bắt buộc; dùng harness có ack/retry/quarantine.

Event:
eventId, type, schemaVersion, aggregateId,
aggregateVersion, occurredAt, payload.
Payload:
accountId, orderId, securityId, executionId,
side BUY, quantity, price chuỗi số nguyên.

Quy tắc:
- Event mô tả execution đã commit.
- Retry giữ nguyên eventId.
- ConsumerName là tên logic ổn định, không phải worker UUID.
- Không yêu cầu aggregateVersion liên tiếp:
  consumer chỉ nhận một tập con sự kiện order.
- Không dùng bản tin giá ngày17 như sự kiện tài sản.

Database:
- processed_events theo schema bài:
  PK consumerName/eventId,
  unique consumerName/businessKey,
  eventHash và businessHash.
- portfolio_projections:
  PK consumerName/accountId/securityId,
  economicQuantity, totalCost, lastProcessedAt.
- Seed projection rỗng cho fixture acc-018/sec-001.
- Không copy current position rồi replay toàn lịch sử lên đó.
- Tiền bigint/DECIMAL(20,0), JSON chuỗi.

Dedup:
- BusinessKey BUY:accountId:orderId:executionId.
- Canonicalize trước hash.
- Event hash không chứa delivery attempt/metadata vận chuyển.
- Cùng event ID và nội dung: DUPLICATE.
- Cùng event ID khác nội dung: CONFLICT.
- Khác event ID nhưng cùng execution và business content:
  BUSINESS_DUPLICATE, không áp dụng.
- Cùng execution khác giá/quantity: CONFLICT.

Transaction:
- Validate trước ghi.
- BEGIN.
- Insert marker.
- Lock projection.
- Quantity += event.quantity.
- TotalCost += price*quantity.
- COMMIT.
- Chỉ ACK sau commit.
- Marker và update cùng connection/transaction.
- Duplicate đúng constraint:
  rollback transaction hiện tại rồi đọc bản ghi đã commit,
  kiểm tra hash trước khi kết luận duplicate.
- Duplicate ở bảng khác không được coi là thành công.
- Không commit marker riêng.

Retry:
- Lỗi tạm thời: bounded retry, tối đa5 lần trong demo.
- Payload/schema sai, conflict: quarantine/báo lỗi,
  không retry nóng vô hạn.
- Commit xong mất ACK: giao lại đi qua dedup.
- Không cần cài RabbitMQ nếu project chưa có.
- Nếu có broker, dùng manual ack và kiểm tra cả delivery đầu,
  không chỉ tin cờ redelivered.

Fixture:
E1 evt-001/exe-001 BUY40@24900.
E2 evt-002/exe-002 BUY20@25000.
Kỳ vọng sau E1,E1,E2:
quantity60, totalCost1496000.

Kiểm thử:
- Duplicate và concurrent same event.
- Restart consumer rồi giao lại.
- Cùng execution khác eventId.
- Same ID khác content.
- Failure sau marker insert.
- Failure sau projection update trước commit.
- Commit rồi không ACK, sau đó redelivery.
- Hai logical consumers có marker/read model độc lập.
- Invalid input không ghi dữ liệu.
- Source Accounts không thay đổi.

Quan sát:
- Log consumer/event/execution/order/account/attempt/outcome.
- Không log token/password.
- API đọc projection nếu có phải kiểm tra ACCOUNT_READ.
- Không mở API customer tự phát event nghiệp vụ.

Giới hạn cần ghi rõ:
- Producer có thể commit rồi chưa phát event.
- Ngày18 chưa giải quyết khoảng lỗi đó.
- Không phát trước commit để né lỗi.
- Transactional Outbox sẽ làm ngày20.
- Chưa xử lý SELL, correction hoặc thứ tự vị thế tổng quát.

Sau khi làm:
- Chạy kiểm tra phù hợp, báo kết quả thực tế.
- Cập nhật README về event contract, dedup, retry và giới hạn.
- Giải thích vì sao commit marker riêng làm mất cập nhật.
```

**Ngày 18 hoàn thành khi:**

- [ ] Giao lại event không làm tăng projection lần hai.
- [ ] Marker và dữ liệu cập nhật cùng transaction.
- [ ] Commit xong mất ACK vẫn phục hồi an toàn.
- [ ] Phân biệt event duplicate với business duplicate.
- [ ] Lỗi dữ liệu không bị retry vô hạn.
- [ ] Consumer không ghi lại vào tài sản nguồn đã được cập nhật.
- [ ] Bạn hiểu consumer dedup chưa giải quyết việc producer chưa phát event.

Ngày 19 sẽ đào sâu **concurrency và chống dùng tài sản vượt mức**, gồm hai lệnh cạnh tranh cùng số dư và xung đột giữa khớp với hủy.
