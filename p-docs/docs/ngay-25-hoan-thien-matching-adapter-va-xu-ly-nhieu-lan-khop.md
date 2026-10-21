# Ngày 25 — Hoàn thiện Matching Adapter và xử lý nhiều lần khớp

Ngày 24 đã bảo vệ tài sản cho cả mua và bán. Hôm nay bạn hoàn thiện cầu nối giữa **OMS và Matching Simulator**:

> “Một lệnh khớp nhiều lần, tại nhiều giá, rồi hủy phần còn lại. OMS và tài sản có phản ánh đúng từng lần không?”

Trọng tâm là **định danh execution, ánh xạ lệnh, thứ tự phản hồi và chống cập nhật trùng**.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Nhiều lần khớp, giá thực hiện và phần còn lại | Tính đúng toàn bộ giao dịch |
| 30 phút kỹ thuật | Adapter, execution contract và đối chiếu | Có luồng nhận kết quả rõ ràng |
| 30–60 phút thực hành | Khớp một phần → khớp thêm → hủy | OMS, tài sản và matching đồng nhất |

**Sản phẩm cuối buổi:**

- Một OMS order ánh xạ đúng với lệnh simulator.
- Mỗi execution có ID ổn định.
- Giao lại execution không tạo thêm tác động.
- Hủy chỉ xử lý phần còn lại sau các lần khớp.
- Bảng giá không tính giao dịch hai lần.
- Có API đọc các execution của một order.

Chưa bắt buộc khôi phục toàn bộ sổ lệnh sau khi tiến trình matching bị mất. Đó là phần mở rộng.

---

## 2. Nghiệp vụ — tính tay trước

### 2.1. Kịch bản chính

Tài khoản mới:

```text
acc-025
Tiền đầu kỳ: 10.000.000 đồng.
Chứng khoán ban đầu: 0.
```

Sổ bán ban đầu:

| Lệnh | Giá | Khối lượng |
|---|---:|---:|
| S1 | 24.900 | 40 |
| S3 | 25.100 | 100 |

Tài khoản đặt:

```text
B1: BUY100, LO25000.
```

Kết quả đầu tiên:

```text
E1: Khớp40 @24900.
B1 còn mua60 @25000.
```

S3 không khớp vì bán cao hơn giới hạn mua.

### 2.2. Gửi hủy nhưng chưa thực hiện hủy trong engine

Người dùng gửi yêu cầu hủy B1:

```text
OMS cancelRequestStatus = PENDING.
B1 vẫn còn trong sổ cho đến khi engine xử lý hủy.
```

Trước khi engine xử lý hủy, một lệnh mới đến:

```text
S2: SELL20, LO24900.
```

B1 đang nằm trong sổ với giá mua25.000. Theo quy tắc giá resting order của simulator:

```text
E2: Khớp20 @25000.
```

Không khớp tại24.900 chỉ vì đó là giá giới hạn của S2.

### 2.3. Sau đó xác nhận hủy

B1 hiện:

```text
Đã khớp60.
Còn40.
```

Engine hủy40 và trả kết quả.

Kết quả cuối:

```text
status = CANCELED
filledQuantity = 60
remainingQuantity = 0
canceledQuantity = 40
```

### 2.4. Giá trị và giá khớp bình quân

```text
E1: 40 × 24.900 = 996.000.
E2: 20 × 25.000 = 500.000.

Tổng khối lượng = 60.
Tổng giá trị = 1.496.000.
```

```text
Giá khớp bình quân
= 1.496.000 / 60
= 24.933,333333… đồng/cổ phiếu.
```

Không lấy giá khớp cuối25.000 làm giá vốn cho toàn bộ60 cổ phiếu.

---

## 3. Các trạng thái tiền cần đạt

| Bước | Reserved cash | Buy payable | Available cash |
|---|---:|---:|---:|
| Ban đầu | 0 | 0 | 10.000.000 |
| Nhận BUY100 @25000 | 2.500.000 | 0 | 7.500.000 |
| E1: 40 @24900 | 1.500.000 | 996.000 | 7.504.000 |
| Yêu cầu hủy | 1.500.000 | 996.000 | 7.504.000 |
| E2: 20 @25000 | 1.000.000 | 1.496.000 | 7.504.000 |
| Xác nhận hủy40 | 0 | 1.496.000 | 8.504.000 |

