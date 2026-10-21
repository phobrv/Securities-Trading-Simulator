# Ngày 14 — Sản phẩm tuần 2: OMS, tài sản và thanh toán

Hôm nay bạn ghép các phần đã học thành một giao dịch xuyên suốt:

> **Đặt mua → giữ tiền → khớp một phần → yêu cầu hủy → xác nhận hủy → thanh toán → đối chiếu tài sản.**

Mục tiêu không phải thêm nhiều tính năng, mà chứng minh **lệnh, tiền và chứng khoán cùng phản ánh đúng một giao dịch**.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Tính tay toàn bộ giao dịch | Có bảng kết quả kỳ vọng |
| 30 phút kỹ thuật | Rà soát luồng OMS, matching, tài sản và settlement | Xác định đúng ranh giới transaction |
| 30–60 phút thực hành | Chạy kịch bản tích hợp và kiểm tra | Demo tuần 2 có bằng chứng đối chiếu |

**Sản phẩm cuối buổi:**

- Một lệnh đi hết vòng đời.
- Khoản giữ tiền được tạo và giải phóng đúng.
- Chứng khoán mua chờ nhận trở thành đã thanh toán.
- Retry không tạo lệnh, khoản giữ hoặc thanh toán trùng.
- Có README và kịch bản demo lặp lại được.

Margin ngày 12 vẫn là calculator độc lập, chưa tham gia giao dịch hôm nay.

---

## 2. Nghiệp vụ — tính tay trước khi chạy

### 2.1. Dữ liệu đầu vào

Tạo tài khoản demo mới:

```text
accountId: acc-007
Tiền đầu kỳ: 10.000.000 đồng.
Chứng khoán ban đầu: 0.
Có OPENING cash ledger.
```

Lệnh của tài khoản:

```text
BUY 100 sec-001.
LO giá 25.000 đồng.
```

Thanh khoản mô phỏng bên bán:

| Lệnh | Giá bán | Khối lượng |
|---|---:|---:|
| S1 | 24.900 | 40 |
| S2 | 25.100 | 60 |

B1 chỉ có thể khớp S1. S2 cao hơn giá giới hạn mua nên không khớp.

Các lệnh bán này đóng vai trò **thanh khoản bên ngoài giả lập**. Chưa coi chúng là lệnh bán của tài khoản khách hàng đã có đầy đủ giữ chứng khoán và hạch toán tiền bán.

### 2.2. Kết quả khớp

```text
Khớp: 40 tại 24.900.
Còn mua: 60 tại 25.000.
```

Giá trị đã mua:

```text
40 × 24.900 = 996.000 đồng.
```

Sau đó:

```text
Gửi yêu cầu hủy.
Xác nhận hủy 60 còn lại.
Thanh toán 40 đã khớp.
```

### 2.3. Bảng tiền kỳ vọng

| Bước | Settled cash | Reserved cash | Buy payable | Available cash |
|---|---:|---:|---:|---:|
| Ban đầu | 10.000.000 | 0 | 0 | 10.000.000 |
| Nhận lệnh và giữ tiền | 10.000.000 | 2.500.000 | 0 | 7.500.000 |
| Khớp 40 @24.900 | 10.000.000 | 1.500.000 | 996.000 | 7.504.000 |
| Gửi yêu cầu hủy | 10.000.000 | 1.500.000 | 996.000 | 7.504.000 |
| Xác nhận hủy 60 | 10.000.000 | 0 | 996.000 | 9.004.000 |
| Thanh toán | 9.004.000 | 0 | 0 | 9.004.000 |

### 2.4. Bảng chứng khoán kỳ vọng

| Bước | Settled | Pending buy | Economic quantity | Available quantity |
|---|---:|---:|---:|---:|
| Ban đầu | 0 | 0 | 0 | 0 |
| Khớp 40 | 0 | 40 | 40 | 0 |
| Hủy phần còn lại | 0 | 40 | 40 | 0 |
| Thanh toán | 40 | 0 | 40 | 40 |

