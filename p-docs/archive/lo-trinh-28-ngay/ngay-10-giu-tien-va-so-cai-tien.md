# Ngày 10 — Giữ tiền và sổ cái tiền

Ngày 9 đã chống tạo lệnh trùng. Hôm nay bạn bổ sung bước bảo vệ tài sản:

> “Khi nhận lệnh mua, hệ thống phải dành tiền cho lệnh đó; khi khớp, hủy hoặc bị từ chối, khoản tiền này thay đổi thế nào?”

Điểm quan trọng nhất là **không trừ tiền hai lần khi chuyển từ giữ tiền sang nghĩa vụ thanh toán**.

Môi trường giữ nguyên: **Node.js + TypeScript, MySQL và OpenCode**.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Giữ tiền, tiền mua chờ thanh toán, giải phóng phần dư | Tự đối chiếu được số dư |
| 30 phút kỹ thuật | Reservation, ledger và transaction | Thiết kế được cập nhật nguyên tử |
| Thực hành, thời lượng theo thực tế | Nối đặt lệnh với giữ tiền; xử lý khớp, hủy và kiểm thử | Không tạo khoản giữ hoặc hạch toán trùng |

**Sản phẩm cuối buổi:**

- Đặt lệnh mua và giữ tiền trong cùng transaction.
- Execution chuyển đúng phần tiền giữ sang nghĩa vụ mua.
- Xác nhận hủy hoặc từ chối giải phóng đúng phần còn lại.
- Đối chiếu được số dư từ lịch sử biến động.

Phạm vi hôm nay chỉ gồm **BUY LO, VND, phí và thuế bằng 0**. Chưa thực hiện thanh toán hoặc cập nhật chứng khoán.

---

## 2. Nghiệp vụ — 30 phút

### 2.1. Giữ nguyên mô hình số dư của ngày 6

```text
availableCash
= settledCash
− reservedCash
− buyPayable
− blockedCash
```

| Thành phần | Ý nghĩa |
|---|---|
| `settledCash` | Tiền đã thanh toán còn ghi nhận trên tài khoản |
| `reservedCash` | Giữ cho phần lệnh mua chưa khớp |
| `buyPayable` | Nghĩa vụ tiền mua đã khớp, chưa thanh toán |
| `availableCash` | Tiền được dùng cho yêu cầu mua mới |

**Ngày 10 chưa giảm `settledCash` khi khớp.** Thay vào đó, ghi nhận `buyPayable`. Đến bài thanh toán mới xử lý chuyển tiếp.

Đây là chính sách hạch toán của simulator; phải dùng nhất quán trên API, database và giao diện.

### 2.2. Đặt mua: giữ theo giá giới hạn

Tài khoản có 10 triệu đồng, chưa có khoản giữ hoặc nghĩa vụ khác:

```text
BUY 100 cổ phiếu.
LO giá 25.000 đồng.
```

Tiền cần giữ:

```text
100 × 25.000 = 2.500.000 đồng
```

Sau khi nhận yêu cầu thành công:

| Thành phần | Số tiền |
|---|---:|
| `settledCash` | 10.000.000 |
| `reservedCash` | 2.500.000 |
| `buyPayable` | 0 |
| `availableCash` | 7.500.000 |

Tiền chưa được thanh toán ra ngoài, nhưng không còn được dùng cho lệnh mới.

### 2.3. Khớp một phần tại giá tốt hơn

Lệnh khớp **40 cổ phiếu tại 24.900 đồng**.

Phần giữ theo giá giới hạn cho 40 cổ phiếu:

```text
40 × 25.000 = 1.000.000 đồng
```

Nghĩa vụ mua thực tế:

```text
40 × 24.900 = 996.000 đồng
```

Phần dư được giải phóng:

```text
1.000.000 − 996.000 = 4.000 đồng
```

Sau execution:

| Thành phần | Trước | Sau |
|---|---:|---:|
| `settledCash` | 10.000.000 | 10.000.000 |
| `reservedCash` | 2.500.000 | 1.500.000 |
| `buyPayable` | 0 | 996.000 |
| `availableCash` | 7.500.000 | 7.504.000 |