Khoản giữ cuối cùng:

```text
initialAmount = 2.500.000
remainingAmount = 0
consumedAmount = 1.496.000
releasedAmount = 1.004.000
status = CLOSED
```

Trong `releasedAmount`:

```text
4.000 chênh lệch giá E1
+
1.000.000 tiền giữ cho40 đã hủy.
```

Chứng khoán trước thanh toán:

```text
pendingBuyQuantity = 60
settledQuantity = 0
economicQuantity = 60
availableQuantity = 0

totalCost = 1.496.000
realizedPnl = 0
```

---

## 4. Matching Adapter chịu trách nhiệm gì?

| Việc | Adapter |
|---|---|
| Chuyển OMS order thành lệnh simulator | Có |
| Ánh xạ OMS ID và simulator ID | Có |
| Nhận accepted, execution và cancel result | Có |
| Chuẩn hóa dữ liệu nguồn | Có |
| Tự tính lại kết quả matching | Không |
| Tự cập nhật trực tiếp tiền hoặc vị thế | Không |
| Tạo lệnh mới khi API replay | Không |

Luồng:

```text
OMS command
→ Matching Adapter
→ Matching Engine
→ Phản hồi đã chuẩn hóa
→ Application handler
→ Các module nghiệp vụ trong transaction
```

Giữ thuật toán ưu tiên giá/thời gian trong engine. Không sao chép thuật toán đó sang adapter.

---

## 5. Ánh xạ và định danh

### 5.1. OMS order và simulator order

Ví dụ:

```text
OMS orderId:       ord-025-B1.
Simulator orderId: sim-025-B1.
```

Có thể dùng cùng ID nếu engine hỗ trợ. Nếu không, lưu ánh xạ rõ ràng; không chỉ dựa vào symbol hoặc vị trí trong mảng.

Đề xuất bổ sung vào order hoặc bảng mapping:

```text
simulatorRunId
simulatorOrderId
```

`simulatorRunId` nhận diện lần chạy của engine trong bộ nhớ.

Các lệnh thanh khoản được đánh dấu:

```text
SYSTEM_LIQUIDITY
```

Các lệnh tài khoản:

```text
OMS
```

Không giả định mọi lệnh ở hai phía đều có tài khoản cần hạch toán.

### 5.2. Một execution có một ID ổn định

```text
Matching engine tạo E1 một lần.
Adapter gửi lại E1 nếu cần.
ExecutionId không đổi.
```

Không tạo UUID mới mỗi lần adapter chuyển tiếp cùng một giao dịch.

Một market execution liên kết bên mua và bên bán. Nếu cả hai phía là OMS order, đó vẫn là một giao dịch thị trường, dù có hai tác động tài khoản.

Bài bắt buộc có thể dùng một phía OMS và một phía `SYSTEM_LIQUIDITY`.

---

## 6. Execution contract

```ts
type SimulatorExecution = {
  executionId: string;
  simulatorRunId: string;
  securityId: string;

  buySimulatorOrderId: string;
  sellSimulatorOrderId: string;

  makerSimulatorOrderId: string;
  takerSimulatorOrderId: string;

  price: string;
  quantity: number;
  executedAt: string;
};
```

Sau khi ánh xạ cho một OMS order:

```ts
type OrderExecutionInput = {
  executionId: string;
  orderId: string;
  accountId: string;
  securityId: string;
  side: "BUY" | "SELL";

  lastQuantity: number;
  lastPrice: string;
  executedAt: string;
};
```

Phân biệt:

| Trường | Ý nghĩa |
|---|---|
| `lastQuantity` | Khối lượng riêng execution này |
| `cumulativeFilledQuantity` | Tổng lượng đã khớp của order |
| `remainingQuantity` | Phần còn hoạt động |

Với E2:

```text
lastQuantity = 20.
cumulativeFilledQuantity = 60.
```

OMS phải cộng20, không cộng60.

Nếu adapter nhận cả hai giá trị, dùng cumulative để đối chiếu với kết quả sau cập nhật, không dùng nó như delta.

---

## 7. Lưu execution trong MySQL

Trước đây execution có thể chỉ nằm trong simulator và payload lịch sử. Hôm nay nên có dữ liệu truy vấn trực tiếp.