Tổng giá vốn sau execution là **996.000 đồng** và không thay đổi vì hủy hoặc thanh toán.

---

## 3. Kỹ thuật — ghép đúng các module

### 3.1. Trách nhiệm từng phần

| Thành phần | Trách nhiệm trong demo |
|---|---|
| API Orders | Nhận yêu cầu và xử lý idempotency |
| OMS | Trạng thái lệnh và timeline |
| Accounts | Số dư và khoản giữ |
| Matching Adapter | Chuyển lệnh và phản hồi giữa OMS với simulator |
| Matching Engine | Khớp lệnh và quản lý sổ |
| Position Service | Lượng chứng khoán và giá vốn |
| Settlement | Nghĩa vụ và thanh toán |
| Market Data | Giá khớp và trạng thái sổ |

Không để controller tự cập nhật từng bảng.

### 3.2. Bổ sung Matching Adapter

Cấu trúc đề xuất:

```text
src/modules/trading/
  trading.service.ts
  matching.adapter.ts
  execution-handler.service.ts
  cancel-result-handler.service.ts
```

Adapter cần ánh xạ được:

```text
OMS orderId ↔ simulator orderId
```

Có thể dùng chung ID nếu cấu trúc engine cho phép. Không tạo một OMS order mới chỉ vì simulator đã tạo ID riêng.

Các lệnh thanh khoản cần được đánh dấu nguồn rõ ràng:

```text
OMS
SYSTEM_LIQUIDITY
```

Khi có execution, chỉ hạch toán phía tài khoản đã được mô hình hóa. Không tự tạo giao dịch tài sản cho một tài khoản bán không tồn tại.

### 3.3. Một luồng đặt lệnh

```text
API nhận BUY
→ Transaction tạo OMS order + giữ tiền
→ Commit
→ Adapter chuyển sang simulator
→ Nhận phản hồi chấp nhận
→ OMS chuyển NEW
→ Simulator thực hiện matching
→ Execution Handler cập nhật giao dịch
```

Adapter demo phải bảo đảm thứ tự phản hồi: tiếp nhận trước, execution sau, phù hợp với state machine ngày 8.

Không đổi `NEW` chỉ vì đã ghi database, cũng không gửi lệnh vào simulator lần nữa khi API replay.

### 3.4. Các transaction phải giữ nguyên

| Transaction | Những dữ liệu cùng commit |
|---|---|
| Tạo lệnh | Order, OrderReceived, khoản giữ, số dư, cash ledger, kết quả idempotency |
| Nhận execution | OMS, khoản giữ, tiền, vị thế, giá vốn, lịch sử, nghĩa vụ thanh toán |
| Yêu cầu hủy | Trạng thái yêu cầu hủy, event và kết quả idempotency |
| Xác nhận hủy | OMS, giải phóng khoản giữ, số dư và ledger |
| Thanh toán | Tiền, chứng khoán, lịch sử và trạng thái obligation |

Matching trong bộ nhớ và MySQL chưa có transaction chung. Bản demo hôm nay kiểm chứng luồng chạy bình thường; khả năng phục hồi khi tiến trình dừng giữa hai hệ thống sẽ được đào sâu trong tuần 3.

---

## 4. Luồng hủy phải đi qua sổ lệnh

Ngày 8 dùng phản hồi hủy giả lập để học state machine. Trong demo tích hợp:

```text
POST cancel
→ OMS ghi CancelRequested
→ Adapter gửi yêu cầu tới simulator
→ Simulator loại phần chưa khớp khỏi sổ
→ Trả kết quả hủy
→ OMS áp dụng CancelConfirmed và giải phóng tiền
```

**Không giải phóng tiền ngay sau khi gửi yêu cầu.**

Khi chờ hủy:

```text
status = PARTIALLY_FILLED
cancelRequestStatus = PENDING
reservedCash = 1.500.000
```

Sau xác nhận:

```text
status = CANCELED
cancelRequestStatus = ACCEPTED
reservedCash = 0
```

Sau đó sổ không còn B1 mua 60 tại 25.000.

