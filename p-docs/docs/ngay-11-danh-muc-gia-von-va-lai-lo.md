# Ngày 11 — Danh mục, giá vốn bình quân và lãi/lỗ

Ngày 10 đã quản lý tiền của lệnh mua. Hôm nay bạn bổ sung phần chứng khoán:

> “Sau những lần khớp mua, tài khoản có bao nhiêu cổ phiếu, giá vốn bao nhiêu và đang lãi/lỗ thế nào?”

Điểm quan trọng nhất là **dùng giá khớp thực tế để tính giá vốn**, đồng thời tách số lượng dùng để định giá khỏi số lượng được phép bán.

Môi trường giữ nguyên: **Node.js + TypeScript, MySQL, Vue 3 + TypeScript + Tailwind CSS và OpenCode**.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Giá vốn, giá thị trường, lãi/lỗ đã và chưa thực hiện | Tự tính được ví dụ mua/bán |
| 30 phút kỹ thuật | Position, lịch sử biến động và định giá | Có công thức, schema và API |
| 30–60 phút thực hành | Calculator, cập nhật sau mua và Portfolio API | Kết quả tính tay khớp API |

**Sản phẩm cuối buổi:**

- Tính giá vốn bình quân sau hai lần mua.
- Định giá danh mục bằng Market Data.
- Tính lãi/lỗ chưa thực hiện.
- Tính giá vốn xuất bán và lãi/lỗ đã thực hiện trên fixture độc lập.
- Hiển thị rõ chứng khoán chờ nhận và chứng khoán có thể bán.

Phạm vi: **cổ phiếu `sec-001`, vị thế mua thông thường, không bán khống, phí và thuế bằng 0**.

---

## 2. Nghiệp vụ — 30 phút

### 2.1. Phân biệt những con số trên danh mục

| Khái niệm | Ý nghĩa |
|---|---|
| Tổng giá vốn còn lại | Chi phí được phân bổ cho lượng cổ phiếu còn trong vị thế |
| Giá vốn bình quân | Tổng giá vốn còn lại chia cho số lượng tương ứng |
| Giá thị trường | Giá dùng để định giá tại thời điểm xem |
| Giá trị thị trường | Số lượng định giá × giá thị trường |
| Lãi/lỗ chưa thực hiện | Giá trị thị trường trừ tổng giá vốn còn lại |
| Lãi/lỗ đã thực hiện | Giá trị bán trừ giá vốn phân bổ cho phần đã bán |

Giá vốn bình quân khác giá mua của lần gần nhất.

Lãi chưa thực hiện cũng chưa phải tiền mặt đã nhận.

### 2.2. Hai lần mua, một giá vốn bình quân

Giả sử:

| Lần mua | Giá khớp | Khối lượng | Giá trị |
|---|---:|---:|---:|
| 1 | 25.000 | 100 | 2.500.000 |
| 2 | 27.000 | 100 | 2.700.000 |
| Tổng | | **200** | **5.200.000** |

Giá vốn bình quân:

```text
5.200.000 / 200 = 26.000 đồng/cổ phiếu
```

Không lấy 27.000 làm giá vốn cho toàn bộ danh mục.

Công thức khi mua thêm:

```text
newQuantity = oldQuantity + boughtQuantity

newTotalCost
= oldTotalCost + executionPrice × boughtQuantity

newAverageCost
= newTotalCost / newQuantity
```

### 2.3. Lãi/lỗ chưa thực hiện

Nếu giá thị trường là 27.000:

```text
Giá trị thị trường = 200 × 27.000 = 5.400.000

Lãi chưa thực hiện
= 5.400.000 − 5.200.000
= 200.000 đồng
```

Nếu giá giảm xuống 25.000:

```text
Giá trị thị trường = 5.000.000
Lỗ chưa thực hiện  = −200.000
```

Giá thị trường đổi làm P&L thay đổi, nhưng không tự làm giá vốn thay đổi.

### 2.4. Bán một phần

Giả sử 200 cổ phiếu trên **đã đủ điều kiện bán**, bạn bán 50 tại 27.000:

```text
Giá trị bán = 50 × 27.000 = 1.350.000

Giá vốn phần bán = 50 × 26.000 = 1.300.000

Lãi đã thực hiện = 50.000 đồng
```

Vị thế còn lại:

```text
Số lượng:       150
Tổng giá vốn:   5.200.000 − 1.300.000 = 3.900.000
Giá vốn BQ:     26.000
```