| Bảng | Nội dung |
|---|---|
| `executions` | Một bản ghi cho mỗi giao dịch thị trường |
| `order_executions` | Liên kết giao dịch với OMS order được hạch toán |

Các trường chính của `executions`:

```text
execution_id — khóa chính
simulator_run_id
security_id
buy_simulator_order_id
sell_simulator_order_id
maker_simulator_order_id
taker_simulator_order_id
price DECIMAL(20,0)
quantity
executed_at
payload_hash
```

Không đặt khóa ngoại từ simulator order ID sang `orders`, vì lệnh `SYSTEM_LIQUIDITY` không nhất thiết có OMS order.

`order_executions`:

```text
order_id
execution_id

PRIMARY KEY(order_id, execution_id)
```

Lưu raw execution, liên kết và tác động tài sản trong transaction xử lý liên quan.

**Quy tắc chống trùng:**

- Cùng executionId, cùng nội dung: không áp dụng thêm.
- Cùng executionId, nội dung khác: conflict.
- Có raw execution chưa đủ chứng minh mọi phía tài khoản đã được hạch toán.
- Kiểm tra liên kết theo OMS order trước khi kết luận tác động của phía đó đã hoàn tất.

Giữ các business key ledger và movement đã có.

---

## 8. Xử lý phản hồi và thứ tự

### 8.1. Accepted trước execution

Đối với mô hình đang học:

```text
OrderReceived
→ OrderAccepted
→ ExecutionReceived
```

Không để callback bất đồng bộ khiến execution vào OMS trước phản hồi accepted.

Nếu transport dùng hàng đợi nội bộ, xử lý phản hồi của cùng order nối tiếp.

### 8.2. Hủy phải đối chiếu tổng khớp

Cancel confirmation:

```json
{
  "simulatorOrderId": "sim-025-B1",
  "cumulativeFilledQuantity": 60,
  "canceledQuantity": 40
}
```

Trước khi áp dụng:

```text
OMS filled phải bằng60.
OMS remaining phải bằng40.
```

Nếu OMS mới biết40 nhưng nguồn báo đã khớp60:

```text
Chưa giải phóng tiền.
Chưa chuyển CANCELED.
Tìm và xử lý execution thiếu.
Đánh giá lại confirmation.
```

Không tự sửa filled từ40 thành60 mà thiếu giá và executionId.

### 8.3. Sequence của nguồn, nếu bổ sung

Có thể đánh số các phản hồi simulator theo từng order:

```text
Accepted1 → E1 số2 → E2 số3 → CancelAck4.
```

Đây là sequence nguồn, không phải `orders.version`. `CancelRequested` do OMS ghi nhận có thể làm version tăng dù simulator chưa phát phản hồi mới.

Nếu phát hiện gap, dừng áp dụng phản hồi phụ thuộc và thực hiện đối chiếu. Không dùng row lock để giả định đã giải quyết thứ tự bản tin.

---

## 9. Cập nhật Market Data đúng một lần

Bảng giá không được cộng volume riêng cho từng phía tài khoản.

Sau E1 và E2:

```text
lastPrice = 25.000
lastQuantity = 20

totalVolume = 60
totalValue = 1.496.000

openPrice = 24.900
highPrice = 25.000
lowPrice = 24.900
```

Sau hủy B1:

```text
Không còn bid của B1.
Ask S3 vẫn là100 @25.100.
```

Cách đơn giản cho demo:

- Matching cung cấp snapshot trạng thái sổ và các tổng giao dịch tích lũy.
- Market Data thay bằng trạng thái mới có phiên bản nguồn.
- Không cộng lại totals khi nhận lại cùng phiên bản.

Không đồng thời cộng volume từ matching rồi cộng tiếp từ các event OMS của bên mua/bán.

Giữ protocol snapshot/delta và cơ chế phục hồi ngày17.

---

## 10. Thực hành — điều khiển đúng tình huống race

| Thời gian | Công việc |
|---|---|
| 10 phút | Rà mapping và execution contract |
| 10–15 phút | Lưu execution, liên kết và chống trùng |
| 15–20 phút | Chạy kịch bản hai lần khớp và hủy |
| 10–15 phút mở rộng | Đối chiếu UI và phản hồi đến muộn |

Các bước:

