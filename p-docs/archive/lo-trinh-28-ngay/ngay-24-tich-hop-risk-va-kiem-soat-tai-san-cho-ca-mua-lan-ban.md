# Ngày 24 — Tích hợp Risk và kiểm soát tài sản cho cả mua lẫn bán

Ngày 23 đã giữ đúng một ý định đặt lệnh khi retry hoặc reload. Hôm nay bạn hoàn thiện điều kiện để ý định đó được chấp nhận:

> “Lệnh mua có đủ tiền không? Lệnh bán có đủ chứng khoán không? Nếu hai lệnh cùng đến, tài sản có bị sử dụng vượt mức không?”

Trọng tâm mới là **giữ chứng khoán cho lệnh bán trong cùng transaction tạo lệnh**.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Kiểm tra giao dịch và giữ tài sản | Hiểu đối xứng mua/bán |
| 30 phút kỹ thuật | Pipeline Risk, reservation và transaction | Có một luồng kiểm tra thống nhất |
| Thực hành, thời lượng theo thực tế | Các tình huống từ chối và cạnh tranh cho BUY và SELL | Không mua hoặc bán vượt khả dụng |

**Sản phẩm cuối buổi:**

- BUY giữ tiền.
- SELL giữ chứng khoán.
- Khớp một phần sử dụng đúng khoản giữ.
- Hủy hoặc từ chối giải phóng đúng phần chưa dùng.
- Frontend hiển thị reason code từ backend.

Tiếp tục **CASH, LO, `sec-001`, phí và thuế bằng 0**. Margin ngày 12 vẫn là calculator độc lập.

---

## 2. Nghiệp vụ — 30 phút

### 2.1. Hai loại lệnh giữ hai loại tài sản

| Phía | Kiểm tra | Khi nhận lệnh |
|---|---|---|
| BUY | Tiền khả dụng ≥ giá giới hạn × khối lượng | Giữ tiền |
| SELL | Chứng khoán khả dụng ≥ khối lượng | Giữ chứng khoán |

Không chỉ kiểm tra rồi tạo order. Phải dành tài sản cho order để yêu cầu khác không tiếp tục sử dụng cùng phần tài sản đó.

### 2.2. Ôn công thức khả dụng

```text
availableCash
= settledCash − reservedCash − buyPayable − blockedCash
```

```text
availableQuantity
= settledQuantity
− pendingSellQuantity
− reservedSellQuantity
− blockedQuantity
```

Chứng khoán mua chờ nhận chưa được bán theo chính sách simulator.

### 2.3. Ví dụ giữ chứng khoán

Tài khoản có:

```text
settledQuantity = 1.000
pendingSellQuantity = 0
reservedSellQuantity = 0
blockedQuantity = 0
```

Đặt bán100:

```text
reservedSellQuantity = 100
availableQuantity = 900
```

Số lượng kinh tế vẫn là1.000. Giữ tài sản không phải đã bán.

### 2.4. Khớp một phần

Lệnh SELL100 khớp40:

```text
reservedSellQuantity: 100 → 60
pendingSellQuantity:    0 → 40
```

Khả dụng vẫn là:

```text
1.000 − 40 − 60 = 900
```

Không giảm khả dụng thêm một lần nữa chỉ vì phần đã giữ chuyển sang nghĩa vụ giao.

### 2.5. Hủy phần còn lại

Sau xác nhận hủy60:

```text
reservedSellQuantity = 0
pendingSellQuantity = 40
availableQuantity = 960
```

40 đã bán vẫn cần giao khi thanh toán.

`CancelRequested` chưa giải phóng60; chỉ `CancelConfirmed` mới làm việc đó.

---

## 3. Pipeline kiểm tra thống nhất

Thứ tự đề xuất:

| Bước | Kiểm tra |
|---|---|
| 1 | Request đúng cấu trúc |
| 2 | Người gọi đã xác thực và có TRADE |
| 3 | Idempotency: replay hay yêu cầu mới |
| 4 | Tài khoản tồn tại, hoạt động |
| 5 | Chứng khoán tồn tại, được giao dịch |
| 6 | Thị trường và phiên hỗ trợ loại lệnh |
| 7 | Giá, khối lượng phù hợp cấu hình |
| 8 | Khả dụng từ dữ liệu đã được bảo vệ |
| 9 | Tạo lệnh và giữ tài sản trong transaction |

Với replay hợp lệ, không thực hiện lại bước giữ tài sản hoặc dispatch matching.

Phân biệt hai loại kiểm tra:

| Loại | Vai trò |
|---|---|
| Preview trên UI/API | Giúp người dùng biết tình trạng hiện tại |
| Kiểm tra quyết định trong transaction | Quyết định có tạo order và reservation không |

Preview đạt không phải giấy bảo đảm tài sản vẫn còn lúc đặt lệnh.

---

## 4. Thiết kế Risk và Accounts

### 4.1. Risk trả quyết định và lý do

```ts
type RiskDecision = {
  allowed: boolean;
  reasonCode: string | null;
  details: Record<string, unknown>;
  evaluatedAt: string;
};
```

Ví dụ:

```json
{
  "allowed": false,
  "reasonCode": "INSUFFICIENT_SECURITIES",
  "details": {
    "requiredQuantity": 1200,
    "availableQuantity": 1000,
    "shortfallQuantity": 200
  },
  "evaluatedAt": "2026-10-23T03:00:00Z"
}
```

### 4.2. Accounts thực hiện giữ tài sản

```ts
interface AccountsService {
  reserveCashForBuy(
    tx: TransactionContext,
    input: ReserveCashInput
  ): Promise<void>;

  reserveSecuritiesForSell(
    tx: TransactionContext,
    input: ReserveSecuritiesInput
  ): Promise<void>;
}
```

Không để Risk controller tự sửa bảng số dư.

Trading Service điều phối:

```text
Xác thực và phân quyền
→ Idempotency
→ Kiểm tra nghiệp vụ
→ Accounts kiểm tra và giữ tài sản
→ OMS ghi nhận lệnh
→ Ghi lịch sử và kết quả
```

Các thay đổi liên quan cùng commit hoặc rollback.

---

## 5. Hoàn thiện `security_reservations`

Ngày 6 đã có:

```text
quantity
status ACTIVE / RELEASED
order_reference
```

Ngày 24 cần theo dõi vòng đời chi tiết hơn.

| Trường | Ý nghĩa mới |
|---|---|
| `quantity` | Khối lượng giữ ban đầu, không đổi |
| `remaining_quantity` | Phần tiếp tục giữ |
| `consumed_quantity` | Phần đã dùng cho execution |
| `released_quantity` | Phần đã giải phóng |
| `order_id` | Liên kết OMS order mới |
| `status` | ACTIVE hoặc CLOSED cho luồng mới |

Có thể giữ trạng thái `RELEASED` cũ để tương thích fixture đã tồn tại.

Bất biến:

```text
quantity
= remainingQuantity
+ consumedQuantity
+ releasedQuantity
```

Ví dụ:

| Bước | Ban đầu | Còn giữ | Đã dùng | Đã giải phóng |
|---|---:|---:|---:|---:|
| Nhận SELL100 | 100 | 100 | 0 | 0 |
| Khớp40 | 100 | 60 | 40 | 0 |
| Hủy60 | 100 | 0 | 40 | 60 |

**Lưu ý migration:**

- Không đổi nghĩa trường cũ âm thầm.
- Mọi phép tính reserved phải chuyển sang phần còn giữ.
- Fixture ACTIVE chưa từng tiêu thụ có thể khởi tạo remaining bằng quantity.
- Không đoán lịch sử của dữ liệu không đủ thông tin.
- Không gắn các `order_reference` giả cũ với order thật không tồn tại.

Các reservation mới có `order_id` và unique constraint để một order không tạo hai khoản giữ.

---

## 6. Transaction đặt lệnh SELL