Không giảm tiếp `settledCash` thêm 996.000 trong bước này. Nếu vừa giảm tiền đó vừa cộng vào `buyPayable`, bạn đã tính nghĩa vụ hai lần.

### 2.4. Gửi hủy: chưa hoàn tiền ngay

Sau khi khớp 40, người dùng yêu cầu hủy 60 còn lại.

```text
CancelRequested:
Không thay đổi reservedCash.
Không thay đổi buyPayable.
```

Trong lúc chờ phản hồi, lệnh vẫn có thể khớp thêm.

Chỉ khi nhận `CancelConfirmed`, giải phóng khoản giữ tương ứng với **phần chưa khớp thực tế lúc xác nhận**.

### 2.5. Xác nhận hủy phần còn lại

Nếu không có execution mới:

```text
Hủy 60 cổ phiếu.
Giải phóng 60 × 25.000 = 1.500.000 đồng.
```

Kết quả:

| Thành phần | Số tiền |
|---|---:|
| `settledCash` | 10.000.000 |
| `reservedCash` | 0 |
| `buyPayable` | 996.000 |
| `availableCash` | 9.004.000 |

Phần đã mua 996.000 vẫn là nghĩa vụ thanh toán.

### 2.6. Khi thanh toán sau này

Đây chỉ là minh họa cho ngày 13:

```text
settledCash: 10.000.000 → 9.004.000
buyPayable:     996.000 → 0
```

Tiền khả dụng vẫn là 9.004.000.

Thanh toán không được làm tiền khả dụng giảm thêm lần nữa cho cùng giao dịch.

---

## 3. Bảng đối chiếu xuyên suốt

| Bước | Tiền đã thanh toán | Giữ tiền | Nghĩa vụ mua | Khả dụng |
|---|---:|---:|---:|---:|
| Ban đầu | 10.000.000 | 0 | 0 | 10.000.000 |
| Đặt mua 100 × 25.000 | 10.000.000 | 2.500.000 | 0 | 7.500.000 |
| Khớp 40 × 24.900 | 10.000.000 | 1.500.000 | 996.000 | 7.504.000 |
| Gửi yêu cầu hủy | 10.000.000 | 1.500.000 | 996.000 | 7.504.000 |
| Xác nhận hủy 60 | 10.000.000 | 0 | 996.000 | 9.004.000 |

Hãy tự tính bảng này trước khi chạy code.

---

## 4. Kỹ thuật — ba lớp dữ liệu

| Lớp | Vai trò |
|---|---|
| `cash_balances` | Các thành phần số dư hiện tại |
| `cash_reservations` | Chi tiết khoản giữ theo từng lệnh |
| `cash_ledger_entries` | Lịch sử biến động để giải thích và đối chiếu |

`cash_balances` phục vụ đọc nhanh. Reservation giải thích tiền đang giữ cho lệnh nào. Ledger giải thích số dư đã thay đổi vì nguyên nhân gì.

Ledger hôm nay là **lịch sử biến động các thành phần số dư**. Chưa phải hệ thống kế toán kép hoàn chỉnh với đầy đủ tài khoản đối ứng.

### 4.1. Dùng tài khoản thực hành mới

Tạo:

```text
acc-003
Loại CASH, trạng thái ACTIVE.
settledCash = 10.000.000.
Các thành phần khác = 0.
```

Lý do: `acc-001` ngày 6 có khoản giữ và nghĩa vụ được seed dưới dạng số tổng, chưa có đầy đủ chi tiết lịch sử.

Không tự tạo lịch sử giao dịch giả để làm các số cũ “khớp”.

Trong bài hôm nay:

- Chạy luồng giữ tiền mới trên `acc-003`.
- Giữ các tài khoản cũ để đọc và chạy bài trước.
- Chỉ bật luồng mới cho tài khoản đã có số dư đầu kỳ và dữ liệu đối chiếu đầy đủ.

### 4.2. Chi tiết một khoản giữ