S2 bán 60 tại 25.100 vẫn có thể nằm trong sổ vì đó là lệnh khác.

---

## 5. Kịch bản demo chuẩn

**Bước 1 — Chuẩn bị môi trường**

Dùng cấu hình:

```text
Ngày giao dịch: 23/10/2026.
Thời điểm: 10:00 Việt Nam.
Thị trường: SIM_EQ_A.
Phiên: CONTINUOUS.
```

Tiếp tục lịch settlement ngày 13:

```text
Chu kỳ: 2 ngày làm việc.
26/10: nghỉ giả lập.
Đến hạn: 28/10/2026, 13:00 Việt Nam.
```

Preflight cần kiểm tra:

- MySQL và Redis hoạt động.
- `sec-001` là `TRADABLE`.
- Clock và lịch đúng fixture.
- Sổ mục tiêu bắt đầu rỗng.
- Không có kịch bản cũ đang chạy.
- `acc-007` có dữ liệu đầu kỳ hợp lệ.

Nếu dữ liệu đã tồn tại và không còn ở trạng thái đầu kỳ, báo rõ; không tự ghi đè số dư hoặc xóa lịch sử.

**Bước 2 — Seed thanh khoản**

Đưa vào simulator:

```text
SELL 40 @24.900.
SELL 60 @25.100.
```

Kỳ vọng:

```text
Chưa có execution.
Best ask = 24.900 × 40.
```

**Bước 3 — Đặt lệnh BUY qua API ngày 9**

```http
POST /api/orders
Idempotency-Key: week2-buy-001
```

```json
{
  "accountId": "acc-007",
  "securityId": "sec-001",
  "side": "BUY",
  "orderType": "LO",
  "price": 25000,
  "quantity": 100
}
```

Sau khi adapter và execution handler xử lý xong:

```text
Order PARTIALLY_FILLED.
Filled = 40.
Remaining = 60.
```

Không gọi API simulator để tạo thêm một lệnh mua độc lập song song với lệnh OMS.

**Bước 4 — Gửi lại cùng yêu cầu**

Cùng key và payload:

```text
Cùng orderId.
Không giữ thêm tiền.
Không chuyển thêm lệnh vào simulator.
Không tạo execution thứ hai.
```

Response replay có thể chứa trạng thái `PENDING_NEW` ban đầu đã lưu. Đọc `GET /api/orders/:id` để xem trạng thái hiện tại.

**Bước 5 — Hủy phần còn lại**

```http
POST /api/orders/:id/cancel
Idempotency-Key: week2-cancel-001
```

Chờ kết quả từ adapter, rồi đối chiếu:

```text
Filled = 40.
Canceled = 60.
Remaining = 0.
Reserved cash = 0.
Buy payable = 996.000.
```

**Bước 6 — Thanh toán**

Trong kiểm thử tích hợp, dùng `FixedClock.set()` để chuyển thời điểm, không phải chờ thật.

Chạy trước hạn rồi đúng hạn:

```text
12:59:59.999 → chưa thanh toán.
13:00:00.000 → thanh toán.
```

Kết quả cuối:

```text
Tiền đã thanh toán: 9.004.000.
Tiền khả dụng:      9.004.000.
Chứng khoán settled: 40.
Chứng khoán có thể bán: 40.
Tổng giá vốn:       996.000.
```

**Bước 7 — Chạy lại settlement**

Không thêm:

- Tiền bị trừ.
- Chứng khoán được nhận.
- Cash ledger thanh toán.
- Position movement thanh toán.

---

## 6. Bằng chứng cần đối chiếu

### 6.1. Order

```json
{
  "status": "CANCELED",
  "cancelRequestStatus": "ACCEPTED",
  "quantity": 100,
  "filledQuantity": 40,
  "remainingQuantity": 0,
  "canceledQuantity": 60
}
```

Timeline chính:

```text
OrderReceived
OrderAccepted
ExecutionReceived: 40 @24.900
CancelRequested
CancelConfirmed: 60
```

