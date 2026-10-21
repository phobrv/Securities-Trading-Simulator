# Ngày 26 — Structured logging, audit trail và metrics: theo dõi một lệnh từ API đến khớp lệnh

Ngày 25, bạn đã nối OMS với matching engine và xử lý tình huống **khớp một phần trong khi yêu cầu hủy đang chờ**. Hôm nay, bạn bổ sung khả năng trả lời ba câu hỏi:

- Lệnh này đã đi qua những bước nào?
- Ai đã thực hiện thao tác và kết quả được ghi nhận ra sao?
- Hệ thống đang gặp lỗi ở bước nào?

Môi trường tiếp tục sử dụng **MySQL, Vue 3 + TypeScript + Tailwind CSS, Node.js + TypeScript, Redis, WebSocket và OpenCode với cấu hình model bạn đã chọn**.

Toàn bộ số liệu bên dưới là dữ liệu của simulator.

---

## 1. Mục tiêu và sản phẩm cuối ngày

Sau ngày 26, bạn cần có:

| Sản phẩm | Mục đích |
|---|---|
| Log JSON có cấu trúc | Tìm lỗi theo request, order và execution |
| Audit trail cho thao tác nghiệp vụ | Biết ai làm gì, trên đối tượng nào |
| Metrics vận hành | Nhìn thấy lỗi, độ trễ và công việc tồn đọng |
| API tra cứu lịch sử một lệnh | Gom dữ liệu để kiểm tra theo thứ tự |
| Kịch bản điều tra sự cố | Thực hành tìm nguyên nhân từ bằng chứng |

Phân bổ thời gian:

| Thời lượng | Nội dung |
|---|---|
| 30 phút | Phân biệt log, audit và ledger |
| 30 phút | Thiết kế ID liên kết, sự kiện và metrics |
| 30–60 phút | Triển khai, chạy một luồng lệnh và điều tra lỗi |

Nếu thời gian hạn chế, ưu tiên **log có cấu trúc, audit đúng transaction và tra cứu lịch sử lệnh**.

---

## 2. Phân biệt log, audit trail và ledger

Ba loại dữ liệu này phục vụ những câu hỏi khác nhau.

| Loại | Câu hỏi chính | Ví dụ |
|---|---|---|
| Technical log | Hệ thống đã xử lý thế nào? | Worker gửi event thất bại |
| Audit trail | Ai thực hiện thao tác nào? | Người dùng yêu cầu hủy lệnh |
| Financial ledger / position movement | Tiền và chứng khoán thay đổi bao nhiêu? | Giảm tiền giữ, tăng nghĩa vụ thanh toán |

Ví dụ khi BUY khớp 40 cổ phiếu:

- **Log:** ExecutionProcessingService xử lý execution thành công.
- **Audit:** Hệ thống áp dụng execution cho lệnh.
- **Cash ledger:** Giảm `reservedCash`, tăng `buyPayable`.
- **Position movement:** Tăng `pendingBuyQuantity`, tăng giá vốn.

**Không dùng log để tính lại số dư hiển thị.** Số dư vẫn lấy từ nguồn dữ liệu Accounts, còn ledger và movement phục vụ đối chiếu.

Tương tự, dòng log “execution received” chỉ cho biết hệ thống nhận được thông tin; chưa chứng minh transaction nghiệp vụ đã commit.

---

## 3. Các ID cần liên kết xuyên suốt hệ thống

Không nên dùng một ID cho mọi mục đích.

| ID | Phạm vi | Có đổi khi thử lại không? |
|---|---|---|
| `requestId` | Một HTTP request | Có |
| `correlationId` | Một luồng thao tác | Giữ nguyên khi tiếp tục cùng luồng |
| `idempotencyKey` | Một ý định gửi lệnh bất biến | Không |
| `orderId` | Lệnh trong OMS | Không |
| `executionId` | Một lần khớp | Không |
| `eventId` | Một event outbox | Không khi gửi lại |
| `auditId` | Một bản ghi audit | Mỗi bản ghi có ID riêng |

Ví dụ người dùng gửi BUY, mất kết nối rồi gửi lại:

```text
Lần gửi đầu:
requestId     = req-026-a
correlationId = cor-026-create
idempotencyKey = intent-026-buy-01

Lần thử lại:
requestId     = req-026-b
correlationId = cor-026-create
idempotencyKey = intent-026-buy-01
```

Kết quả vẫn chỉ có **một lệnh và một lần giữ tiền**.

Yêu cầu hủy sau đó là một thao tác riêng, có thể có correlation mới. Cả hai luồng vẫn liên kết qua `orderId`.