Đề xuất các trường:

| Trường | Ý nghĩa |
|---|---|
| `initialAmount` | Tổng tiền giữ ban đầu |
| `remainingAmount` | Tiền tiếp tục giữ cho phần chưa khớp |
| `consumedAmount` | Phần đã phân bổ thành nghĩa vụ mua |
| `releasedAmount` | Phần đã giải phóng về khả dụng |
| `status` | `ACTIVE` hoặc `CLOSED` |

Bất biến:

```text
initialAmount
= remainingAmount + consumedAmount + releasedAmount
```

`consumedAmount` không có nghĩa tiền đã thanh toán ra ngoài; đó là phần khoản giữ đã được phân bổ cho giao dịch.

Ví dụ:

| Bước | Ban đầu | Còn giữ | Đã phân bổ | Đã giải phóng |
|---|---:|---:|---:|---:|
| Tạo khoản giữ | 2.500.000 | 2.500.000 | 0 | 0 |
| Khớp 40 tại 24.900 | 2.500.000 | 1.500.000 | 996.000 | 4.000 |
| Hủy 60 còn lại | 2.500.000 | 0 | 996.000 | 1.504.000 |

---

## 5. Schema MySQL

### 5.1. Khoản giữ tiền

```sql
CREATE TABLE cash_reservations (
    id VARCHAR(36) NOT NULL,
    account_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36) NOT NULL,

    initial_amount DECIMAL(20,0) NOT NULL,
    remaining_amount DECIMAL(20,0) NOT NULL,
    consumed_amount DECIMAL(20,0) NOT NULL DEFAULT 0,
    released_amount DECIMAL(20,0) NOT NULL DEFAULT 0,

    status ENUM('ACTIVE', 'CLOSED') NOT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_cash_reservation_order (order_id),

    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),

    CONSTRAINT chk_cash_reservation_amounts CHECK (
        initial_amount > 0
        AND remaining_amount >= 0
        AND consumed_amount >= 0
        AND released_amount >= 0
        AND initial_amount =
            remaining_amount + consumed_amount + released_amount
    ),

    CONSTRAINT chk_cash_reservation_status CHECK (
        (status = 'ACTIVE' AND remaining_amount > 0)
        OR
        (status = 'CLOSED' AND remaining_amount = 0)
    ),

    INDEX idx_cash_reservation_account (
        account_id,
        status
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Service cần bảo đảm tài khoản trên reservation khớp với tài khoản của order.

### 5.2. Lịch sử biến động tiền

```sql
CREATE TABLE cash_ledger_entries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    account_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36) NULL,

    entry_type ENUM(
        'OPENING',
        'RESERVE',
        'EXECUTION',
        'RELEASE'
    ) NOT NULL,

    business_key VARCHAR(160) NOT NULL,

    delta_settled_cash DECIMAL(20,0) NOT NULL DEFAULT 0,
    delta_reserved_cash DECIMAL(20,0) NOT NULL DEFAULT 0,
    delta_buy_payable DECIMAL(20,0) NOT NULL DEFAULT 0,
    delta_blocked_cash DECIMAL(20,0) NOT NULL DEFAULT 0,
    delta_pending_receivable DECIMAL(20,0) NOT NULL DEFAULT 0,

    payload JSON NOT NULL,
    occurred_at TIMESTAMP(3) NOT NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_cash_ledger_business (
        account_id,
        business_key
    ),

    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Các delta cho phép âm vì biểu diễn thay đổi.

Ví dụ business key:

```text
OPENING:acc-003:v1
RESERVE:<orderId>
EXECUTION:<orderId>:<executionId>
RELEASE:<orderId>:CANCELED
```

Ledger không được sửa hoặc xóa để làm đẹp số dư. Nếu sau này có điều chỉnh, ghi biến động điều chỉnh có tham chiếu.

### 5.3. Số dư đầu kỳ

Trong cùng transaction:

1. Tạo `acc-003`.
2. Tạo `cash_balances` có 10 triệu.
3. Tạo ledger `OPENING`, `delta_settled_cash = 10000000`.

