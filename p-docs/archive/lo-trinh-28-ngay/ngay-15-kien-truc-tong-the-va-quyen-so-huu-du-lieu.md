# Ngày 15 — Kiến trúc tổng thể và quyền sở hữu dữ liệu

Sau hai tuần, dự án đã có một giao dịch xuyên suốt. Hôm nay bạn nhìn lại hệ thống từ góc độ kiến trúc:

> “Module nào chịu trách nhiệm cho dữ liệu nào, và ai được phép thay đổi dữ liệu đó?”

Mục tiêu là làm rõ ranh giới trước khi bổ sung phân quyền, concurrency và khả năng phục hồi.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Trách nhiệm các hệ thống trong luồng chứng khoán | Giải thích được ai làm gì |
| 30 phút kỹ thuật | Quyền sở hữu bảng, interface và transaction | Có bản đồ kiến trúc rõ ràng |
| Thực hành, thời lượng theo thực tế | Rà soát các luồng truy cập chéo, refactor và chạy hồi quy | Giữ nguyên kết quả giao dịch |

**Sản phẩm cuối buổi:**

- Bảng trách nhiệm module và quyền ghi dữ liệu.
- Sơ đồ luồng tiếp nhận lệnh và xử lý execution.
- Các luồng vi phạm quyền sở hữu dữ liệu được refactor qua service interface phù hợp.
- Một quyết định kiến trúc ngắn giải thích vì sao tiếp tục dùng modular monolith.

Ngày 15 không yêu cầu thêm nghiệp vụ hoặc tách thành microservices.

---

## 2. Nghiệp vụ — 30 phút

### 2.1. Các khối chính của hệ thống

| Thành phần | Trách nhiệm nghiệp vụ |
|---|---|
| Trading UI | Hiển thị thông tin và nhận thao tác |
| Security Master | Định danh và thuộc tính chứng khoán |
| Market Session | Lịch và quy tắc phiên |
| OMS | Tiếp nhận và quản lý vòng đời lệnh |
| Risk | Đánh giá điều kiện giao dịch |
| Accounts | Tiền, chứng khoán và khoản giữ tài sản |
| Exchange Adapter | Chuyển yêu cầu và phản hồi với hệ thống giao dịch |
| Matching Simulator | Mô phỏng khớp lệnh trong dự án |
| Market Data | Phân phối thông tin thị trường |
| Portfolio | Tổng hợp danh mục và định giá |
| Settlement | Theo dõi và thực hiện nghĩa vụ thanh toán |

Trong hệ thống thực tế, thuật ngữ và cách chia khối có thể khác. Đây là cách tổ chức nhất quán cho dự án học tập của bạn.

### 2.2. Tách hai luồng quan trọng

**Luồng A — Tiếp nhận yêu cầu**

```text
Người dùng gửi lệnh
→ Kiểm tra điều kiện
→ Ghi nhận lệnh và giữ tài sản
→ Chuyển yêu cầu tới hệ thống giao dịch
```

**Luồng B — Nhận kết quả thực hiện**

```text
Nhận execution
→ Cập nhật lệnh
→ Chuyển khoản giữ thành nghĩa vụ
→ Cập nhật vị thế và giá vốn
→ Tạo nghĩa vụ thanh toán
```

Execution không phải một request đặt lệnh mới.

Vì vậy, không gọi lại API `POST /api/orders` để xử lý kết quả khớp.

### 2.3. Phân biệt kiểm tra với thay đổi tài sản

| Hành động | Ai chịu trách nhiệm? |
|---|---|
| “Tài khoản có đủ tiền không?” | Calculator/Risk dùng dữ liệu Accounts |
| “Giữ 2,5 triệu cho lệnh này” | Accounts |
| “Lệnh đã khớp 40” | OMS |
| “Phân bổ 996.000 thành nghĩa vụ mua” | Accounts |
| “Đến hạn trả tiền, nhận chứng khoán” | Settlement điều phối, Accounts cập nhật tài sản |

Risk không tự sửa số dư chỉ vì kết quả kiểm tra là `ALLOW`.

Portfolio không tự trả tiền chỉ vì lệnh đã hủy.

### 2.4. Dữ liệu nào phục vụ quyết định, dữ liệu nào phục vụ hiển thị?