Quy tắc cho demo:

- Backend sinh `requestId` cho từng request.
- Backend có thể nhận correlation từ client sau khi kiểm tra độ dài và định dạng; nếu không hợp lệ thì sinh mới.
- `actorUserId` luôn lấy từ principal đã xác thực.
- ID phục vụ truy vết **không thay thế kiểm tra quyền hoặc cơ chế chống trùng**.

---

## 4. Thiết kế log JSON

Một bản ghi mẫu:

```json
{
  "timestamp": "2026-10-21T03:00:01.245Z",
  "level": "info",
  "service": "trading-api",
  "module": "execution-processing",
  "event": "execution.apply.completed",
  "requestId": null,
  "correlationId": "cor-026-create",
  "orderId": "ord-026-001",
  "executionId": "exec-026-001",
  "outboxEventId": "evt-026-001",
  "side": "BUY",
  "quantity": 40,
  "price": "24900",
  "durationMs": 18,
  "outcome": "APPLIED"
}
```

Ở worker chạy bất đồng bộ, `requestId` có thể không còn phù hợp. Khi đó dùng `correlationId`, `eventId` và ID nghiệp vụ để liên kết.

**Các sự kiện log nên có:**

| Sự kiện | Ý nghĩa |
|---|---|
| `http.request.completed` | Request kết thúc với mã HTTP và thời gian xử lý |
| `order.create.committed` | Lệnh, giữ tài sản và dữ liệu liên quan đã commit |
| `order.create.replayed` | Trả lại kết quả idempotency đã lưu |
| `order.cancel.requested` | Yêu cầu hủy đã được ghi nhận |
| `execution.apply.completed` | Execution đã được áp dụng và commit |
| `execution.apply.duplicate` | Execution trùng đã được xác minh |
| `execution.apply.conflict` | Cùng danh tính nhưng nội dung khác |
| `outbox.delivery.failed` | Một lần giao event thất bại |
| `outbox.delivery.completed` | Event đã được giao theo hợp đồng transport |
| `settlement.apply.completed` | Nghĩa vụ đã được thanh toán thành công |

**Chỉ ghi `committed` hoặc `completed` sau khi commit thành công.**

Nếu một execution bị rollback:

```json
{
  "level": "error",
  "module": "execution-processing",
  "event": "execution.apply.failed",
  "orderId": "ord-026-001",
  "executionId": "exec-026-001",
  "errorCode": "OUTBOX_APPEND_FAILED",
  "transactionOutcome": "ROLLED_BACK"
}
```

Không ghi password, JWT, Authorization header, cookie, chuỗi kết nối hoặc toàn bộ request body. Với lỗi SQL, ghi mã lỗi và ngữ cảnh đã lọc; tránh đưa nguyên câu SQL chứa dữ liệu nhạy cảm vào log.

---

## 5. Giữ riêng thời gian nghiệp vụ và thời gian vận hành

Simulator có thể thay đổi ngày giao dịch bằng `FixedClock`. Điều đó không được làm sai việc đo độ trễ.

| Trường | Nguồn thời gian |
|---|---|
| `businessOccurredAt` | Market Clock của simulator |
| `recordedAt` / timestamp log | Đồng hồ vận hành |
| `durationMs` | Bộ đo thời gian trôi qua độc lập Market Clock |
| Thời điểm retry worker | Worker Clock |
| Hạn token | Auth Clock |

Ví dụ bạn chuyển ngày giao dịch sang T+2 để chạy settlement:

- JWT không tự hết hạn vì thao tác đổi Market Clock.
- Retry outbox không chờ thêm hai ngày.
- Độ trễ API không tăng thành hàng triệu mili giây.

Trong audit nên lưu cả **thời điểm nghiệp vụ** và **thời điểm ghi nhận** khi hai giá trị có thể khác nhau.

---

## 6. Bổ sung audit trail trên MySQL

Nếu đã có bảng audit từ ngày 16, hãy mở rộng bảng đó thay vì tạo thêm một hệ thống audit song song.

Các trường đề xuất:

| Trường | Nội dung |
|---|---|
| `audit_id` | ID duy nhất |
| `action` | `ORDER_CREATE`, `ORDER_CANCEL_REQUEST`, `EXECUTION_APPLY`… |
| `outcome` | `ACCEPTED`, `REPLAYED`, `DENIED`, `APPLIED`, `REJECTED`… |
| `actor_type` | `USER` hoặc `SYSTEM` |
| `actor_user_id` | Nullable đối với tác vụ hệ thống |
| `account_id` | Tài khoản liên quan |
| `order_id` | Lệnh liên quan |
| `execution_id` | Execution liên quan |
| `request_id` | Request gây ra thao tác, nếu có |
| `correlation_id` | Liên kết luồng |
| `reason_code` | Mã lý do ổn định |
| `details` | JSON với các trường được cho phép |
| `business_occurred_at` | Thời điểm nghiệp vụ |
| `recorded_at` | Thời điểm ghi nhận |

Chỉ mục ưu tiên:

```text
(order_id, recorded_at, audit_id)
(correlation_id, recorded_at, audit_id)
(account_id, recorded_at, audit_id)
```

**Quy tắc transaction:**

- Audit xác nhận thay đổi nghiệp vụ thành công phải nằm **cùng transaction MySQL** với thay đổi đó.
- Nếu transaction rollback, bản ghi audit thành công cũng rollback.
- Audit cho thao tác bị từ chối được ghi riêng sau khi quyết định từ chối.
- Lỗi ghi audit cho thao tác bị từ chối không được biến yêu cầu đó thành thao tác được phép.
- Replay có thể thêm audit `REPLAYED`, nhưng không tạo lại lệnh, ledger hoặc giữ tài sản.

Trong phạm vi demo, audit là dữ liệu chỉ thêm qua ứng dụng. Điều này chưa đồng nghĩa với khả năng chống sửa bởi người có toàn quyền quản trị database.

---

## 7. Truyền ngữ cảnh qua outbox

Event của ngày 20 đã có danh tính ổn định. Hôm nay bổ sung metadata phục vụ truy vết:

```json
{
  "eventId": "evt-026-001",
  "type": "ExecutionApplied",
  "schemaVersion": 1,
  "aggregateId": "ord-026-001",
  "aggregateVersion": 3,
  "metadata": {
    "correlationId": "cor-026-create",
    "causationId": "exec-026-001"
  },
  "payload": {
    "accountId": "acc-026",
    "orderId": "ord-026-001",
    "securityId": "sec-001",
    "executionId": "exec-026-001",
    "side": "BUY",
    "quantity": 40,
    "price": "24900"
  }
}
```

Metadata này phải được lưu để worker gửi lại cùng nội dung đã ghi nhận.

Các trường của **từng lần giao** như `deliveryAttempt` hoặc thời điểm gửi thuộc ngữ cảnh transport/log. Không đưa chúng vào phần nội dung bất biến dùng để kiểm tra trùng event.

Giữ các nguyên tắc:

- Gửi lại không sinh `eventId` mới.
- Không tái dựng payload từ trạng thái hiện tại của order.
- Không đổi thuật toán hash khiến event cũ bị hiểu nhầm là xung đột.
- BUY tiếp tục dùng consumer đã xây dựng; chưa đưa SELL vào consumer BUY-only.

---

## 8. Metrics: đo ít nhưng trả lời được câu hỏi

Bắt đầu với những chỉ số sau:

| Metric đề xuất | Loại | Trả lời câu hỏi |
|---|---|---|
| `http_requests_total` | Counter | Có bao nhiêu request và kết quả gì? |
| `http_request_duration_seconds` | Histogram | API đang chậm đến mức nào? |
| `order_create_total` | Counter | Bao nhiêu lệnh được chấp nhận, từ chối, replay? |
| `execution_apply_total` | Counter | Bao nhiêu execution applied, duplicate, conflict? |
| `outbox_pending_count` | Gauge | Có bao nhiêu event đang chờ? |
| `outbox_oldest_pending_age_seconds` | Gauge | Event chờ lâu nhất bao lâu? |
| `outbox_delivery_attempts_total` | Counter | Có bao nhiêu lần giao thành công/thất bại? |
| `consumer_events_total` | Counter | Consumer applied, duplicate hay conflict? |
| `settlement_pending_due_count` | Gauge | Có bao nhiêu nghĩa vụ đã đến hạn chưa xử lý? |

Label có thể dùng:

```text
route="/api/orders/:id"
method="GET"
status_class="2xx"
outcome="APPLIED"
reason_code="INSUFFICIENT_AVAILABLE_CASH"
```

Không dùng `orderId`, `accountId`, `eventId`, URL có ID thực hoặc nội dung lỗi tự do làm metric label. Các giá trị đó phục vụ log và tra cứu từng trường hợp.

Counter trong bộ nhớ có thể reset khi tiến trình khởi động lại. Vì vậy:

- Metrics dùng để quan sát vận hành.
- Báo cáo nghiệp vụ chính xác vẫn truy vấn dữ liệu đã commit.
- Gauge tồn đọng outbox nên đọc từ MySQL theo chu kỳ và ghi nhận thời điểm lấy mẫu.

Không bắt buộc thêm cả bộ công cụ giám sát hôm nay. Có thể bắt đầu bằng endpoint metrics nội bộ, được giới hạn truy cập.

---

## 9. API tra cứu lịch sử một lệnh

Đề xuất:

```http
GET /api/orders/:orderId/timeline
```

API kiểm tra quyền READ trên tài khoản thực của order trước khi trả dữ liệu.

Nguồn dữ liệu:

- `order_events`;
- `order_executions` và `executions`;
- cash ledger hoặc position movements liên quan;
- settlement obligations;
- audit nghiệp vụ được phép hiển thị.

Ví dụ rút gọn:

```json
{
  "orderId": "ord-026-001",
  "status": "CANCELED",
  "orderVersion": 6,
  "items": [
    {
      "type": "ORDER_ACCEPTED",
      "orderSequence": 2
    },
    {
      "type": "EXECUTION_APPLIED",
      "orderSequence": 3,
      "executionId": "exec-026-001",
      "quantity": 40,
      "price": "24900"
    },
    {
      "type": "CANCEL_REQUESTED",
      "orderSequence": 4
    },
    {
      "type": "EXECUTION_APPLIED",
      "orderSequence": 5,
      "executionId": "exec-026-002",
      "quantity": 20,
      "price": "25000"
    },
    {
      "type": "CANCEL_CONFIRMED",
      "orderSequence": 6,
      "canceledQuantity": 40
    }
  ]
}
```

Ví dụ này giả định tạo order là version 1 và mỗi bước trên tăng một version.

**Thứ tự trạng thái OMS dựa trên sequence của order**, không chỉ timestamp. FixedClock có thể khiến nhiều sự kiện có cùng thời gian.

Outbox delivery và audit có thể được bổ sung như các bản ghi liên quan; không tự gán cho chúng thứ tự nhân quả chỉ vì timestamp gần nhau.

API khách hàng không trả stack trace, SQL, metadata hạ tầng hoặc audit của tài khoản khác. Thông tin vận hành chi tiết dành cho endpoint OPS riêng.

---

## 10. Bài thực hành: điều tra luồng BUY của ngày 25

Tạo fixture riêng `acc-026`, không reset dữ liệu các ngày trước:

```text
Tiền đã thanh toán: 10.000.000
Chứng khoán ban đầu: 0

BUY 100 @ 25.000
Khớp lần 1: 40 @ 24.900
Yêu cầu hủy
Khớp lần 2: 20 @ 25.000
Hủy phần còn lại: 40
```

Kết quả mong đợi:

| Chỉ tiêu | Giá trị |
|---|---:|
| Trạng thái order | CANCELED |
| Filled quantity | 60 |
| Canceled quantity | 40 |
| Reserved cash | 0 |
| Buy payable | 1.496.000 |
| Available cash | 8.504.000 |
| Pending buy quantity | 60 |
| Tổng giá vốn | 1.496.000 |
| Tổng tiền đã giải phóng khỏi reservation | 1.004.000 |

Sau đó mô phỏng **consumer commit thành công nhưng worker chưa đánh dấu outbox DELIVERED**.

Khi worker thử lại, cần quan sát được:

1. Cùng `eventId` được giao lại.
2. Log có lần giao mới.
3. Consumer xác minh duplicate.
4. Projection không tăng thêm.
5. Outbox chuyển sang DELIVERED sau kết quả xác nhận phù hợp.
6. Tiền, vị thế và nghĩa vụ tại nguồn không đổi.

Không dùng cách khởi động lại toàn bộ matching engine rồi tự gửi lại các lệnh NEW để thực hiện bài kiểm tra này.

---

## 11. Những kiểm tra cần hoàn thành

| Tình huống | Kết quả cần chứng minh |
|---|---|
| Gửi lại POST cùng key và payload | Request ID mới, cùng order, không giữ tiền lần hai |
| Transaction execution rollback | Không có audit APPLIED hoặc log completed sai |
| Outbox giao lại event | Cùng event ID, projection chỉ thay đổi một lần |
| Cùng execution ID nhưng đổi giá | Conflict, không thay đổi tài sản |
| Người dùng không có quyền đọc order | Không lấy được timeline |
| Đổi Market Clock sang T+2 | Độ trễ, retry và auth vẫn dùng đúng đồng hồ |
| Dữ liệu chứa chuỗi nhạy cảm | Không xuất hiện trong log |
| Hủy khi đã khớp 60/100 | Timeline giải thích được vì sao chỉ giải phóng 40 còn lại |