Không chỉ seed số dư mà thiếu điểm bắt đầu cho lịch sử.

---

## 6. Transaction đặt lệnh và giữ tiền

Nâng cấp `POST /api/orders` ngày 9 cho luồng BUY của `acc-003`.

```text
BEGIN
→ Giành khóa idempotency
→ Khóa cash_balances của tài khoản
→ Kiểm tra lại khả dụng từ dữ liệu vừa khóa
→ Kiểm tra điều kiện nghiệp vụ
→ Tạo order PENDING_NEW
→ Tạo OrderReceived
→ Tạo cash_reservation
→ Tăng reserved_cash
→ Ghi ledger RESERVE
→ Lưu response idempotency
COMMIT
```

Đọc khóa số dư:

```sql
SELECT *
FROM cash_balances
WHERE account_id = ?
FOR UPDATE;
```

MySQL mô tả `FOR UPDATE` là cách đọc và khóa hàng để bảo vệ chuỗi đọc rồi cập nhật trong transaction; khóa được giải phóng khi commit hoặc rollback. [dev.mysql.com](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html?utm_source=chatgpt.com)

**Yêu cầu triển khai:**

- Mọi repository trong luồng dùng cùng một connection transaction.
- Không gọi `pool.query()` bên ngoài connection đó để ghi một phần dữ liệu.
- Không gọi matching hoặc network trong transaction.
- Thiếu tiền thì rollback; không để lại order hoặc khoản giữ dở dang.
- Replay idempotency trả kết quả cũ, không giữ tiền thêm.

Với các luồng đã có order, thống nhất thứ tự khóa:

```text
cash_balances → orders → cash_reservations
```

Không để một đường code khóa order trước, đường khác khóa số dư trước một cách tùy tiện.

---

## 7. Xử lý execution và kết thúc lệnh

### 7.1. Nhận execution

Giả sử:

```text
Giá giới hạn L.
Khối lượng mới khớp q.
Giá khớp p.
```

Tính:

```text
Phần giữ tương ứng = q × L
Nghĩa vụ thực tế   = q × p
Phần dư giải phóng = q × (L − p)
```

Với BUY LO phải có `p <= L`.

Trong **cùng transaction**:

- Kiểm tra và áp dụng execution vào OMS.
- Giảm `reservation.remainingAmount` theo `q × L`.
- Tăng `reservation.consumedAmount` theo `q × p`.
- Tăng `reservation.releasedAmount` theo phần dư.
- Giảm `cash_balances.reserved_cash` theo `q × L`.
- Tăng `cash_balances.buy_payable` theo `q × p`.
- Ghi order event và ledger `EXECUTION`.

Nếu remaining về 0, reservation chuyển `CLOSED`.

### 7.2. Yêu cầu hủy

```text
CancelRequested:
Không ghi biến động tiền.
Không giải phóng khoản giữ.
```

### 7.3. Xác nhận hủy

Trong cùng transaction:

- OMS hủy đúng lượng còn lại.
- Giảm `reserved_cash` bằng tiền còn giữ.
- Chuyển khoản đó sang `releasedAmount`.
- Đặt `remainingAmount = 0`.
- Đóng reservation.
- Ghi ledger `RELEASE`.

### 7.4. Từ chối lệnh mới

`OrderRejected` khi còn `PENDING_NEW`:

- Giải phóng toàn bộ khoản giữ.
- Đóng reservation.
- Ghi event và ledger cùng transaction.

`CancelRejected` khác hoàn toàn: lệnh vẫn có thể hoạt động, vì vậy **không giải phóng tiền chỉ vì yêu cầu hủy bị từ chối**.

---

## 8. Bảng ledger của kịch bản chính

Các delta dưới đây là số tiền thay đổi:

| Entry | Settled | Reserved | Buy payable | Tác động lên khả dụng |
|---|---:|---:|---:|---:|
| OPENING | +10.000.000 | 0 | 0 | +10.000.000 |
| RESERVE | 0 | +2.500.000 | 0 | −2.500.000 |
| EXECUTION 40 @24.900 | 0 | −1.000.000 | +996.000 | +4.000 |
| RELEASE sau hủy | 0 | −1.500.000 | 0 | +1.500.000 |