Thanh toán không tự đổi trạng thái lệnh từ `CANCELED` sang `FILLED`.

### 6.2. Reservation

```json
{
  "initialAmount": "2500000",
  "remainingAmount": "0",
  "consumedAmount": "996000",
  "releasedAmount": "1504000",
  "status": "CLOSED"
}
```

### 6.3. Cash ledger

| Entry | Delta settled | Delta reserved | Delta payable |
|---|---:|---:|---:|
| OPENING | +10.000.000 | 0 | 0 |
| RESERVE | 0 | +2.500.000 | 0 |
| EXECUTION | 0 | −1.000.000 | +996.000 |
| RELEASE | 0 | −1.500.000 | 0 |
| SETTLEMENT_BUY | −996.000 | 0 | −996.000 |

### 6.4. Position

```text
settledQuantity = 40
pendingBuyQuantity = 0
pendingSellQuantity = 0
economicQuantity = 40
availableQuantity = 40

totalCost = 996.000
averageCost = 24.900
realizedPnl = 0
```

### 6.5. Settlement

```text
Đúng một nghĩa vụ cho execution.
quantity = 40.
amount = 996.000.
status = SETTLED.
```

---

## 7. Giao diện tuần 2

Ghép các component đã có:

| Panel | Nội dung |
|---|---|
| Session | Phiên và thời gian mô phỏng |
| QuoteBoard | Giá, dư mua/bán, tổng khối lượng |
| OrderList | Trạng thái chính, khớp, còn lại, trạng thái hủy |
| OrderTimeline | Các sự kiện theo sequence |
| BalancePanel | Tiền, khoản giữ và nghĩa vụ |
| PortfolioPanel | Chứng khoán chờ nhận, settled, khả dụng, giá vốn |
| SettlementPanel | Nghĩa vụ và kết quả chạy |

Ưu tiên hiển thị đúng hơn trang trí.

Các thông báo cần phân biệt:

```text
Đã ghi nhận yêu cầu đặt lệnh.
Lệnh đã được chấp nhận.
Đã khớp 40/100.
Đang chờ phản hồi hủy.
Đã hủy 60 còn lại.
Đã thanh toán 40 cổ phiếu.
```

Không dùng một thông báo “Thành công” cho toàn bộ các bước.

---

## 8. Kiểm thử tích hợp bắt buộc

Bài quan trọng nhất là một kiểm thử xuyên suốt:

```text
Opening
→ Create + reserve
→ Accept
→ Partial fill
→ Request cancel
→ Confirm cancel
→ Settle
→ Run settlement again
```

Kiểm tra ở từng chặng, không chỉ kết quả cuối.

| Trường hợp | Điều cần chứng minh |
|---|---|
| Retry create | Không thêm order, hold, simulator order hoặc execution |
| Partial fill | Tiền và lượng chứng khoán đồng nhất |
| Cancel requested | Chưa trả tiền |
| Cancel confirmed | Xóa phần dư khỏi sổ, trả đúng khoản giữ |
| Settlement | Chuyển tài sản chờ, không ghi nhận mua lần hai |
| Rerun settlement | Không có tác động tài sản mới |
| Movement/ledger lỗi | Transaction liên quan rollback |
| Reload hoặc mở hai tab | Không tự tạo giao dịch |

**Bài mở rộng: khớp thêm trong khi chờ hủy**

Sau khi khớp 40, gửi hủy nhưng trì hoãn phản hồi. Cho B1 khớp thêm 20 tại 25.000 rồi hủy 40 còn lại.

Kỳ vọng:

```text
Filled = 60.
Canceled = 40.

Buy payable
= 40 × 24.900 + 20 × 25.000
= 1.496.000.

Available cash trước settlement
= 10.000.000 − 1.496.000
= 8.504.000.
```

Không được tiếp tục hủy 60 hoặc giải phóng khoản giữ theo thông tin cũ.

---

## 9. Tình huống debug

**A. API retry không tạo thêm order nhưng simulator có hai lệnh**

Idempotency chỉ bọc phần ghi MySQL. Controller vẫn gọi adapter khi replay.