| Dữ liệu | Vai trò chính trong demo |
|---|---|
| Số dư tiền được khóa trong transaction | Quyết định giữ tiền |
| Trạng thái lệnh được đọc trong transaction | Quyết định chuyển trạng thái |
| Chính sách phiên | Quyết định loại lệnh phù hợp |
| Quote trên giao diện | Hỗ trợ quan sát thị trường |
| P&L đang hiển thị | Định giá, giải thích danh mục |
| Snapshot Redis | Phân phối dữ liệu giá |

Trong luồng tiền mặt hiện tại, không dùng số dư do frontend gửi hoặc số dư cache Redis để quyết định giữ tiền.

---

## 3. Bản đồ quyền sở hữu dữ liệu

Nguyên tắc:

> **Module sở hữu dữ liệu là nơi cung cấp các thao tác hợp lệ để thay đổi dữ liệu đó.**

Các module khác có thể yêu cầu thao tác thông qua interface; không tự viết SQL cập nhật bảng của nhau.

| Dữ liệu | Module sở hữu quyền ghi | Module sử dụng |
|---|---|---|
| `securities`, `bond_terms` | Security Master | OMS, Risk, Market Data, Portfolio |
| Lịch phiên | Market Session | Trading, Matching, UI |
| `orders`, `order_events` | OMS | Trading, UI, Settlement |
| `cash_balances` | Accounts | Risk, Portfolio, Settlement |
| `cash_reservations` | Accounts | Trading, OMS qua điều phối |
| `cash_ledger_entries` | Accounts | UI, đối chiếu |
| `positions` | Accounts / Position Service | Risk, Portfolio, Settlement |
| `security_reservations` | Accounts | Trading |
| `position_movements` | Accounts / Position Service | Portfolio, đối chiếu |
| `settlement_obligations` | Settlement | Execution handler, batch |
| `settlement_runs`, run items, breaks | Settlement | UI vận hành demo |
| Snapshot giá Redis | Market Data | UI, Portfolio |
| Sổ matching trong bộ nhớ | Matching Simulator | Adapter, Market Data |
| Policy và scenario margin giả lập | Risk | API mô phỏng |
| `idempotency_requests` | Thành phần idempotency dùng chung | API tạo/hủy qua điều phối |

**Lưu ý với giá vốn ngày 11:** calculator tính giá vốn có thể nằm trong Portfolio hoặc thư viện domain, nhưng việc ghi các trường giá vốn đang nằm trong `positions` vẫn đi qua Position Service.

Chưa cần di chuyển bảng chỉ để đổi tên module.

---

## 4. Ai điều phối giao dịch nhiều module?

Một execution ảnh hưởng nhiều bảng. Cần một service điều phối:

```text
ExecutionProcessingService
```

Service này không sở hữu mọi bảng. Nó gọi các module theo thứ tự trong cùng transaction.

| Bước | Module thực hiện |
|---|---|
| Khóa số dư tiền | Accounts |
| Khóa và kiểm tra lệnh | OMS |
| Khóa khoản giữ, vị thế | Accounts |
| Kiểm tra execution đã xử lý | Cơ chế chống trùng của luồng hiện có |
| Cập nhật trạng thái và khối lượng lệnh | OMS |
| Cập nhật tiền giữ, nghĩa vụ mua | Accounts |
| Cập nhật lượng chứng khoán và giá vốn | Position Service |
| Tạo nghĩa vụ thanh toán | Settlement |
| Ghi các lịch sử tương ứng | Module sở hữu |
| Commit | Unit of Work |

Giữ nguyên thứ tự khóa đã dùng ở ngày 10–14.

**Phân chia module không làm mất transaction chung.** Trong modular monolith, các service có thể nhận cùng transaction context và cùng sử dụng một MySQL connection.

---

## 5. Service interface nên thể hiện nghiệp vụ

Tránh interface quá tổng quát:

```ts
updateTable(tableName, fields);
setBalance(accountId, amount);
setOrderStatus(orderId, status);
```

Những hàm này cho phép bỏ qua quy tắc nghiệp vụ.

Đề xuất interface rõ hơn:

```ts
interface CashService {
  reserveForBuyOrder(
    tx: TransactionContext,
    input: ReserveBuyInput
  ): Promise<void>;

  applyBuyExecution(
    tx: TransactionContext,
    input: BuyExecutionInput
  ): Promise<void>;

  releaseUnfilledBuyReservation(
    tx: TransactionContext,
    input: ReleaseReservationInput
  ): Promise<void>;
}
```