1. Tạo fixture `acc-025` với10 triệu và OPENING ledger.
2. Seed S1 và S3.
3. Đặt B1 qua API thật.
4. Chờ E1 được OMS và tài sản xử lý.
5. Gửi yêu cầu hủy, nhưng trì hoãn **trước khi đưa cancel vào hàng xử lý engine**.
6. Đưa S2 vào engine để tạo E2.
7. Cho cancel tiếp tục và hủy40.
8. Đọc order, executions, reservation, số dư và position.

Không chặn toàn bộ vòng xử lý engine tại một latch rồi chờ S2 được engine xử lý — cách đó làm test tự chờ.

---

## 11. API và kiểm thử

Bổ sung API đọc:

```http
GET /api/orders/:id/executions
```

Yêu cầu `ACCOUNT_READ` trên tài khoản thật của order.

Hiển thị trên UI:

| Execution | Giá | Khối lượng | Giá trị |
|---|---:|---:|---:|
| E1 | 24.900 | 40 | 996.000 |
| E2 | 25.000 | 20 | 500.000 |
| Tổng | | 60 | 1.496.000 |

**Kiểm thử bắt buộc:**

| Kiểm thử | Kết quả |
|---|---|
| Một order tạo hai execution | Tổng60, không phải100 |
| Giá E2 | Theo resting BUY25.000 |
| Replay API tạo lệnh | Không submit simulator lần hai |
| Giao lại E1/E2 | Không tăng filled, payable hoặc cost |
| Cùng executionId khác nội dung | Conflict |
| Hủy sau E2 | Hủy40, không phải60 |
| CancelAck đến trước execution thiếu | Chưa giải phóng sai |
| Market volume | Tăng60, không phải120 |
| Lỗi ghi execution/link | Transaction tài sản rollback |
| API execution của người khác | Bị chặn |
| SELL đã có ngày24 | Không bị hồi quy |

Có thể bổ sung kiểm thử với hai phía đều là OMS order. Khi đó phải thiết kế rõ phạm vi hạch toán cả hai phía; không kết luận cả hai hoàn tất chỉ vì một phía đã thành công.

---

## 12. Các lỗi debug trọng tâm

**A. Cộng cumulative như lượng mới**

```text
E1 cumulative40 → cộng40.
E2 cumulative60 → cộng60.
Kết quả sai100.
```

Phải áp dụng `lastQuantity` là40 và20.

**B. Execution dùng giá đặt của incoming**

S2 bán giới hạn24.900 nhưng gặp resting BUY25.000. Engine đã xác định execution25.000; adapter không được đổi về24.900.

**C. Raw execution tồn tại nên bỏ qua cả tài khoản khác**

Một execution có thể liên quan hai OMS order. Cần kiểm tra tác động theo từng order, không chỉ sự tồn tại của hàng thị trường.

**D. CancelAck làm mất execution đến muộn**

Đừng chuyển terminal hoặc hoàn tài sản khi cumulative từ nguồn chưa khớp với dữ liệu OMS.

**E. Restart xong tự gửi lại mọi order NEW**

Engine mới có thể không còn biết các giao dịch cũ. Chưa có quy trình khôi phục thì không tự resubmit mù.

---

## 13. Prompt cho OpenCode