Cách sửa: replay không thực hiện lại tác dụng nghiệp vụ. Chỉ lần tạo mới được đi tiếp theo luồng dispatch của demo.

**B. OMS đã hủy nhưng B1 vẫn trong sổ**

API tự gọi `CancelConfirmed` mà chưa có kết quả từ simulator.

Kiểm tra cả hai:

```text
Trạng thái OMS.
Phần lệnh còn trong matching.
```

**C. Thanh toán đủ 100 cổ phiếu dù chỉ khớp 40**

Obligation được tạo từ quantity của order thay vì quantity execution.

Nghĩa vụ phải đi theo phần thực sự khớp.

**D. Kết quả cuối đúng nhưng ledger có entry thừa**

Có thể một lỗi cộng hai lần được “bù” bởi lỗi trừ hai lần. Đối chiếu cả lịch sử và số dư, không chỉ con số cuối.

---

## 10. README và demo 5 phút

README cần có:

- Cách chạy MySQL, Redis, backend và frontend.
- Migration và fixture.
- Cấu hình Clock và lịch settlement.
- Cách chạy kịch bản tuần 2.
- Bảng kết quả kỳ vọng.
- Cách xem order, reservation, ledger và obligation.
- Giới hạn về matching trong bộ nhớ và phục hồi sự cố.

Kịch bản trình bày:

| Thời gian | Nội dung |
|---|---|
| Phút 1 | Tiền đầu kỳ, phiên, thanh khoản |
| Phút 2 | Đặt BUY và khoản giữ |
| Phút 3 | Khớp 40, hủy 60 |
| Phút 4 | Thanh toán và tài sản cuối |
| Phút 5 | Replay, rerun và đối chiếu lịch sử |

---

## 11. Prompt cho OpenCode