```ts
interface OrderService {
  applyExecution(
    tx: TransactionContext,
    input: OrderExecutionInput
  ): Promise<void>;

  requestCancel(
    tx: TransactionContext,
    input: CancelRequestInput
  ): Promise<void>;

  confirmCancel(
    tx: TransactionContext,
    input: CancelConfirmationInput
  ): Promise<void>;
}
```

```ts
interface SettlementService {
  createBuyObligation(
    tx: TransactionContext,
    input: BuyObligationInput
  ): Promise<void>;
}
```

Các kiểu trên là định hướng. Điều chỉnh theo code thực tế, không tạo interface chỉ để bọc một hàm không có nhu cầu.

**TransactionContext cần bảo đảm:**

- Các repository dùng cùng connection.
- Service con không tự commit.
- Lỗi được đẩy lên service điều phối để rollback.
- Không có network call trong transaction.

---

## 6. Đồng bộ và sự kiện: dùng ở đâu?

| Tương tác | Cách làm hiện tại |
|---|---|
| Kiểm tra chứng khoán và phiên | Gọi service trực tiếp |
| Kiểm tra và giữ tiền | Gọi service trong transaction |
| Execution cập nhật OMS, tiền, vị thế, nghĩa vụ | Điều phối trong transaction |
| Cập nhật giao diện | WebSocket |
| Phân phối quote | Redis và WebSocket |
| Phân tích, thông báo hậu xử lý | Có thể bổ sung sự kiện sau này |

Không chuyển cập nhật tiền hoặc vị thế sang tác vụ bất đồng bộ chỉ vì muốn “kiến trúc hướng sự kiện”.

Nếu cần thay đổi ranh giới nhất quán, phải xác định rõ:

- Khoảng thời gian dữ liệu có thể lệch.
- Cách retry.
- Cách chống xử lý trùng.
- Cách phục hồi sự kiện chưa phát.

Ngày 18 và 20 sẽ triển khai các cơ chế đó.

---

## 7. MySQL và Redis có vai trò khác nhau

| Dữ liệu | Nguồn gốc có thẩm quyền trong demo |
|---|---|
| Lệnh và lịch sử | MySQL |
| Tiền và khoản giữ | MySQL |
| Vị thế và giá vốn | MySQL |
| Nghĩa vụ thanh toán | MySQL |
| Sổ matching hiện tại | Bộ nhớ simulator |
| Quote mới nhất phục vụ hiển thị | Redis, được tạo từ nguồn market data |

Không nói “toàn bộ hệ thống đã bền vững” chỉ vì MySQL lưu được lệnh. Sổ matching vẫn mất khi backend restart.

Portfolio ghép dữ liệu MySQL với quote Redis cũng không tự tạo ra một snapshot nguyên tử của cả hai hệ thống. Response cần giữ timestamp của quote để giải thích thời điểm định giá.

---

## 8. Bài thực hành — rà soát và refactor các luồng

Thực hiện ví dụ dưới đây, sau đó rà soát toàn bộ luồng tạo lệnh, execution, cancel và settlement. Sửa mọi truy cập ghi chéo vi phạm quyền sở hữu; nếu một luồng đã đúng, ghi bằng chứng và kiểm thử hồi quy thay vì viết lại.

**Bước 1 — Tìm một truy cập chéo**

Ví dụ cần sửa:

```ts
// Nằm trong PortfolioService.
await db.query(
  "UPDATE cash_balances SET reserved_cash = ... "
);
```

Hoặc:

```ts
// Nằm trong controller.
await updateOrder();
await updateCash();
await insertLedger();
```

Nếu code đã có ranh giới tốt, chọn một điểm còn yếu khác. Không bắt buộc tạo thay đổi chỉ để có refactor.

**Bước 2 — Xác định module sở hữu**

Ví dụ giải phóng tiền:

```text
Dữ liệu: cash_reservations, cash_balances, cash ledger.
Chủ sở hữu: Accounts.
Nguyên nhân nghiệp vụ: xác nhận hủy phần chưa khớp.
```

**Bước 3 — Đưa thao tác về service đúng**

```text
CancelResultHandler
→ OMS.confirmCancel(...)
→ Accounts.releaseUnfilledBuyReservation(...)
→ Cùng transaction
```

Portfolio chỉ đọc kết quả sau đó.

**Bước 4 — Giữ nguyên hành vi**

Chạy kịch bản ngày 14:

