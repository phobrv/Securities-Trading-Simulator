# Ngày 13 — Thanh toán và đối soát

Ngày 10–11 đã ghi nhận tiền mua phải trả và chứng khoán mua chờ nhận. Hôm nay bạn hoàn thiện bước tiếp theo:

> “Khi đến hạn thanh toán, hệ thống chuyển tiền và chứng khoán sang trạng thái đã thanh toán thế nào, và làm sao chứng minh không ghi nhận hai lần?”

Bạn sẽ xây **Settlement Service**, lịch ngày làm việc và một bài đối soát bằng báo cáo giả lập.

Môi trường giữ nguyên: **Node.js + TypeScript, MySQL và OpenCode**.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Ngày giao dịch, ngày thanh toán, nghĩa vụ và đối soát | Hiểu tài sản thay đổi ở bước nào |
| 30 phút kỹ thuật | Obligation, lịch, batch và transaction | Có thiết kế chạy lại an toàn |
| 30–60 phút thực hành | Tạo nghĩa vụ, chạy thanh toán, kiểm tra đối soát | Không cộng/trừ tài sản lần hai |

**Sản phẩm cuối buổi:**

- Execution tạo nghĩa vụ thanh toán.
- Ngày đến hạn được tính theo lịch.
- Thanh toán cập nhật đồng thời tiền và chứng khoán.
- Chạy lại batch không làm thay đổi kết quả.
- Báo cáo đối soát chỉ ra dữ liệu thiếu hoặc sai.

Phạm vi bắt buộc là **thanh toán BUY**. Nhánh SELL dùng fixture độc lập hoặc làm mở rộng vì luồng bán tài khoản chưa hoàn chỉnh.

---

## 2. Nghiệp vụ — 30 phút

### 2.1. Khớp lệnh và thanh toán khác nhau

| Bước | Điều đã xảy ra |
|---|---|
| Đặt lệnh | Gửi yêu cầu mua/bán |
| Khớp lệnh | Giao dịch được xác lập, phát sinh nghĩa vụ |
| Thanh toán | Thực hiện nghĩa vụ tiền và chứng khoán |

Ví dụ mua 40 cổ phiếu tại 24.900:

```text
Nghĩa vụ tiền:        Trả 996.000 đồng.
Nghĩa vụ chứng khoán: Nhận 40 cổ phiếu.
```

Không đợi đến ngày thanh toán mới ghi nhận giao dịch đã khớp. Ngày 10–11 đã phản ánh nó bằng:

```text
buyPayable += 996.000
pendingBuyQuantity += 40
```

### 2.2. Bối cảnh thực tế và mô hình bài học