```text
Tôi đang học ngày 14 của Securities Trading Simulator:
Sản phẩm tuần 2 — OMS, tài sản và thanh toán.

Môi trường:
- Node.js + TypeScript, MySQL, Redis, Vue 3 + TypeScript + Tailwind CSS.
- OpenCode, cấu hình model hiện tại.
- Giữ modular monolith và code ngày 1–13.

Trước khi code:
1. Đọc các module thực tế, không mặc định bài trước đã xong.
2. Liệt kê các liên kết còn thiếu.
3. Xác định transaction tạo lệnh, execution, cancel và settlement.
4. Đề xuất phạm vi tối thiểu hoàn thành trong 30–60 phút.

Mục tiêu:
Một kịch bản:
BUY100 LO25000
→ khớp40@24900
→ hủy60
→ thanh toán40.
Có bằng chứng về order, tiền, chứng khoán và lịch sử.

Tích hợp matching:
- Có MatchingAdapter, ánh xạ OMS orderId với simulator orderId.
- Không tạo thêm OMS order vì simulator cấp ID khác.
- Thanh khoản SELL là SYSTEM_LIQUIDITY giả lập,
  không giả vờ đã có luồng tài sản tài khoản bán hoàn chỉnh.
- Adapter phản hồi tiếp nhận trước execution.
- Replay API không gọi matching lần nữa.
- Không network/matching call trong transaction MySQL.
- CancelRequested chỉ ghi yêu cầu.
- Simulator loại phần dư rồi trả kết quả.
- Sau đó mới CancelConfirmed và giải phóng tiền.
- Event của lệnh có tài sản đi qua handler chung,
  không bypass hạch toán ngày 10–11.

Fixture:
- acc-007 mới, CASH ACTIVE.
- Tiền đầu kỳ10000000 và OPENING ledger.
- Chứng khoán ban đầu0, giá vốn0.
- Clock23/10/2026 10:00 Asia/Ho_Chi_Minh.
- sec-001 TRADABLE, SIM_EQ_A CONTINUOUS.
- Calendar settlement SIM_CAL_V1:
  T+2 business days, nghỉ giả lập26/10,
  đến hạn28/10 13:00 VN.
- Sổ ban đầu rỗng:
  S1 SELL40@24900.
  S2 SELL60@25100.

Luồng:
1. POST /api/orders:
   acc-007 BUY100 sec-001 LO25000,
   Idempotency-Key week2-buy-001.
2. Giữ2500000 trong cùng transaction tạo order.
3. Adapter chấp nhận và matching tạo đúng một execution40@24900.
4. Kết quả:
   filled40, remaining60, reserved1500000,
   payable996000, available7504000,
   pendingBuy40, totalCost996000.
5. Replay cùng request:
   cùng orderId, không thêm hold/order/execution/event.
6. POST cancel, key week2-cancel-001.
7. Chờ simulator xác nhận hủy60.
8. Kết quả:
   CANCELED, filled40, canceled60, remaining0,
   reserved0, payable996000, available9004000.
9. Chuyển FixedClock trong test:
   trước hạn không settle; đúng hạn settle.
10. Cuối:
   settledCash9004000, payable0,
   settledQty40, pendingBuy0, availableQty40,
   totalCost996000, reservation CLOSED.
11. Rerun settlement không thêm tác động tài sản.

Bảo toàn transaction:
- Create: order/event/hold/balance/ledger/idempotency.
- Execution: OMS/hold/cash/position/cost/histories/obligation.
- Cancel confirm: OMS/hold/cash/ledger.
- Settlement: cash/position/histories/obligation/run item.
- Giữ thứ tự khóa nhất quán.
- Không tuyên bố transaction bao phủ cả MySQL và engine trong bộ nhớ.

Kiểm thử:
- Một integration test xuyên suốt, assert ở từng chặng.
- Retry create không dispatch matching lại.
- CancelRequested chưa giải phóng tiền.
- CancelConfirmed loại phần dư khỏi sổ.
- Obligation quantity40, amount996000, không phải quantity order100.
- Rerun settlement không cộng chứng khoán lần hai.
- Ledger và movements đối chiếu được, không chỉ số dư cuối.
- Reload/hai tab không phát sinh giao dịch.
- Nếu còn thời gian, kiểm tra khớp thêm20 trong lúc chờ hủy:
  cuối filled60, canceled40, payable1496000, available8504000.

Dữ liệu:
- Preflight phát hiện fixture cũ không còn ở trạng thái ban đầu.
- Không xóa toàn DB/Redis hoặc ghi đè tài sản để reset.
- Margin calculator vẫn độc lập.
- Tắt random price generator cho sec-001.
- Không viết thêm kiểm thử lặp lại calculator đã đủ;
  ưu tiên lỗi tại ranh giới các module.

Frontend:
- Ghép panel hiện có: phiên, giá, lệnh, timeline,
  số dư, danh mục và settlement.
- Hiển thị trạng thái cụ thể, không dùng một nhãn Thành công chung.
- Có thể dùng script cho thao tác, chưa cần UI đặt lệnh đầy đủ.

Sau khi làm:
- Chạy kiểm tra phù hợp và báo kết quả thực tế.
- Cập nhật README và hướng dẫn demo5 phút.
- Ghi rõ giới hạn phục hồi khi backend dừng giữa DB và matching.
```

**Ngày 14 hoàn thành khi:**

- [ ] Một ý định đặt lệnh chỉ tạo một lệnh và một khoản giữ.
- [ ] Lệnh mua thực sự đi qua matching và khớp đúng 40.
- [ ] Hủy loại đúng 60 còn lại và trả đúng tiền giữ.
- [ ] Thanh toán đúng 40 cổ phiếu, không phải 100.
- [ ] Tiền cuối là **9.004.000 đồng**, chứng khoán khả dụng là **40**.
- [ ] Ledger, movement, timeline và obligation cùng giải thích được kết quả.
- [ ] Demo lặp lại được với dữ liệu đầu vào xác định.

Ngày 15 bắt đầu tuần 3: **rà soát kiến trúc tổng thể và quyền sở hữu dữ liệu**, chuẩn bị cho phân quyền, concurrency, sự kiện và khả năng phục hồi.