Tập trung kiểm tra những hành vi này; không cần viết test chỉ để xác nhận logger in ra từng trường cố định.

---

## 12. Prompt cho OpenCode

```text
Triển khai ngày 26 cho Securities Trading Simulator hiện tại.

Môi trường:
- Backend Node.js + TypeScript, modular monolith.
- MySQL/InnoDB.
- Redis, WebSocket.
- Frontend Vue 3 + TypeScript + Tailwind CSS.
- Giữ nguyên kiến trúc và thư viện đang dùng nếu phù hợp.

Trước khi sửa:
1. Đọc code hiện tại của request context, auth, audit, OMS,
   execution processing, outbox và consumer dedup.
2. Xác định phần đã có; mở rộng thay vì tạo hệ thống song song.
3. Không thay đổi thuật toán matching hoặc công thức tài sản.

A. Request context và structured logging
- Sinh requestId riêng cho mỗi HTTP request.
- Hỗ trợ correlationId đã kiểm tra định dạng và giới hạn độ dài.
- Actor lấy từ principal xác thực.
- Truyền context qua service và luồng bất đồng bộ.
- Log JSON với event name, module, outcome, duration và ID liên quan.
- Chỉ log committed/completed sau commit.
- Không log JWT, password, cookie, secrets hoặc toàn bộ request body.
- Phân biệt Market Clock, thời gian vận hành và duration.

B. Audit
- Tái sử dụng hoặc mở rộng audit hiện có.
- Audit thay đổi nghiệp vụ thành công phải cùng MySQL transaction.
- Không để audit thành công tồn tại sau rollback.
- Audit denied ghi riêng và không thay đổi quyết định phân quyền.
- Replay được ghi nhận nhưng không tạo lại hiệu ứng nghiệp vụ.
- Chi tiết audit dùng allowlist.

C. Outbox correlation
- Lưu correlationId và causationId ổn định.
- Retry giữ nguyên eventId và nội dung đã lưu.
- Delivery attempt là metadata transport, không làm đổi immutable hash.
- Giữ tương thích với quy tắc dedup và event cũ.
- Không mở rộng consumer BUY-only sang SELL.

D. Metrics
- Đo HTTP count/duration, order outcome, execution outcome,
  outbox pending/oldest age/delivery attempts, consumer outcome
  và settlement đã đến hạn.
- Không dùng orderId/accountId/eventId hoặc raw error làm label.
- Gauge tồn đọng đọc từ nguồn MySQL.
- Endpoint vận hành phải được giới hạn truy cập.

E. Order timeline
- Thêm GET /api/orders/:orderId/timeline.
- Kiểm tra READ trên account thực của order.
- Ghép dữ liệu nghiệp vụ đã commit.
- Dùng order sequence cho thứ tự trạng thái OMS.
- Không trả technical logs, SQL hoặc stack trace cho khách hàng.
- Không suy diễn thứ tự nhân quả giữa các nguồn chỉ từ timestamp.

F. Fixture và kiểm tra
- Tạo acc-026 riêng, không xóa lịch sử cũ.
- BUY 100 @ 25000.
- Fill 40 @ 24900, cancel requested,
  fill 20 @ 25000, cancel remaining 40.
- Kết quả:
  CANCELED, filled 60, canceled 40;
  reservedCash 0;
  buyPayable 1496000;
  availableCash 8504000;
  pendingBuyQuantity 60;
  totalCost 1496000;
  reservation releasedAmount 1004000.
- Kiểm tra replay, rollback, duplicate delivery, conflict,
  quyền đọc timeline và tách biệt các clock.
- Không restart matching rồi tự resubmit DB NEW orders.

Sau khi hoàn thành:
- Tóm tắt thay đổi và migration.
- Nêu lệnh chạy và cách quan sát.
- Báo các kiểm tra thực sự đã chạy cùng kết quả.
- Nêu giới hạn còn lại.
```

**Hoàn thành ngày 26 khi bạn có thể chọn một order và giải thích được toàn bộ quá trình: ai gửi, giữ bao nhiêu tài sản, khớp những lần nào, hủy bao nhiêu, event nào bị gửi lại và vì sao số dư vẫn đúng.**

Ngày 27 sẽ dùng những công cụ này để thực hành **incident lab: gây lỗi có kiểm soát, điều tra và phục hồi trong phạm vi simulator**.