Nếu giá thị trường vẫn 27.000:

```text
Lãi chưa thực hiện
= 150 × 27.000 − 3.900.000
= 150.000 đồng
```

Đối chiếu:

```text
Lãi đã thực hiện       50.000
Lãi chưa thực hiện   150.000
Tổng                 200.000
```

Lãi đã thực hiện không đồng nghĩa tiền bán đã khả dụng. Tiền vẫn có thể đang chờ thanh toán.

---

## 3. Số lượng định giá khác số lượng được bán

Tiếp tục mô hình ngày 6:

```text
economicQuantity
= settledQuantity
+ pendingBuyQuantity
− pendingSellQuantity
```

Đây là **số lượng vị thế kinh tế dùng để tính giá vốn và định giá trong simulator**.

Trong khi đó:

```text
availableQuantity
= settledQuantity
− pendingSellQuantity
− reservedQuantity
− blockedQuantity
```

Ví dụ sau hai lần mua, chưa thanh toán:

| Thành phần | Khối lượng |
|---|---:|
| Đã thanh toán | 0 |
| Mua chờ nhận | 200 |
| Bán chờ giao | 0 |
| Vị thế kinh tế | 200 |
| Có thể bán | 0 |

Bạn có thể hiển thị giá trị và P&L của 200 cổ phiếu, nhưng chưa cho phép bán theo chính sách đang dùng.

**Không tự chuyển `pendingBuyQuantity` thành `settledQuantity` để làm bài bán.** Chuyển trạng thái thanh toán sẽ được triển khai ngày 13.

Hôm nay dùng hai kịch bản:

1. **Kịch bản mua:** cập nhật vị thế chờ nhận và giá vốn.
2. **Kịch bản bán độc lập:** calculator/kiểm thử bắt đầu từ vị thế đã thanh toán.

---

## 4. Thiết kế kỹ thuật

### 4.1. Phân chia trách nhiệm

| Thành phần | Trách nhiệm |
|---|---|
| Accounts / Position Service | Cập nhật các lượng chứng khoán |
| Cost calculator | Tính giá vốn và lãi/lỗ đã thực hiện |
| Portfolio Service | Tổng hợp vị thế và giá thị trường |
| Market Data | Cung cấp giá định giá |
| OMS | Cung cấp execution đã được xác nhận |

Portfolio không được tự sửa tiền trong `cash_balances`.

Không tạo thêm một bảng số lượng độc lập rồi để nó lệch với `positions`.

Cấu trúc đề xuất:

```text
src/modules/portfolio/
  portfolio.routes.ts
  portfolio.service.ts
  portfolio.types.ts
  cost-basis.calculator.ts
  pnl.calculator.ts
  portfolio.repository.ts
```

Phần ghi vị thế có thể nằm trong Accounts hoặc Position Service hiện có. Quan trọng là có **một nơi chịu trách nhiệm ghi**.

### 4.2. Tính giá vốn từ execution

Đầu vào mua:

```json
{
  "executionId": "exe-buy-001",
  "orderId": "ord-buy-001",
  "accountId": "acc-004",
  "securityId": "sec-001",
  "side": "BUY",
  "price": "25000",
  "quantity": 100
}
```

Cập nhật:

```text
pendingBuyQuantity += 100
totalCost += 2.500.000
```

Không cập nhật theo:

- Giá đặt lệnh.
- Giá tham chiếu.
- Giá trên bảng điện tại thời điểm consumer chạy.
- Sự kiện `OrderAccepted`.

**Chỉ có execution mới tạo thay đổi mua/bán trong bài này.**

---

## 5. Chính sách độ chính xác và làm tròn

Không nên lưu giá vốn bình quân đã làm tròn rồi dùng nó làm nguồn tính toán tiếp theo.

**Nguồn dữ liệu gốc:**

```text
economicQuantity
totalCost
```

Giá vốn bình quân là giá trị suy ra.