```text
BUY100@25000
→ Khớp40@24900
→ Hủy60
→ Thanh toán40
```

Kết quả phải vẫn là:

```text
settledCash = 9.004.000
reservedCash = 0
buyPayable = 0

settledQuantity = 40
pendingBuyQuantity = 0
totalCost = 996.000

Order = CANCELED
filled = 40
canceled = 60
```

Ngày 15 không thay đổi công thức hoặc dữ liệu fixture chỉ để làm kiểm thử qua.

---

## 9. Tình huống debug kiến trúc

**A. Portfolio trả tiền nhưng ledger không có**

Portfolio tự giảm `reserved_cash` khi thấy order canceled, bỏ qua Accounts.

Hậu quả: số dư hiện tại và lịch sử không còn cùng giải thích được.

Cách sửa: mọi giải phóng tiền đi qua thao tác nghiệp vụ của Accounts, trong transaction xác nhận hủy.

**B. Service con tự commit**

Service điều phối bắt đầu transaction, nhưng CashService tự mở transaction khác và commit.

Nếu cập nhật vị thế sau đó thất bại, tiền đã thay đổi riêng.

Cách sửa: transaction được mở ở cấp điều phối và truyền xuống các module.

**C. Các module gọi vòng nhau**

Ví dụ:

```text
OMS gọi Accounts.
Accounts gọi Portfolio.
Portfolio gọi OMS.
```

Khó xác định ai chịu trách nhiệm và dễ phát sinh cập nhật ngược.

Cách sửa: đưa việc phối hợp lên service điều phối; module con tập trung vào trách nhiệm của mình.

**D. Quote cũ được dùng để sửa giá vốn**

Portfolio thấy giá mới rồi cập nhật `total_cost`.

Cách sửa: Market Data chỉ cung cấp giá định giá; giá vốn thay đổi qua các nghiệp vụ vị thế đã định nghĩa.

---

## 10. Quyết định kiến trúc ngắn — ADR

Tạo một tài liệu ngắn trong repository, ví dụ:

```text
docs/adr/001-modular-monolith.md
```

Nội dung cần trả lời:

| Phần | Nội dung |
|---|---|
| Bối cảnh | Nhiều module cùng tác động một giao dịch và tài sản |
| Quyết định | Dùng modular monolith, MySQL chung, quyền ghi theo module |
| Lý do | Giữ transaction đơn giản, dễ debug và chạy demo |
| Hệ quả | Phải kiểm soát import, truy cập repository và transaction context |
| Giới hạn | Matching trong bộ nhớ chưa phục hồi bền vững |
| Xem xét lại khi nào | Có nhu cầu triển khai, mở rộng hoặc vận hành độc lập được chứng minh |

Điều kiện có thể đáng xem xét tách service:

- Market Data cần tải và triển khai độc lập.
- Một thành phần cần mức cách ly vận hành riêng.
- Có đội ngũ chịu trách nhiệm độc lập.
- Ranh giới dữ liệu và cơ chế phục hồi đã rõ.

Không tách service chỉ vì số lượng folder tăng.

---

## 11. Kiểm tra cuối buổi

| Kiểm tra | Bằng chứng |
|---|---|
| Mỗi bảng có chủ sở hữu | Bảng mapping trong tài liệu |
| Controller không viết SQL nghiệp vụ | Route gọi application service |
| Module không tự ghi bảng của module khác | Luồng refactor qua interface |
| Transaction không bị chia cắt | Cùng connection/context |
| Nghiệp vụ không đổi | Kịch bản ngày 14 vẫn đạt |
| Lịch sử vẫn đúng | Ledger, movements và events đối chiếu được |
| Giới hạn được ghi rõ | ADR và README |

Ưu tiên chạy lại các kiểm thử tích hợp hiện có. Chỉ thêm kiểm thử mới nếu refactor làm xuất hiện rủi ro chưa được kiểm chứng.

---

## 12. Prompt cho OpenCode