Đối chiếu:

```text
reservedCash
= 2.500.000 − 1.000.000 − 1.500.000
= 0

buyPayable
= 996.000

availableCash
= 10.000.000 − 0 − 996.000
= 9.004.000
```

Không yêu cầu tổng tất cả cột delta bằng 0: các cột này là thành phần tính khả dụng, không phải bộ tài khoản kế toán kép.

---

## 9. API và bài thực hành

Giữ API số dư cũ và bổ sung API đọc:

| API | Chức năng |
|---|---|
| `POST /api/orders` | Tạo lệnh BUY và giữ tiền |
| `POST /api/orders/:id/cancel` | Ghi nhận yêu cầu hủy |
| `GET /api/accounts/acc-003/balances` | Đọc số dư |
| `GET /api/orders/:id/cash-reservation` | Đọc khoản giữ của lệnh |
| `GET /api/accounts/acc-003/cash-ledger` | Đọc lịch sử theo thứ tự |

Dùng endpoint mô phỏng ngày 8 để cấp:

```text
OrderAccepted
ExecutionReceived
CancelConfirmed
OrderRejected
```

Nhưng các event đó phải đi qua **service điều phối OMS và tiền mới**, không gọi đường cũ chỉ sửa trạng thái lệnh.

**Kịch bản bắt buộc:**

1. Khởi tạo `acc-003` và ledger đầu kỳ.
2. Đặt BUY 100 @25.000 với khóa `intent-day10-buy-001`.
3. Gửi lại cùng request, xác nhận khoản giữ không tăng.
4. Mô phỏng `OrderAccepted`.
5. Mô phỏng khớp 40 @24.900.
6. Gửi yêu cầu hủy.
7. Xác nhận hủy 60.
8. Đọc số dư, reservation và ledger để đối chiếu.

Kỳ vọng cuối:

```text
Order:
filledQuantity = 40
canceledQuantity = 60
status = CANCELED

Cash:
settledCash = 10.000.000
reservedCash = 0
buyPayable = 996.000
availableCash = 9.004.000

Reservation:
initialAmount = 2.500.000
remainingAmount = 0
consumedAmount = 996.000
releasedAmount = 1.504.000
status = CLOSED
```

---

## 10. Các bất biến và kiểm thử cần giữ

| Kiểm tra | Kết quả |
|---|---|
| Đặt lệnh và giữ tiền | Cùng commit hoặc cùng rollback |
| Replay request đặt | Không tạo khoản giữ hoặc ledger mới |
| Khớp giá tốt hơn | Giải phóng đúng chênh lệch |
| Gửi yêu cầu hủy | Tiền giữ chưa đổi |
| Xác nhận hủy sau partial | Chỉ giải phóng phần chưa khớp |
| Từ chối lệnh mới | Trả toàn bộ khoản giữ |
| Từ chối yêu cầu hủy | Không tự trả tiền |
| Khớp hết | Reservation đóng, không còn tiền giữ |
| Ghi ledger thất bại | OMS, reservation, số dư rollback |
| Execution gửi lại | Không tăng nghĩa vụ hoặc filled lần hai |
| Ledger đầu kỳ và các delta | Dựng lại đúng `cash_balances` |

Với tài khoản đã đưa vào luồng mới:

```text
cash_balances.reserved_cash
= SUM(cash_reservations.remaining_amount)
```

Và với từng khoản giữ:

```text
initialAmount
= remainingAmount + consumedAmount + releasedAmount
```

Để chống cùng execution bị áp dụng hai lần, kiểm tra business key trong transaction đã khóa tài khoản:

- Cùng execution và cùng nội dung: trả kết quả đã xử lý, không cập nhật thêm.
- Cùng execution nhưng khác nội dung: báo xung đột.

Đây là bảo vệ cục bộ cho luồng tiền; cơ chế consumer chống trùng tổng quát sẽ học ở ngày 18.