Để giữ cùng thứ tự khóa với luồng hiện có, bản demo có thể khóa số dư tài khoản trước rồi đến vị thế.

```text
BEGIN
→ Giành khóa idempotency
→ Khóa cash balance theo quy ước chung
→ Khóa position
→ Đọc khoản giữ ACTIVE hiện tại
→ Tính lại lượng có thể bán
→ Nếu đủ: tạo order PENDING_NEW
→ Tạo security reservation
→ Ghi OrderReceived và audit
→ Lưu response idempotency
COMMIT
```

Không gọi matching trong transaction.

Vị thế:

```sql
SELECT *
FROM positions
WHERE account_id = ?
  AND security_id = ?
FOR UPDATE;
```

Sau đó đọc khoản giữ đang hoạt động bằng current locking read:

```sql
SELECT id, remaining_quantity
FROM security_reservations
WHERE account_id = ?
  AND security_id = ?
  AND status = 'ACTIVE'
FOR UPDATE;
```

Cộng các `remaining_quantity` sau khi đã khóa position.

MySQL phân biệt locking read với các truy vấn đọc snapshot; chuỗi kiểm tra rồi ghi cần cơ chế khóa phù hợp để bảo vệ dữ liệu đang quyết định. [dev.mysql.com](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html?utm_source=chatgpt.com)

**Điều kiện:** mọi đường ghi khoản giữ của cùng vị thế đều tuân thủ khóa position trước.

Nếu tài khoản không có position cho mã đó, lượng có thể bán bằng0; không tự tạo chứng khoán để cho lệnh đi tiếp.

---

## 7. Xử lý SELL sau khi khớp

Dùng lại chính sách giá vốn bình quân và làm tròn ngày11.

Với execution SELL:

```text
q = khối lượng mới khớp
p = giá khớp
```

Trong cùng transaction:

1. Kiểm tra execution chưa được áp dụng.
2. OMS cập nhật filled và remaining.
3. Giảm reservation remaining đi q.
4. Tăng reservation consumed thêm q.
5. Tăng `pendingSellQuantity` thêm q.
6. Phân bổ giá vốn và ghi realized P&L.
7. Tăng `pendingReceivable` bằng q × p.
8. Ghi cash ledger và position movement.
9. Tạo nghĩa vụ thanh toán SELL.

**Chưa giảm `settledQuantity` tại bước execution.**

Đồng thời:

```text
economicQuantity giảm q
```

vì công thức đã trừ `pendingSellQuantity`.

Cash ledger cần bổ sung loại như:

```text
SELL_EXECUTION
```

với:

```text
deltaPendingReceivable = q × p
deltaSettledCash = 0
```

Không coi tiền bán chờ nhận là tiền khả dụng trong chính sách CASH hiện tại.

Outbox BUY ngày20 tiếp tục giữ nguyên. Không gửi SELL vào consumer projection chỉ hỗ trợ BUY của ngày18; Portfolio API vẫn đọc dữ liệu nguồn.

---

## 8. Hủy, từ chối và thanh toán

| Sự kiện | Xử lý khoản giữ SELL |
|---|---|
| `CancelRequested` | Giữ nguyên |
| `CancelRejected` | Giữ nguyên |
| `CancelConfirmed` | Giải phóng remaining hiện tại |
| `OrderRejected` trước khớp | Giải phóng toàn bộ khoản giữ |
| Execution khớp hết | Remaining về0, đóng reservation |

Khi thanh toán SELL:

```text
settledQuantity -= quantity
pendingSellQuantity -= quantity

settledCash += amount
pendingReceivable -= amount
```

Không tính lại realized P&L hoặc giảm giá vốn lần nữa tại settlement.

Nếu nhánh SELL settlement ngày13 chưa được triển khai, đây là phần cần hoàn thiện để bật luồng SELL xuyên suốt.

---

## 9. Ba tình huống kiểm tra bắt buộc

**C1 — Mua vượt tiền**

Fixture:

```text
Tiền khả dụng5 triệu.
BUY280 @25000 → cần7 triệu.
```

Kỳ vọng:

```text
422 INSUFFICIENT_CASH.
Không tạo order hoặc khoản giữ dở dang.
```

**C2 — Bán vượt chứng khoán**

Fixture:

```text
Chứng khoán khả dụng1.000.
SELL1.200.
```

Kỳ vọng:

```text
422 INSUFFICIENT_SECURITIES.
Không có security reservation mới.
```

**C3 — Hai lệnh bán tranh cùng vị thế**

Fixture mới:

```text
Settled1.000.
Không pending sell, blocked hoặc reservation.
```

Hai request cùng lúc:

```text
SELL700.
SELL700.
Hai Idempotency-Key khác nhau.
```

Kỳ vọng:

| Thành phần | Kết quả |
|---|---:|
| Lệnh được nhận | 1 |
| Lệnh bị từ chối | 1 |
| Tổng phần đang giữ | 700 |
| Khả dụng còn lại | 300 |

Dùng MySQL thật, ít nhất hai connection và latch như ngày19.

Không dùng chung fixture đã giữ700 cho bài tiếp theo.

---

## 10. Kịch bản SELL khớp một phần

Fixture độc lập:

```text
Tiền settled: 1.000.000.
Chứng khoán settled: 1.000.
Tổng giá vốn: 25.000.000.
Giá vốn bình quân: 25.000.
Không pending, blocked hoặc khoản giữ.
```

Có OPENING cash ledger và opening position movement tương ứng.

Thực hiện:

```text
SELL100 LO26000.
Khớp40 @26000.
Hủy60.
Thanh toán40.
```

Đối chiếu:

| Bước | Settled qty | Pending sell | Reserved sell | Available qty |
|---|---:|---:|---:|---:|
| Ban đầu | 1.000 | 0 | 0 | 1.000 |
| Nhận SELL100 | 1.000 | 0 | 100 | 900 |
| Khớp40 | 1.000 | 40 | 60 | 900 |
| Xác nhận hủy60 | 1.000 | 40 | 0 | 960 |
| Thanh toán40 | 960 | 0 | 0 | 960 |

Sau execution:

```text
Giá trị bán = 40 × 26.000 = 1.040.000.
Giá vốn xuất bán = 40 × 25.000 = 1.000.000.
Realized P&L = 40.000.

Economic quantity = 960.
Total cost = 24.000.000.
Pending receivable = 1.040.000.
```

Sau settlement:

```text
Settled cash = 2.040.000.
Pending receivable = 0.
Realized P&L vẫn40.000.
Total cost vẫn24.000.000.
```

Có thể dùng thanh khoản mua `SYSTEM_LIQUIDITY` cho demo. Chưa coi đó là tài khoản khách hàng mua đã được hạch toán nếu chưa có mapping tương ứng.

---

## 11. API và frontend

Giữ endpoint:

```http
POST /api/orders
```

Bổ sung hỗ trợ SELL đúng nghiệp vụ:

```json
{
  "accountId": "acc-024-sell",
  "securityId": "sec-001",
  "side": "SELL",
  "orderType": "LO",
  "price": 26000,
  "quantity": 100
}
```

Giữ cơ chế intent và recovery ngày23.

UI cần thể hiện:

| Phía | Thông tin ưu tiên |
|---|---|
| BUY | Tiền khả dụng và tiền dự kiến cần giữ |
| SELL | Lượng có thể bán và lượng dự kiến giữ |

Reason code gợi ý:

```text
ACCOUNT_NOT_ACTIVE
SECURITY_NOT_TRADABLE
INVALID_SESSION
INVALID_PRICE
INVALID_QUANTITY
INSUFFICIENT_CASH
INSUFFICIENT_SECURITIES
```

Hiển thị thông tin thiếu cụ thể, ví dụ:

```text
Bạn yêu cầu bán1.200, hiện có thể bán1.000, thiếu200.
```