```text
Tôi đang học ngày 15 của Securities Trading Simulator:
Kiến trúc tổng thể và quyền sở hữu dữ liệu.

Môi trường:
- Node.js + TypeScript, MySQL, Redis, Vue 3 + TypeScript + Tailwind CSS.
- OpenCode, cấu hình model hiện tại.
- Giữ modular monolith.
- Không tách microservices hoặc thêm message broker hôm nay.

Trước khi sửa:
1. Đọc cấu trúc module và các đường ghi dữ liệu.
2. Xác định ai đang ghi từng bảng.
3. Rà soát transaction tạo lệnh, execution, cancel và settlement.
4. Tìm mọi truy cập chéo hoặc ranh giới chưa rõ trong các luồng được rà soát.
5. Nếu code đã tốt, ghi nhận và chỉ sửa điểm có lợi ích cụ thể.

Mục tiêu:
- Tài liệu quyền sở hữu dữ liệu.
- Refactor mọi luồng vi phạm qua service interface phù hợp.
- Giữ nguyên hành vi ngày 14.
- ADR giải thích modular monolith.

Quyền ghi dự kiến:
- Security Master: securities, bond_terms.
- OMS: orders, order_events.
- Accounts: cash_balances, cash_reservations,
  cash_ledger_entries, positions,
  security_reservations, position_movements.
- Settlement: obligations, runs, items, reconciliation breaks.
- Market Data: quote snapshots và phân phối giá.
- Matching: sổ lệnh trong bộ nhớ.
- Risk: policy và scenario margin giả lập.
- Portfolio: đọc/tổng hợp/định giá;
  không trực tiếp ghi cash hoặc quantity.
- Giá vốn đang lưu trong positions:
  ghi qua PositionService, calculator có thể dùng chung.
- Idempotency: hạ tầng dùng chung, phối hợp trong transaction thao tác.

Refactor:
- Xử lý các vi phạm ở execution, cancel confirmation và các luồng khác đã rà soát; ghi rõ luồng đã đúng và bằng chứng.
- Service điều phối gọi các module.
- Module sở hữu bảng cung cấp thao tác nghiệp vụ.
- Không dùng hàm updateTable hoặc setStatus tùy ý
  để bỏ qua invariant.
- Không để module khác import repository nội bộ để ghi bảng.
- Không tạo interface chỉ để tăng số file.

Transaction:
- Mở/commit/rollback ở cấp điều phối.
- Cùng transaction context và MySQL connection.
- Service con không tự commit.
- Giữ thứ tự khóa ngày 10–14.
- Không network call hoặc matching trong transaction.
- Giữ dedup bao phủ toàn bộ cập nhật liên quan.

Tài liệu:
1. Bảng module → trách nhiệm → bảng được ghi.
2. Luồng nhận order và nhận execution.
3. Nguồn dữ liệu có thẩm quyền:
   MySQL cho order/assets/settlement,
   Redis cho quote cache,
   bộ nhớ cho simulator order book.
4. ADR docs/adr/001-modular-monolith.md:
   context, decision, reasons, consequences, limits,
   điều kiện xem xét tách service.
5. Không tuyên bố đã có phục hồi cho matching hoặc
   tính nhất quán phân tán khi chưa triển khai.

Xác minh:
- Chạy kiểm thử phù hợp hiện có.
- Kịch bản ngày 14 vẫn đúng:
  BUY100@25000,
  fill40@24900,
  cancel60,
  settle40.
- Cuối:
  settledCash9004000, reserved0, payable0,
  settledQty40, pendingBuy0, totalCost996000,
  order CANCELED, filled40, canceled60.
- Timeline, ledger và movement vẫn giải thích đúng kết quả.
- Chỉ thêm test khi có rủi ro mới chưa được bao phủ.

Sau khi làm:
- Báo module nào đã thay đổi và lý do.
- Nêu đường ghi dữ liệu trước/sau refactor.
- Báo kết quả kiểm tra thực tế.
- Chỉ rõ phần còn chưa nhất quán khi backend dừng giữa DB
  và matching; chưa giải quyết bằng tài liệu hoặc đổi tên hàm.
```

**Ngày 15 hoàn thành khi:**

- [ ] Bạn chỉ ra được module nào được phép ghi từng loại dữ liệu.
- [ ] Phân biệt luồng nhận yêu cầu với luồng nhận execution.
- [ ] Các luồng đã rà soát không còn truy cập ghi chéo trái quyền; có bằng chứng hoặc kiểm thử cho từng luồng.
- [ ] Các cập nhật nhiều module vẫn giữ chung transaction.
- [ ] Kịch bản tuần 2 không đổi kết quả.
- [ ] Có ADR giải thích lựa chọn kiến trúc và giới hạn.

Ngày 16 sẽ bổ sung **xác thực và phân quyền tài khoản**, ngăn người dùng đổi `accountId` để đọc hoặc giao dịch trên tài khoản của người khác.