**Kiểm tra đồng thời tối thiểu:** tài khoản có 10 triệu, hai yêu cầu khác khóa cùng cần 7 triệu. Chỉ một yêu cầu được giữ tiền thành công. Ngày 19 sẽ phân tích sâu hơn các kiểu cạnh tranh và chiến lược khóa.

---

## 11. Tình huống debug

**A. Khớp xong tiền bị trừ hai lần**

Code lỗi:

```text
reservedCash giảm 1.000.000
buyPayable tăng 996.000
settledCash giảm 996.000
```

Trong mô hình hiện tại, không giảm `settledCash` ở bước khớp.

**B. Hủy sau khớp một phần trả lại đủ 2,5 triệu**

Code đang giải phóng `initialAmount`.

Phải giải phóng `remainingAmount` hiện tại, tức 1,5 triệu trong kịch bản chính.

**C. API báo thành công nhưng ledger thiếu**

Một repository dùng connection transaction; repository khác gọi pool và ghi độc lập.

Cách sửa: truyền cùng transaction context qua tất cả thao tác liên quan.

**D. Endpoint mô phỏng cập nhật lệnh nhưng không cập nhật tiền**

Đường xử lý ngày 8 vẫn gọi trực tiếp state machine cũ.

Cách sửa: mọi event ảnh hưởng tài sản của lệnh đã có khoản giữ phải đi qua service điều phối chung. Không để tồn tại đường ghi bỏ qua reservation và ledger.

---

## 12. Prompt cho OpenCode