Frontend không tự tính kết quả cuối bằng cách trừ dần số dư cũ. Sau thao tác, đọc lại backend.

---

## 12. Kiểm thử và debug

| Kiểm thử | Kết quả |
|---|---|
| BUY vượt tiền | Không tạo hold |
| SELL vượt lượng | Không tạo reservation |
| Hai SELL cạnh tranh | Không vượt khả dụng |
| Retry cùng intent SELL | Không giữ thêm chứng khoán |
| Partial execution | Chuyển đúng reserved sang pending sell |
| Cancel requested | Chưa giải phóng |
| Cancel confirmed | Chỉ giải phóng phần còn |
| Reject lệnh mới | Trả đúng khoản giữ |
| Duplicate execution | Không bán hoặc ghi tiền chờ nhận lần hai |
| SELL settlement chạy lại | Không giao cổ phiếu hoặc nhận tiền lần hai |
| Lỗi ghi ledger/movement | Toàn cập nhật liên quan rollback |
| Thiếu quyền | Không có tác động tài sản |

**Debug A — Bán được hai lần cùng cổ phiếu**

Chỉ kiểm tra đủ lượng mà không tạo reservation trong cùng transaction.

**Debug B — Khớp làm khả dụng giảm hai lần**

Tăng pending sell nhưng quên giảm phần đang giữ.

**Debug C — Hủy trả lại cả lượng đã bán**

Giải phóng quantity ban đầu thay vì remaining hiện tại.

**Debug D — Danh mục giảm số lượng hai lần**

Execution đã giảm settled quantity, settlement lại giảm tiếp. Trong mô hình hiện tại, execution tăng pending sell; settlement mới giảm settled.

**Debug E — Khoản giữ partial vẫn tính theo quantity gốc**

Query cũ còn cộng `quantity` thay vì `remaining_quantity`.

---

## 13. Prompt cho OpenCode