```text
Tôi đang học ngày25 của Securities Trading Simulator:
Hoàn thiện Matching Adapter và nhiều execution cho một order.

Môi trường:
- Node.js + TypeScript, MySQL, Redis, Vue 3 + TypeScript + Tailwind CSS.
- OpenCode, cấu hình model hiện tại.
- Giữ transaction, auth, intent và asset control ngày1–24.

Trước khi code:
1. Đọc matching engine, adapter, execution handler,
   cancel handler và Market Data.
2. Kiểm tra mapping OMS/simulator ID.
3. Tìm chỗ còn giả định một order chỉ có một execution.
4. Đề xuất phạm vi30–60 phút.

Phạm vi:
- BUY LO sec-001 làm kịch bản chính.
- Một phía tài khoản, phía kia SYSTEM_LIQUIDITY.
- Không coi liquidity fixture là tài khoản đã được hạch toán.
- SELL ngày24 phải giữ hoạt động.
- Chưa bắt buộc khôi phục book sau engine restart.

Adapter:
- Mapping OMS orderId ↔ simulatorOrderId và simulatorRunId.
- Replay create không submit engine lần nữa.
- Accepted đến trước execution.
- Phản hồi cùng order được xử lý nối tiếp.
- Không tính lại matching hoặc thay execution price.
- Không tự ghi tài sản từ adapter.
- ExecutionId giữ nguyên khi giao lại.

Contract:
- Market execution có buy/sell/maker/taker simulator IDs,
  securityId, price, quantity, executedAt, runId.
- Order input phân biệt lastQuantity và cumulativeFilledQuantity.
- Chỉ lastQuantity là delta.
- Cumulative dùng để đối chiếu.

Database:
- executions: executionId PK, metadata nguồn,
  simulator order IDs, price, qty, timestamp, payload hash.
- order_executions PK(orderId,executionId).
- Không FK simulator IDs sang orders vì có SYSTEM_LIQUIDITY.
- Raw execution/link và tác động nguồn cùng transaction.
- Cùng ID cùng nội dung không áp dụng thêm.
- Cùng ID khác nội dung báo conflict.
- Sự tồn tại raw execution không có nghĩa mọi phía OMS đã xử lý.
- Giữ ledger/movement/business dedup đã có.

Fixture:
- acc-025 mới10tr, OPENING ledger, position0, TRADE membership.
- Seed S1 SELL40@24900 và S3 SELL100@25100.
- B1 BUY100 LO25000 qua API thật.
- E1=40@24900, B1 còn60.
- Gửi cancel nhưng trì hoãn trước khi enqueue engine cancel.
- Thêm S2 SELL20 LO24900.
- B1 đang resting25k nên E2=20@25000.
- Sau đó engine cancel40.

Kỳ vọng:
- Order CANCELED, filled60, canceled40, remaining0.
- Hai executions tổng60, value1496000.
- Cash reserved0, payable1496000, available8504000.
- Reservation:
  initial2500000, remaining0,
  consumed1496000, released1004000.
- PendingBuy60, economic60, availableQty0.
- TotalCost1496000.
- Không tự settlement trong fixture chính.

Cancel:
- ACK gồm cumulativeFilledQuantity và canceledQuantity.
- Chỉ apply khi khớp với OMS hiện tại.
- ACK nói filled60 nhưng OMS40:
  chưa giải phóng; xử lý execution thiếu rồi đánh giá lại.
- Không tự sửa filled để bù sự kiện thiếu.
- Nếu thêm source sequence, tách khỏi OMS version,
  xử lý gap rõ ràng, không silently skip.

Market Data:
- Một nguồn giao dịch thị trường.
- Ưu tiên snapshot engine có totals tích lũy và version nguồn.
- Duplicate cùng source version không làm tăng totals.
- Không cộng volume theo từng phía OMS.
- Cuối lastPrice25000, lastQty20,
  volume60, value1496000,
  open24900, high25000, low24900.
- Sau cancel không còn bid B1,
  ask100@25100 vẫn còn.

API:
GET /api/orders/:id/executions.
- Check ACCOUNT_READ qua account thật của order.
- UI hiển thị từng execution và tổng.

Tests:
- Kịch bản chính, retry create, duplicate execution.
- Same executionId khác nội dung.
- CancelAck thiếu execution trước đó.
- Maker BUY quyết định giá E2.
- Market volume không nhân đôi.
- Failure ghi execution/link rollback tài sản.
- Auth truy cập execution người khác.
- Hồi quy SELL ngày24.
- Không block engine loop bằng latch khiến incoming S2 không chạy.

Sau khi làm:
- Chạy kiểm tra phù hợp, báo kết quả thực tế.
- Đối chiếu engine/OMS/cash/position/obligation/Market Data.
- Cập nhật README về mapping và giới hạn restart.
- Không tự resubmit mọi order NEW sau khi engine mất bộ nhớ.
```

**Ngày 25 hoàn thành khi:**

- [ ] OMS và simulator ánh xạ đúng lệnh.
- [ ] Một lệnh nhận nhiều execution đúng giá và khối lượng.
- [ ] Execution giao lại không hạch toán thêm.
- [ ] Hủy xử lý đúng phần còn lại sau lần khớp mới nhất.
- [ ] Market Data không đếm hai lần một giao dịch.
- [ ] Tổng execution khớp với filled quantity và tài sản.

Ngày 26 sẽ bổ sung **structured logging, audit và metric**, để truy vết một giao dịch từ HTTP request đến order, execution, ledger, outbox và settlement.