```text
Tôi đang học ngày 10 của Securities Trading Simulator:
Giữ tiền và sổ cái tiền.

Môi trường:
- Node.js + TypeScript, MySQL.
- OpenCode, cấu hình model hiện tại.
- Giữ kiến trúc modular monolith ngày 1–9.

Trước khi code:
1. Đọc cash_balances, OMS state machine, idempotency
   và các endpoint simulate hiện có.
2. Vẽ ngắn phạm vi transaction hiện tại.
3. Xác định đường ghi nào có thể bỏ qua hạch toán tiền.
4. Lập kế hoạch hoàn thành toàn bộ yêu cầu thực hành và kiểm thử của bài; báo thời lượng dự kiến thực tế.

Phạm vi:
- BUY LO, VND, sec-001.
- Phí/thuế=0.
- Chưa settlement, cập nhật positions hoặc nối matching trực tiếp.
- Chưa triển khai kế toán kép hoàn chỉnh.

Fixture:
- Tạo acc-003 CASH ACTIVE.
- settledCash=10000000.
- reservedCash, buyPayable, blockedCash,
  pendingReceivable đều bằng 0.
- Ghi OPENING ledger cùng transaction với số dư đầu kỳ.
- Không xóa hoặc viết đè acc-001/acc-002.
- Chỉ bật luồng tiền mới cho tài khoản đã được khởi tạo
  ledger và chi tiết số dư đầy đủ.
- Không tự dựng lịch sử giao dịch giả cho số tổng ngày 6.

Mô hình:
availableCash =
settledCash - reservedCash - buyPayable - blockedCash.

Khi khớp:
- Chưa giảm settledCash.
- Giảm reserved theo quantity khớp * limitPrice.
- Tăng buyPayable theo quantity khớp * executionPrice.
- Chênh lệch được giải phóng về khả dụng.

Database:
1. cash_reservations:
   accountId, orderId unique,
   initialAmount, remainingAmount, consumedAmount,
   releasedAmount, status ACTIVE/CLOSED.
2. cash_ledger_entries:
   accountId, orderId, entryType, businessKey unique theo account,
   signed deltas cho năm thành phần cash_balances,
   payload, occurredAt.
3. Tiền DECIMAL(20,0), backend bigint, JSON chuỗi.
4. Reservation:
   initial = remaining + consumed + released.
5. Không sửa/xóa ledger để sửa số dư.

Tạo order:
- Giành idempotency key.
- SELECT cash_balances FOR UPDATE trong transaction.
- Kiểm tra đủ tiền bằng dữ liệu đã khóa.
- Tạo order, OrderReceived, reservation.
- Tăng reserved_cash và ghi RESERVE ledger.
- Lưu response idempotency.
- Tất cả cùng connection và cùng transaction.
- Thiếu tiền rollback, không để order/hold dở dang.
- Replay không giữ tiền thêm.
- Không network call hoặc matching trong transaction.

Execution:
- Dùng cùng transaction cho OMS event, order,
  reservation, cash_balances và ledger.
- Validate trạng thái, remaining và giá BUY LO.
- q=khối lượng lần khớp mới, L=limit, p=execution price.
- remaining reservation giảm q*L.
- consumed tăng q*p.
- released tăng q*(L-p).
- reserved_cash giảm q*L.
- buy_payable tăng q*p.
- Khi remaining=0, reservation CLOSED.
- Business key EXECUTION:<orderId>:<executionId>.
- Cùng execution/nội dung thì không xử lý lần hai.
- Cùng execution khác nội dung thì báo conflict.
- Dedup phải bảo vệ cả OMS và tiền.

Hủy/từ chối:
- CancelRequested không thay đổi tiền.
- CancelConfirmed giải phóng remainingAmount hiện tại.
- OrderRejected từ PENDING_NEW giải phóng toàn bộ khoản giữ.
- CancelRejected không tự giải phóng.
- Mọi cập nhật cùng event/ledger trong transaction.
- Không để endpoint simulate cũ bypass luồng tiền mới.

Thứ tự khóa thống nhất:
cash_balances → orders → cash_reservations.
Không có repository tự commit transaction con.

API đọc:
- GET /api/accounts/:id/balances.
- GET /api/orders/:id/cash-reservation.
- GET /api/accounts/:id/cash-ledger.
- Phân trang đơn giản nếu project đã có quy ước.

Fixture chính:
1. BUY100@25000.
2. Replay cùng Idempotency-Key.
3. OrderAccepted.
4. Execution40@24900.
5. CancelRequested.
6. CancelConfirmed.

Kỳ vọng:
- Order CANCELED, filled40, canceled60.
- settled=10000000, reserved=0,
  buyPayable=996000, available=9004000.
- Reservation initial2500000, remaining0,
  consumed996000, released1504000, CLOSED.

Kiểm thử:
- Đặt và giữ nguyên tử.
- Replay không thêm hold/ledger.
- Execution giá tốt hơn giải phóng đúng.
- Request cancel chưa trả tiền.
- Confirm cancel trả đúng phần còn lại.
- Reject lệnh mới trả toàn bộ hold.
- Reject cancel không trả tiền.
- Duplicate execution không tăng filled/payable lần hai.
- Ghi ledger thất bại rollback các bảng.
- Hai request khác key cùng cần7tr trên tài khoản10tr:
  chỉ một thành công.
- Tổng remaining reservations khớp reserved_cash.
- Tổng ledger deltas từ OPENING khớp cash_balances.

Sau khi làm:
- Chạy kiểm tra phù hợp, báo kết quả thực tế.
- Cập nhật README về mô hình tiền và giới hạn.
- Giải thích vì sao execution chưa giảm settledCash.
- Không triển khai settlement trong bài này.
```

## Ngày 10 hoàn thành khi:

- [ ] Đặt lệnh và giữ tiền cùng transaction.
- [ ] Retry không giữ tiền lần hai.
- [ ] Khớp chuyển đúng tiền giữ sang nghĩa vụ mua.
- [ ] Giá khớp tốt hơn giải phóng đúng phần dư.
- [ ] Yêu cầu hủy chưa trả tiền; xác nhận hủy trả đúng phần còn lại.
- [ ] Ledger giải thích được số dư hiện tại.
- [ ] Không có đường cập nhật OMS bỏ qua hạch toán tiền.

Ngày 11 sẽ xây **danh mục, giá vốn bình quân và P&L**, dùng giá khớp thực tế để tính tài sản của tài khoản.