```text
Tôi đang học ngày24 của Securities Trading Simulator:
Tích hợp Risk và kiểm soát tài sản BUY/SELL.

Môi trường:
- Node.js + TypeScript, MySQL, Vue 3 + TypeScript + Tailwind CSS.
- OpenCode, cấu hình model hiện tại.
- Giữ auth, idempotency và frontend intent ngày23.

Trước khi code:
1. Đọc pipeline create order, cash reservation,
   security_reservations ngày6 và availability calculator.
2. Đọc cost basis ngày11, settlement ngày13 và locks ngày19.
3. Tìm các giả định BUY-only.
4. Lập kế hoạch hoàn thành cả BUY, SELL và mọi kiểm thử; chỉ rõ phần thiếu và thời lượng dự kiến thực tế.

Phạm vi:
- CASH, LO, sec-001, phí/thuế0.
- BUY giữ tiền; SELL giữ chứng khoán.
- Không tích hợp khoản vay margin.
- Không cho bán pendingBuy theo policy hiện tại.

Pipeline:
- Schema validation.
- Authenticate/TRADE authorization.
- Idempotency replay hoặc request mới.
- Account ACTIVE.
- Security TRADABLE.
- Phiên hỗ trợ.
- Giá/quantity theo config demo.
- Asset check và reservation trong transaction.
- Không coi preview là quyết định giữ tài sản.

Security reservation:
- Giữ quantity là lượng ban đầu.
- Thêm remaining, consumed, released và order_id
  cho luồng OMS mới.
- Initial = remaining + consumed + released.
- Một reservation cho mỗi order mới.
- ACTIVE khi remaining>0, CLOSED khi remaining=0.
- Bảo toàn fixture RELEASED cũ bằng migration có ý nghĩa rõ ràng.
- Không giả tạo lịch sử hoặc order liên kết.
- Mọi query khả dụng chuyển sang remaining đang ACTIVE.

SELL create:
- Giữ thứ tự khóa chung.
- Khóa position trước khi quyết định khả dụng.
- Đọc active reservations bằng current locking read,
  tránh SUM từ snapshot cũ.
- Available = settled - pendingSell - reservedRemaining - blocked.
- Không position thì available0.
- Create order/event/security reservation/audit/idempotency
  cùng transaction.
- Không matching/network call trong transaction.
- Replay không tạo thêm hold hoặc dispatch thêm order.

SELL execution:
- Dedup trước áp dụng.
- Update OMS.
- Reservation remaining-=q, consumed+=q.
- Position pendingSell+=q, settled chưa giảm.
- Tính allocatedCost theo policy ngày11.
- TotalCost giảm allocatedCost.
- RealizedPnL tăng saleValue-allocatedCost.
- Cash pendingReceivable tăng saleValue.
- Ghi SELL_EXECUTION cash ledger, position movement.
- Tạo SELL settlement obligation.
- Tất cả cùng transaction/connection.
- Không tính tiền bán chờ nhận vào availableCash.

Cancel/reject:
- CancelRequested/CancelRejected không giải phóng.
- CancelConfirmed giải phóng remaining hiện tại.
- OrderRejected trước khớp trả toàn bộ hold.
- Đóng reservation khi remaining0.
- Không sửa phần đã khớp.

SELL settlement:
- SettledQty-=q, pendingSell-=q.
- SettledCash+=amount, pendingReceivable-=amount.
- Không tính cost/PnL lần hai.
- Bảo vệ rerun theo obligation.

Outbox:
- Giữ BUY event flow ngày20.
- Không gửi SELL vào BUY-only consumer ngày18.
- Portfolio UI tiếp tục dùng dữ liệu nguồn.
- Không tuyên bố projection SELL đã hỗ trợ nếu chưa triển khai.

Tests bắt buộc:
1. Tiền5tr, BUY280@25000 bị từ chối.
2. Available1000, SELL1200 bị từ chối.
3. Fixture độc lập1000 cổ phiếu,
   hai SELL700 cùng lúc, hai key:
   một accepted, một rejected, reserved700, available300.
- MySQL thật, hai connection, latch có timeout.

Fixture partial độc lập:
- Tiền1tr và OPENING ledger.
- Settled1000, totalCost25tr, realized0.
- Opening position movement đầy đủ.
- SELL100@26000, fill40@26000, cancel60, settle40.
- Sau execution:
  pendingSell40, reserved60, available900,
  economic960, cost24tr, realized40000,
  pendingReceivable1040000.
- Sau cancel: reserved0, available960.
- Sau settlement:
  settledQty960, pendingSell0,
  cash2040000, receivable0,
  cost/PnL không đổi.
- Có thể dùng SYSTEM_LIQUIDITY làm đối ứng,
  không giả vờ đã hạch toán tài khoản bên kia.

Frontend:
- Bật SELL khi backend đã đủ.
- Hiển thị availableQuantity và lượng cần giữ.
- Giữ intent/key bất biến khi retry.
- Refresh backend state sau thao tác.
- Hiển thị reason code và shortfall.

Sau khi làm:
- Chạy kiểm tra phù hợp, báo kết quả thực tế.
- Đối chiếu order/hold/cash/position/cost/obligation.
- Cập nhật README về migration, policy và giới hạn.
```

**Ngày 24 hoàn thành khi:**

- [ ] BUY và SELL đều giữ đúng loại tài sản.
- [ ] Kiểm tra và giữ tài sản nằm trong transaction được bảo vệ.
- [ ] Hai lệnh không dùng vượt cùng một vị thế.
- [ ] Partial fill chuyển khoản giữ sang nghĩa vụ đúng một lần.
- [ ] Hủy chỉ giải phóng phần chưa khớp.
- [ ] Tiền bán chờ nhận, giá vốn và P&L được ghi đúng.
- [ ] Frontend giữ nguyên cơ chế intent/retry khi bật SELL.

Ngày 25 sẽ hoàn thiện **Matching Simulator qua adapter**, kiểm tra chuỗi nhiều execution, khớp thêm trong lúc chờ hủy và đối chiếu dữ liệu giữa matching với OMS.