VSDC mô tả thanh toán cổ phiếu, chứng chỉ quỹ và chứng quyền có bảo đảm theo chu kỳ T+2, đồng thời thực hiện thanh toán theo kết quả bù trừ đa phương. [vsdc.vn](https://vsdc.vn/vi/sd/XAz40d2Q-9j569TvBgLQaQ?utm_source=chatgpt.com)

Trong simulator:

- Dùng chu kỳ **hai ngày làm việc** để thực hành.
- Xử lý nghĩa vụ riêng theo execution và tài khoản.
- Chọn giờ đến hạn giả lập bằng cấu hình.
- Chưa triển khai bù trừ đa phương hoặc kết nối VSDC.
- Một transaction MySQL chỉ bảo đảm cập nhật nội bộ của demo.

Không coi việc hai hàng dữ liệu cùng commit là đã mô phỏng đầy đủ cơ chế thanh toán ngoài thị trường.

### 2.3. Ngày giao dịch khác ngày đến hạn

```text
tradeDate:       Ngày giao dịch.
settlementDate:  Ngày thanh toán dự kiến.
dueAt:           Thời điểm được phép xử lý trong demo.
```

T+2 không đơn giản là:

```ts
tradeDate + 48 giờ
```

Phải đi qua lịch ngày làm việc.

Ví dụ lịch giả lập:

```text
Ngày giao dịch: Thứ Sáu, 23/10/2026.
Thứ Bảy, Chủ nhật: nghỉ.
Thứ Hai, 26/10: ngày nghỉ giả lập.
```

Kết quả:

```text
T+1: Thứ Ba, 27/10.
T+2: Thứ Tư, 28/10.
```

Ngày nghỉ trên chỉ là fixture. VSDC cũng công bố lịch xử lý thanh toán riêng trong các kỳ nghỉ; vì vậy lịch không thể chỉ dựa vào việc cộng ngày hoặc giả định mọi ngày đi làm đều là ngày thanh toán. [vsdc.vn](https://vsdc.vn/vi/ad/198931?utm_source=chatgpt.com)

---

## 3. Khi thanh toán, tài sản thay đổi thế nào?

### 3.1. BUY — trả tiền và nhận chứng khoán

Trước thanh toán:

```text
settledCash = 10.000.000
buyPayable = 996.000

settledQuantity = 0
pendingBuyQuantity = 40
```

Sau thanh toán:

```text
settledCash = 9.004.000
buyPayable = 0

settledQuantity = 40
pendingBuyQuantity = 0
```

Bảng đối chiếu:

| Thành phần | Trước | Sau |
|---|---:|---:|
| Tiền khả dụng | 9.004.000 | 9.004.000 |
| Vị thế kinh tế | 40 | 40 |
| Chứng khoán có thể bán | 0 | 40 |
| Tổng giá vốn | 996.000 | 996.000 |

Giả định không có khoản giữ hoặc phong tỏa khác.

**Thanh toán BUY không trừ tiền khả dụng lần hai và không tăng vị thế kinh tế lần hai.**

### 3.2. SELL — giao chứng khoán và nhận tiền

Ví dụ độc lập: đã bán 50 cổ phiếu tại 27.000.

Trước thanh toán:

```text
settledQuantity = 200
pendingSellQuantity = 50
pendingReceivable = 1.350.000
```

Sau thanh toán:

```text
settledQuantity = 150
pendingSellQuantity = 0
pendingReceivable = 0

settledCash tăng 1.350.000
```

Vị thế kinh tế trước và sau đều là 150.

Lãi/lỗ đã thực hiện đã được tính lúc bán ở ngày 11, không tính thêm lần nữa lúc nhận tiền.

---

## 4. Thiết kế nghĩa vụ thanh toán

### 4.1. Một execution tạo một nghĩa vụ cho mỗi phía tài khoản

Trong bài BUY:

```text
Execution
→ Nghĩa vụ trả tiền và nhận chứng khoán của tài khoản mua.
```

Một obligation chứa cả hai phần để xử lý cùng nhau trong demo.

Các trường chính:

| Trường | Ý nghĩa |
|---|---|
| `accountId` | Tài khoản có nghĩa vụ |
| `orderId` | Lệnh liên quan |
| `executionId` | Lần khớp tạo nghĩa vụ |
| `side` | BUY hoặc SELL |
| `quantity` | Khối lượng phải thanh toán |
| `amount` | Giá trị tiền |
| `tradeDate` | Ngày giao dịch |
| `settlementDate` | Ngày đến hạn |
| `dueAt` | Thời điểm đến hạn |
| `calendarVersion` | Phiên bản lịch đã dùng |
| `status` | PENDING hoặc SETTLED |

### 4.2. Nghĩa vụ tạo lúc nào?

Mở rộng transaction xử lý execution ngày 11:

```text
Cập nhật OMS
+ Cập nhật tiền
+ Cập nhật vị thế
+ Ghi các lịch sử
+ Tạo settlement obligation
→ Cùng commit
```

Nếu cập nhật tiền và vị thế thành công nhưng không tạo nghĩa vụ, giao dịch có thể bị bỏ quên khi đến hạn.

Không tạo nghĩa vụ khi:

- Chỉ nhận lệnh.
- Chỉ chấp nhận lệnh.
- Người dùng yêu cầu hủy.
- Lệnh bị từ chối mà chưa khớp.

**Lệnh `CANCELED` vẫn có thể có nghĩa vụ** nếu đã khớp một phần trước khi hủy.

### 4.3. Tính và lưu ngày đến hạn một lần

Tính từ:

```text
tradeDate + settlement cycle + calendar version + giờ xử lý demo
```

Sau đó lưu `settlementDate` và `dueAt`.

Không tính lại tự động mỗi lần chạy batch bằng lịch mới rồi làm nghĩa vụ cũ thay đổi âm thầm.

Nếu cần điều chỉnh lịch đã áp dụng, đó phải là một thao tác có lịch sử riêng; chưa triển khai hôm nay.

---

## 5. Database MySQL

### 5.1. Bảng nghĩa vụ

```sql
CREATE TABLE settlement_obligations (
    id VARCHAR(36) NOT NULL,
    account_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36) NOT NULL,
    execution_id VARCHAR(64) NOT NULL,
    security_id VARCHAR(36) NOT NULL,

    side ENUM('BUY', 'SELL') NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    amount DECIMAL(20,0) NOT NULL,

    trade_date DATE NOT NULL,
    settlement_date DATE NOT NULL,
    due_at TIMESTAMP(3) NOT NULL,
    calendar_version VARCHAR(32) NOT NULL,

    status ENUM('PENDING', 'SETTLED') NOT NULL,
    settled_at TIMESTAMP(3) NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_settlement_execution (
        account_id,
        order_id,
        execution_id
    ),

    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (security_id) REFERENCES securities(id),

    CONSTRAINT chk_settlement_values CHECK (
        quantity > 0 AND amount > 0
    ),

    INDEX idx_settlement_due (
        status,
        due_at
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Service phải bảo đảm account, security và execution khớp đúng với order.

### 5.2. Theo dõi lần chạy

| Bảng | Nội dung |
|---|---|
| `settlement_runs` | ID lần chạy, thời điểm đánh giá, trạng thái, số thành công/thất bại |
| `settlement_run_items` | Nghĩa vụ nào đã được xét và kết quả |
| `reconciliation_breaks` | Các chênh lệch được phát hiện khi đối soát |

Một run có thể xử lý nhiều nghĩa vụ. Mỗi nghĩa vụ có transaction riêng để một lỗi không rollback mọi nghĩa vụ khác.

### 5.3. Mở rộng lịch sử hiện có

Bổ sung loại entry vào cash ledger:

```text
SETTLEMENT_BUY
SETTLEMENT_SELL
```

Ví dụ BUY:

```text
deltaSettledCash = −996.000
deltaBuyPayable  = −996.000
```

Position movement cần thể hiện cả chuyển trạng thái số lượng:

```text
deltaSettledQuantity    = +40
deltaPendingBuyQuantity = −40
deltaEconomicQuantity  = 0
deltaTotalCost         = 0
deltaRealizedPnl       = 0
```

Có thể bổ sung các cột delta lượng chi tiết vào `position_movements`, cùng loại `SETTLEMENT`.

Không chỉ ghi một movement toàn số 0 mà thiếu thông tin chuyển từ chờ nhận sang đã thanh toán.

---

## 6. Lịch và Clock giả lập

Đề xuất cấu hình:

```ts
const settlementPolicy = {
  cycleBusinessDays: 2,
  timeZone: "Asia/Ho_Chi_Minh",
  settlementTime: "13:00:00",
  calendarVersion: "SIM_CAL_V1",

  workingWeekdays: [1, 2, 3, 4, 5],
  holidays: ["2026-10-26"]
};
```

13:00 là giờ xử lý **do simulator chọn**, không đại diện cho lịch vận hành thực tế.

Với trade date `2026-10-23`:

```text
settlementDate = 2026-10-28
dueAt = 2026-10-28T06:00:00Z
```

Kiểm thử:

| Clock | Được thanh toán? |
|---|---|
| 28/10, 12:59:59.999 giờ Việt Nam | Chưa |
| 28/10, 13:00:00.000 | Có |
| 29/10, nghĩa vụ vẫn PENDING | Có, xử lý khoản đến hạn quá hạn |

Batch phải xét:

```text
status = PENDING
AND dueAt <= evaluatedAt
```

Không chỉ lấy nghĩa vụ có ngày đúng bằng hôm nay, vì như vậy có thể bỏ sót khoản chưa xử lý từ ngày trước.

---

## 7. Transaction thanh toán và chạy lại an toàn

### 7.1. Luồng một nghĩa vụ BUY

Đọc thông tin định danh trước, sau đó trong transaction:

```text
BEGIN
→ Khóa cash_balances
→ Khóa position
→ Khóa settlement_obligation
→ Đọc lại status và dueAt
→ Nếu đã SETTLED: không hạch toán lại
→ Kiểm tra đủ các khoản chờ tương ứng
→ Giảm settledCash và buyPayable
→ Chuyển pendingBuyQuantity sang settledQuantity
→ Ghi cash ledger
→ Ghi position movement
→ Đánh dấu obligation SETTLED
→ Ghi run item thành công
COMMIT
```

MySQL yêu cầu locking read nằm trong transaction; `SELECT ... FOR UPDATE` là công cụ phù hợp để đọc hàng trước khi cập nhật có bảo vệ. [dev.mysql.com](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html?trk=article-ssr-frontend-pulse_little-text-block\&utm_source=chatgpt.com)

Giữ thứ tự khóa nhất quán với các service hiện có. Không gọi network trong transaction.

### 7.2. Hai lớp bảo vệ chống trùng

1. Khóa obligation và kiểm tra trạng thái.
2. Business key duy nhất cho các bản ghi lịch sử:

```text
SETTLEMENT:<obligationId>
```

Hai worker có thể cùng nhìn thấy một nghĩa vụ khi quét danh sách. Sau khi khóa và đọc lại, chỉ một worker được hạch toán.

**Không dùng `runId` làm khóa chống thanh toán trùng.** Chạy lại tạo run mới nhưng vẫn là cùng nghĩa vụ.

### 7.3. Nếu có lỗi giữa chừng

Ví dụ ghi position movement thất bại:

```text
Rollback tiền.
Rollback chứng khoán.
Không đánh dấu SETTLED.
```

Sau rollback, ghi lỗi của run item bằng thao tác riêng. Nghĩa vụ còn `PENDING` để có thể xử lý lại.

Không đánh dấu `SETTLED` trước rồi mới cập nhật tài sản.

Nếu kết quả commit chưa xác định do mất kết nối, đọc lại obligation để xác định kết quả trước khi kết luận thất bại.

---

## 8. Bài thực hành chính

Dùng tài khoản mới `acc-006`, không sửa fixture các ngày trước.

**Bước 1 — Khởi tạo**

```text
Tiền đầu kỳ: 10 triệu.
Có OPENING cash ledger.
Chứng khoán ban đầu: 0.
Ngày giao dịch: 23/10/2026, 10:00 Việt Nam.
```

**Bước 2 — Tạo giao dịch**

```text
BUY 100, LO 25.000.
Khớp 40 tại 24.900.
Xác nhận hủy 60 còn lại.
```

Kết quả trước thanh toán:

```text
Order: CANCELED, filled40, canceled60.

settledCash = 10.000.000
reservedCash = 0
buyPayable = 996.000
availableCash = 9.004.000

pendingBuyQuantity = 40
settledQuantity = 0
totalCost = 996.000
```

Có đúng một obligation:

```text
quantity = 40
amount = 996.000
dueAt = 28/10/2026, 13:00 Việt Nam
status = PENDING
```

**Bước 3 — Chạy trước hạn**

Chuyển Clock đến 12:59:59 ngày 28/10.

Kỳ vọng: chưa có nghĩa vụ được thanh toán.

**Bước 4 — Chạy đúng hạn**

Chuyển Clock đến 13:00.

Kỳ vọng:

```text
settledCash = 9.004.000
buyPayable = 0

settledQuantity = 40
pendingBuyQuantity = 0
availableQuantity = 40

totalCost = 996.000
obligation = SETTLED
```

**Bước 5 — Chạy lại**

Kỳ vọng:

```text
Không thay đổi tài sản.
Không thêm ledger hoặc movement thanh toán.
Không tăng chứng khoán lên 80.
```

Run mới có thể có 0 nghĩa vụ cần xử lý; đó là kết quả đúng.

---

## 9. API demo

| API | Chức năng |
|---|---|
| `GET /api/accounts/:id/settlement-obligations` | Xem nghĩa vụ |
| `POST /api/settlement-runs` | Chạy xử lý theo Clock server |
| `GET /api/settlement-runs/:id` | Xem kết quả |
| `GET /api/accounts/:id/cash-ledger` | Đối chiếu tiền |
| `GET /api/accounts/:id/positions` | Kiểm tra chứng khoán |

Ví dụ response run:

```json
{
  "data": {
    "runId": "run-001",
    "evaluatedAt": "2026-10-28T06:00:00Z",
    "status": "COMPLETED",
    "settledCount": 1,
    "failedCount": 0
  }
}
```

Không cho client truyền tùy ý “ngày hôm nay” để vượt điều kiện đến hạn. Dùng Clock được cấu hình ở backend.

Các API chạy batch tiếp tục chỉ dành cho môi trường demo/local.

---

## 10. Đối soát — so sánh với nguồn độc lập

Đối soát không phải chỉ đọc lại cùng một bảng rồi kết luận đúng.

Có hai loại kiểm tra:

| Loại | Ví dụ |
|---|---|
| Đối chiếu nội bộ | Cash ledger cộng lại khớp cash balance |
| Đối soát nguồn độc lập | Nghĩa vụ nội bộ khớp báo cáo kết quả giả lập bên ngoài |

Hôm nay dùng một fixture báo cáo được chuẩn bị trước, không sinh trực tiếp từ kết quả query đang cần kiểm tra.

Ví dụ:

```json
{
  "reportId": "external-sim-report-001",
  "items": [
    {
      "accountId": "acc-006",
      "orderId": "ord-day13-001",
      "executionId": "exe-day13-001",
      "securityId": "sec-001",
      "side": "BUY",
      "quantity": 40,
      "amount": "996000",
      "settlementDate": "2026-10-28",
      "status": "SETTLED"
    }
  ]
}
```

Thay ID bằng ID fixture thực tế của bài.

So sánh:

- Thiếu giao dịch ở một phía.
- Khác số lượng.
- Khác tiền.
- Khác ngày thanh toán.
- Khác trạng thái.
- Trùng dòng báo cáo.

Nếu sửa quantity báo cáo thành 39, tạo break:

```json
{
  "type": "QUANTITY_MISMATCH",
  "expected": 40,
  "actual": 39,
  "status": "OPEN"
}
```

**Không tự sửa số dư để khớp báo cáo.** Break cần được điều tra; sửa dữ liệu là nghiệp vụ khác.

Import lại cùng report không được tạo vô hạn các break giống hệt nhau.

---

## 11. Kiểm thử và debug

| Kiểm thử | Kết quả |
|---|---|
| T+2 qua cuối tuần | Bỏ qua thứ Bảy, Chủ nhật |
| Có ngày nghỉ cấu hình | Ngày đến hạn dịch đúng |
| Chưa đến `dueAt` | Không thanh toán |
| Nghĩa vụ quá hạn còn pending | Vẫn được xử lý |
| Lệnh canceled nhưng đã khớp | Phần đã khớp vẫn thanh toán |
| BUY settlement | Available cash không giảm thêm |
| Chuyển chứng khoán chờ nhận | Economic quantity và totalCost không đổi |
| Chạy lại batch | Không ghi nhận lần hai |
| Hai lần chạy đồng thời | Một lần hạch toán cho mỗi nghĩa vụ |
| Lỗi sau cập nhật tiền | Toàn transaction rollback |
| Báo cáo sai một đơn vị | Có reconciliation break |
| Import lại report | Không tạo break trùng vô hạn |

**Debug A — Thanh toán trừ tiền lần hai**

Code giảm `settledCash` nhưng quên giảm `buyPayable`.

Khả dụng bị giảm thêm 996.000 sai.

**Debug B — Nhận cổ phiếu làm danh mục tăng gấp đôi**

Code tăng `settledQuantity` nhưng không giảm `pendingBuyQuantity`.

Vị thế kinh tế sai từ 40 thành 80.

**Debug C — Lệnh hủy không được thanh toán**

Batch lọc:

```text
order.status = FILLED
```

Nó bỏ sót lệnh khớp một phần rồi hủy. Batch phải xử lý theo obligation, không suy từ trạng thái cuối của order.

**Debug D — Ngày đến hạn rơi vào ngày nghỉ**

Code cộng hai ngày lịch hoặc dùng timezone máy chủ. Kiểm tra lần lượt trade date, calendar version, timezone và `dueAt` đã lưu.

---

## 12. Prompt cho OpenCode

```text
Tôi đang học ngày 13 của Securities Trading Simulator:
Thanh toán và đối soát.

Môi trường:
- Node.js + TypeScript, MySQL.
- OpenCode, cấu hình model hiện tại.
- Giữ kiến trúc và transaction ngày 1–12.

Trước khi code:
1. Đọc execution handler, OMS, cash ledger, positions,
   position movements và Clock.
2. Xác định transaction hiện tại cập nhật tiền/chứng khoán.
3. Đề xuất phạm vi 30–60 phút.
4. Ưu tiên BUY settlement; SELL là fixture/mở rộng.

Phạm vi:
- Nghĩa vụ theo execution/account trong simulator.
- Không mô phỏng bù trừ đa phương hoặc kết nối VSDC.
- Không gọi network trong transaction.
- Chưa triển khai sửa lịch nghĩa vụ cũ tự động.

Policy:
- Cycle2 business days.
- Timezone Asia/Ho_Chi_Minh.
- Giờ đến hạn giả lập 13:00.
- Calendar SIM_CAL_V1, thứ Hai–thứ Sáu.
- Ngày nghỉ giả lập 2026-10-26.
- TradeDate2026-10-23 → settlementDate2026-10-28.
- dueAt=2026-10-28T06:00:00Z.
- Lưu ngày/giờ và calendar version khi tạo obligation.
- Không tính lại bằng config mới mỗi lần chạy batch.

Database:
- settlement_obligations theo schema bài.
- settlement_runs.
- settlement_run_items.
- reconciliation_breaks.
- Unique obligation theo account/order/execution.
- Bổ sung cash ledger types SETTLEMENT_BUY/SETTLEMENT_SELL.
- Position movement thể hiện delta settled/pending;
  settlement có delta economicQuantity, cost, realizedPnL bằng0.
- Không giả tạo lịch sử cho dữ liệu cũ.

Tạo obligation:
- Trong cùng execution transaction với OMS, tiền, vị thế và lịch sử.
- Chỉ tạo cho phần đã khớp.
- Order canceled sau partial vẫn có obligation.
- Dùng fixture mới, không replay execution cũ làm hạch toán lại.

Batch:
- Lấy PENDING có dueAt<=Clock.now().
- Mỗi obligation một transaction.
- Khóa cash balance, position, obligation theo thứ tự thống nhất.
- Đọc lại trạng thái sau khi khóa.
- SETTLED thì không hạch toán lại.
- Business key SETTLEMENT:<obligationId> cho ledger/movement.
- Update tài sản, ghi lịch sử, mark SETTLED,
  ghi run item thành công cùng transaction.
- Lỗi thì rollback; ghi run item lỗi sau rollback.
- Không đánh dấu settled trước khi cập nhật tài sản.
- Không dùng runId để chống thanh toán trùng.
- Kết quả commit không rõ thì đọc lại obligation.

BUY:
settledCash -= amount.
buyPayable -= amount.
settledQuantity += quantity.
pendingBuyQuantity -= quantity.
Không đổi totalCost hoặc realizedPnl.
Không đụng vào reservation đã đóng.
Validate các thành phần chờ đủ, không để âm.

SELL fixture/mở rộng:
settledCash += amount.
pendingReceivable -= amount.
settledQuantity -= quantity.
pendingSellQuantity -= quantity.
Không tính P&L bán lần nữa.

Fixture acc-006 mới:
- Tiền đầu kỳ10tr và OPENING ledger.
- Vị thế ban đầu0.
- Clock23/10/2026 10:00 VN.
- BUY100 LO25000.
- Khớp40@24900 rồi xác nhận hủy60.
- Trước settlement:
  settledCash10000000, reserved0, payable996000,
  available9004000, pendingBuy40, settledQty0,
  totalCost996000.
- Một obligation40/996000 đến hạn28/10 13:00.

Kiểm thử:
- Trước hạn không xử lý.
- Đúng hạn:
  settledCash9004000, payable0,
  settledQty40, pendingBuy0, availableQty40.
- EconomicQty và totalCost không đổi.
- Chạy lại không thêm ledger/movement hoặc đổi balance.
- Hai runner cùng xử lý vẫn chỉ hạch toán một lần.
- Movement lỗi rollback cả tiền.
- Nghĩa vụ quá hạn vẫn được lấy.
- Order canceled vẫn thanh toán phần đã khớp.

API local/demo:
- GET /api/accounts/:id/settlement-obligations.
- POST /api/settlement-runs, thời gian lấy từ Clock server.
- GET /api/settlement-runs/:id.

Đối soát:
- Fixture report độc lập, không generate từ query nội bộ cần kiểm tra.
- So account/order/execution/security/side/qty/amount/date/status.
- Phát hiện missing, extra, duplicate, mismatched.
- Report quantity39 thay vì40 tạo QUANTITY_MISMATCH.
- Import cùng report không tạo break trùng vô hạn.
- Không tự sửa số dư khi có break.

Sau khi làm:
- Chạy kiểm tra phù hợp, báo kết quả thực tế.
- Cập nhật README về lịch, batch, restart và giới hạn.
- Giải thích vì sao BUY settlement không giảm available cash lần hai.
```

**Ngày 13 hoàn thành khi:**

- [ ] Execution tạo nghĩa vụ cùng transaction.
- [ ] Tính đúng ngày đến hạn theo lịch và timezone.
- [ ] Thanh toán chuyển đúng các khoản chờ sang đã thanh toán.
- [ ] Giá vốn và vị thế kinh tế không bị ghi nhận lần hai.
- [ ] Chạy lại hoặc chạy đồng thời không thanh toán trùng.
- [ ] Đối soát phát hiện được khác biệt mà không tự sửa tài sản.

Ngày 14 sẽ ghép **OMS, giữ tiền, khớp một phần, hủy và thanh toán** thành sản phẩm tuần 2, có một kịch bản đối chiếu tài sản xuyên suốt.