MySQL hỗ trợ phép tính chính xác với các kiểu exact-value như `DECIMAL`; tuy nhiên phép chia và làm tròn vẫn cần chính sách của ứng dụng. [dev.mysql.com](https://dev.mysql.com/doc/refman/8.4/en/precision-math-numbers.html?utm_source=chatgpt.com)

Quy ước bài học:

| Dữ liệu | Cách xử lý |
|---|---|
| Tổng giá vốn | Số nguyên đồng, `DECIMAL(20,0)` |
| Lãi/lỗ đã thực hiện | Số nguyên đồng, có thể âm |
| Backend tính tiền | `bigint` |
| Tiền qua JSON | Chuỗi |
| Giá vốn bình quân | Chuỗi thập phân để hiển thị |

**Khi bán một phần:**

```text
allocatedCost
= roundHalfUp(totalCost × soldQuantity / economicQuantity)
```

Tính trên số nguyên chính xác, không chuyển sang `number`.

Nếu bán toàn bộ:

```text
allocatedCost = toàn bộ totalCost còn lại
```

Điều này bảo đảm không để sót vài đồng giá vốn khi vị thế về 0.

Sau bán:

```text
remainingCost = oldTotalCost − allocatedCost

realizedPnlDelta
= executionPrice × soldQuantity − allocatedCost
```

Do phân bổ theo đồng nguyên, giá vốn bình quân còn lại có thể chênh rất nhỏ sau làm tròn. Không lấy con số bình quân đã format trên UI để tính nghiệp vụ.

---

## 6. Database MySQL

### 6.1. Mở rộng bảng `positions`

```sql
ALTER TABLE positions
    ADD COLUMN total_cost DECIMAL(20,0) NULL,
    ADD COLUMN realized_pnl DECIMAL(20,0) NULL,

    ADD CONSTRAINT chk_position_total_cost
        CHECK (total_cost IS NULL OR total_cost >= 0);
```

Vì sao cho phép `NULL`?

Các vị thế seed từ ngày 6 chưa có lịch sử giá vốn. Không mặc định chúng có giá vốn bằng 0, vì như vậy UI có thể báo lãi giả.

Quy tắc:

- Vị thế mới, chưa có cổ phiếu: khởi tạo cost và realized bằng 0.
- Vị thế cũ chưa biết giá vốn: `costStatus = MISSING`.
- Khi thiếu giá vốn, không tính P&L bằng cách coi cost bằng 0.

### 6.2. Lịch sử biến động vị thế

```sql
CREATE TABLE position_movements (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    account_id VARCHAR(36) NOT NULL,
    security_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36) NULL,
    execution_id VARCHAR(64) NULL,

    movement_type ENUM('OPENING', 'BUY', 'SELL') NOT NULL,
    business_key VARCHAR(160) NOT NULL,

    delta_economic_quantity BIGINT NOT NULL,
    delta_total_cost DECIMAL(20,0) NOT NULL,
    delta_realized_pnl DECIMAL(20,0) NOT NULL DEFAULT 0,

    payload JSON NOT NULL,
    occurred_at TIMESTAMP(3) NOT NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_position_movement_business (
        account_id,
        security_id,
        business_key
    ),

    FOREIGN KEY (account_id, security_id)
        REFERENCES positions(account_id, security_id),

    FOREIGN KEY (order_id) REFERENCES orders(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Ví dụ hai lần mua:

| Movement | Delta số lượng kinh tế | Delta giá vốn | Delta lãi/lỗ đã thực hiện |
|---|---:|---:|---:|
| BUY 100 @25.000 | +100 | +2.500.000 | 0 |
| BUY 100 @27.000 | +100 | +2.700.000 | 0 |

Với fixture bán 50:

```text
deltaEconomicQuantity = −50
deltaTotalCost = −1.300.000
deltaRealizedPnl = +50.000
```

---

## 7. Nối với transaction execution ngày 10

Khi xử lý execution BUY, bổ sung Position Service vào transaction hiện có:

```text
BEGIN
→ Khóa số dư tiền
→ Khóa order và reservation
→ Kiểm tra execution chưa xử lý
→ Khóa hoặc khởi tạo position
→ Cập nhật OMS
→ Cập nhật khoản giữ và nghĩa vụ tiền
→ Cập nhật pendingBuyQuantity và totalCost
→ Ghi order event
→ Ghi cash ledger
→ Ghi position movement
COMMIT
```

Mọi thay đổi dùng cùng connection transaction.

Nếu ghi position movement thất bại, không được để OMS và tiền commit riêng.

**Chống trùng phải bao phủ toàn bộ luồng.** Nếu execution đã được áp dụng, không tăng vị thế thêm lần nữa.

Đối với fixture đã xử lý ở ngày 10 nhưng chưa có movement chứng khoán, không tự replay để “bổ sung” mà vô tình hạch toán lại tiền. Dùng dữ liệu mới hoặc thiết kế backfill riêng.

---

## 8. Kịch bản thực hành

### 8.1. Kịch bản A — hai lần mua mới

Tạo tài khoản demo mới `acc-004`:

```text
Tiền đầu kỳ: 10.000.000.
Có cash ledger OPENING.
Chưa có chứng khoán.
Đã bật luồng giữ tiền ngày 10.
```

Tạo hai lệnh và execution:

| Lệnh | Giá LO | Khối lượng khớp | Giá khớp |
|---|---:|---:|---:|
| B1 | 25.000 | 100 | 25.000 |
| B2 | 27.000 | 100 | 27.000 |

Sau hai execution:

```text
settledQuantity = 0
pendingBuyQuantity = 200
pendingSellQuantity = 0

economicQuantity = 200
availableQuantity = 0

totalCost = 5.200.000
averageCost = 26.000
realizedPnl = 0
```

Đối chiếu tiền ngày 10:

```text
settledCash = 10.000.000
reservedCash = 0
buyPayable = 5.200.000
availableCash = 4.800.000
```

Trong kiểm thử định giá, cấu hình Market Data fixture trả giá 27.000:

```text
marketValue = 5.400.000
unrealizedPnl = 200.000
```

### 8.2. Kịch bản B — bán từ vị thế đã thanh toán

Dùng fixture độc lập trong kiểm thử calculator/Position Service:

```text
settledQuantity = 200
pendingBuyQuantity = 0
pendingSellQuantity = 0
reservedQuantity = 0
blockedQuantity = 0

totalCost = 5.200.000
realizedPnl = 0
```

Áp dụng bán 50 tại 27.000:

```text
settledQuantity = 200
pendingSellQuantity = 50
economicQuantity = 150
availableQuantity = 150

totalCost = 3.900.000
realizedPnl = 50.000
```

Chưa giảm `settledQuantity` ngay vì giao chứng khoán chưa được thanh toán.

Nhánh này dùng để kiểm chứng nghiệp vụ vị thế. **Chưa bật luồng bán tài khoản hoàn chỉnh**, vì giữ chứng khoán và hạch toán tiền bán còn phải được tích hợp ở các bài sau.

---

## 9. Portfolio API

```http
GET /api/accounts/acc-004/portfolio
```

Ví dụ response khi giá thị trường là 27.000:

```json
{
  "data": {
    "accountId": "acc-004",
    "currency": "VND",
    "valuationPolicy": "LAST_TRADED_PRICE",
    "positions": [
      {
        "securityId": "sec-001",
        "symbol": "SIMAAA",
        "marketCode": "SIM_EQ_A",

        "settledQuantity": 0,
        "pendingBuyQuantity": 200,
        "pendingSellQuantity": 0,
        "economicQuantity": 200,
        "availableQuantity": 0,

        "costStatus": "KNOWN",
        "totalCost": "5200000",
        "averageCost": "26000.000000",

        "marketPrice": "27000",
        "marketValue": "5400000",
        "unrealizedPnl": "200000",
        "realizedPnl": "0",

        "quoteUpdatedAt": "2026-10-20T03:00:00Z",
        "valuationStatus": "AVAILABLE"
      }
    ]
  }
}
```

**Quy tắc khi thiếu dữ liệu:**

| Tình huống | Cách trả |
|---|---|
| Chưa có giá khớp để định giá | Market price/value/unrealized P&L là `null` |
| Có vị thế nhưng thiếu giá vốn | `costStatus: MISSING`, average cost và P&L chưa thực hiện là `null` |
| Có giá nhưng dữ liệu cũ | Giữ timestamp và hiển thị tình trạng dữ liệu |
| Market Data lỗi | Báo không định giá được; không dùng giá 0 thay thế |
| Số lượng kinh tế bằng 0 | `averageCost: null`, tổng giá vốn phải bằng 0 nếu đã hạch toán đầy đủ |

Trong API này, các trường giá trị tiền và giá định giá được trả bằng chuỗi. Không tự động thay đổi contract số của bảng giá ngày 3.

Chưa cần tổng hợp toàn danh mục nếu còn vị thế thiếu giá hoặc thiếu giá vốn; tránh đưa ra một “tổng P&L” có vẻ đầy đủ nhưng thực tế bỏ sót dữ liệu.

---

## 10. Giao diện Vue và bài tập debug

Hiển thị tối thiểu:

| Mã | Vị thế kinh tế | Có thể bán | Giá vốn BQ | Giá thị trường | Lãi/lỗ chưa thực hiện |
|---|---:|---:|---:|---:|---:|
| SIMAAA | 200 | 0 | 26.000 | 27.000 | +200.000 |

Thêm nhãn:

```text
200 cổ phiếu mua chờ nhận.
```

**Debug A — Giá vốn dùng giá đặt lệnh**

Đặt mua 100 giá 25.000, khớp tại 24.900.

```text
Giá vốn đúng = 2.490.000.
```

Nếu code cộng 2.500.000, kiểm tra nguồn giá truyền vào calculator.

**Debug B — Giá thị trường đổi làm thay đổi giá vốn**

Giá vốn chỉ thay đổi bởi các nghiệp vụ đã định nghĩa như mua, bán hoặc điều chỉnh. Một quote mới chỉ làm thay đổi phần định giá.

**Debug C — Bán xong giá vốn không giảm**

Nếu chỉ giảm số lượng mà giữ nguyên `totalCost`, giá vốn bình quân phần còn lại sẽ tăng sai.

**Debug D — Mua chờ nhận được phép bán**

Code dùng `economicQuantity` để kiểm tra bán. Phải dùng `availableQuantity`.

**Debug E — Cổ phiếu bị giữ không còn được định giá**

Khoản giữ hoặc phong tỏa làm giảm khả dụng, không tự làm mất quyền lợi kinh tế trong mô hình. Không trừ chúng khỏi `economicQuantity`.

---

## 11. Kiểm thử bắt buộc

| Kiểm thử | Kết quả |
|---|---|
| Mua lần đầu | Tổng giá vốn bằng giá trị execution |
| Mua thêm khác giá | Bình quân theo khối lượng |
| Giá đặt khác giá khớp | Dùng giá khớp |
| Giá thị trường đổi | Giá vốn không đổi |
| Mua chờ nhận | Có định giá nhưng chưa có thể bán |
| Bán một phần | Phân bổ đúng giá vốn |
| Bán hết | Quantity và totalCost còn lại đều bằng 0 |
| Giá vốn chia không hết | Làm tròn đúng chính sách |
| Thiếu giá hoặc giá vốn | Không trả P&L giả bằng 0 |
| Execution trùng | Không cộng vị thế hoặc giá vốn lần hai |
| Movement ghi thất bại | OMS, tiền và vị thế rollback |
| Có reservation hoặc blocked quantity | Vẫn định giá lượng kinh tế đúng |

Với fixture có lịch sử đầy đủ:

```text
Tổng delta economicQuantity = economicQuantity hiện tại.
Tổng delta totalCost = totalCost hiện tại.
Tổng delta realizedPnl = realizedPnl hiện tại.
```

---

## 12. Prompt cho OpenCode

```text
Tôi đang học ngày 11 của Securities Trading Simulator:
Danh mục, giá vốn bình quân và P&L.

Môi trường:
- Node.js + TypeScript, MySQL, Vue 3 + TypeScript + Tailwind CSS.
- OpenCode, cấu hình model hiện tại.
- Giữ kiến trúc và transaction ngày 1–10.

Trước khi code:
1. Đọc positions, availability calculator và execution handler ngày 10.
2. Đọc contract Market Data và cách xử lý tiền.
3. Xác định một nơi chịu trách nhiệm ghi vị thế.
4. Đề xuất phạm vi 30–60 phút.

Phạm vi:
- Chỉ sec-001, vị thế long, không short.
- Phí/thuế=0.
- Dùng moving weighted average.
- Chưa settlement hoặc API bán tài khoản hoàn chỉnh.

Công thức:
economicQuantity =
settledQuantity + pendingBuyQuantity - pendingSellQuantity.

availableQuantity vẫn theo ngày 6:
settledQuantity - pendingSellQuantity
- activeReservations - blockedQuantity.

Giá vốn:
- Lưu totalCost, không dùng averageCost đã làm tròn làm nguồn gốc.
- BUY:
  pendingBuyQuantity += execution.quantity.
  totalCost += execution.price * execution.quantity.
- SELL calculator/fixture:
  allocatedCost =
  roundHalfUp(totalCost * soldQuantity / economicQuantity).
  Nếu bán hết, lấy toàn bộ totalCost còn lại.
  totalCost -= allocatedCost.
  realizedPnl += saleValue - allocatedCost.
  pendingSellQuantity += soldQuantity.
  Chưa giảm settledQuantity khi chưa settlement.

Độ chính xác:
- Tổng tiền, tổng cost, P&L: DECIMAL(20,0), backend bigint.
- P&L có thể âm.
- JSON trả chuỗi.
- averageCost chỉ là dữ liệu suy ra để hiển thị,
  định dạng chuỗi tối đa 6 chữ số thập phân.
- Không chuyển bigint sang number để chia.
- Viết và kiểm tra helper làm tròn rõ ràng.

Database:
1. Mở rộng positions:
   total_cost nullable, realized_pnl nullable.
2. Không mặc định giá vốn vị thế cũ ngày 6 bằng 0.
3. Vị thế mới rỗng có cost=0, realized=0.
4. Tạo position_movements theo schema bài học.
5. Unique business key theo account/security.
6. Movement có delta quantity kinh tế, totalCost, realizedPnl.

Tích hợp BUY:
- Mở rộng transaction execution ngày 10.
- OMS, cash reservation, cash balance, cash ledger,
  position và position movement cùng transaction/connection.
- Khóa position theo thứ tự thống nhất sau các khóa hiện có.
- Nếu position chưa có, khởi tạo an toàn trong transaction.
- Dedup execution trước khi áp dụng lại bất kỳ phần nào.
- Movement lỗi phải rollback toàn luồng.
- Không tự replay execution cũ ngày 10 để backfill.

Fixture mua:
- Tạo acc-004 mới, tiền10tr và cash ledger OPENING.
- Vị thế ban đầu0.
- BUY100@25000, BUY100@27000, giá khớp như giá đặt.
- Kỳ vọng:
  pendingBuy200, settled0, economic200, available0,
  totalCost5200000, average26000, realized0.
- Cash:
  settled10000000, reserved0,
  payable5200000, available4800000.

Fixture định giá:
- MarketData adapter trong test trả lastPrice27000.
- MarketValue5400000, unrealized200000.
- Đổi quote không thay totalCost.

Fixture bán độc lập:
- Bắt đầu settled200, cost5200000, realized0,
  không pending hoặc reservation.
- SELL50@27000.
- Kỳ vọng:
  pendingSell50, economic150, available150,
  cost3900000, realized50000.
- Kiểm chứng calculator/PositionService bằng test độc lập.
- Chưa bật API bán end-to-end hoặc giả lập thanh toán để bán.

API:
GET /api/accounts/:id/portfolio.

Response:
- Có economic và available quantity riêng.
- TotalCost, averageCost, marketPrice, marketValue,
  unrealizedPnl, realizedPnl.
- Có quoteUpdatedAt, costStatus, valuationStatus.
- Thiếu quote thì giá/value/unrealized=null.
- Thiếu cost thì không giả định bằng0.
- Không gọi Market Data bên trong transaction đang giữ khóa DB.

Kiểm thử:
- Hai lần mua, giá đặt khác giá khớp.
- Giá thị trường thay đổi không đổi cost.
- Pending buy chưa được bán.
- Bán một phần, bán hết, phân bổ làm tròn.
- Thiếu quote/cost.
- Duplicate execution.
- Movement failure rollback cả OMS và tiền.
- Reserved/blocked không bị trừ khỏi lượng định giá.

Nếu còn thời gian:
- PortfolioPanel Vue hiển thị rõ chứng khoán mua chờ nhận,
  số lượng định giá và số lượng có thể bán.

Sau khi làm:
- Chạy kiểm tra phù hợp và báo kết quả thực tế.
- Cập nhật README về cost policy, rounding và giới hạn.
- Giải thích ví dụ 200 cổ phiếu nhưng available bằng0.
```

**Ngày 11 hoàn thành khi:**

- [ ] Giá vốn được tính bằng giá khớp thực tế.
- [ ] Hai lần mua cho đúng giá vốn bình quân.
- [ ] Quote mới chỉ thay đổi định giá, không sửa giá vốn.
- [ ] Tách được vị thế kinh tế và lượng có thể bán.
- [ ] Bán một phần phân bổ đúng giá vốn và P&L.
- [ ] Thiếu dữ liệu không tạo lãi/lỗ giả.
- [ ] Execution không làm tiền, vị thế hoặc lịch sử cập nhật dở dang.

Ngày 12 sẽ học **margin, tài sản bảo đảm và sức mua**, xây calculator riêng với chính sách giả lập, chưa đưa khoản vay vào luồng tiền mặt hiện tại.
