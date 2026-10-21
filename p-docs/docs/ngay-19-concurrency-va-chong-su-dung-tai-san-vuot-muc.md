# Ngày 19 — Concurrency và chống sử dụng tài sản vượt mức

Ngày 10 đã đặt lệnh và giữ tiền trong cùng transaction. Hôm nay bạn kiểm chứng một điều quan trọng hơn:

> “Nếu hai yêu cầu cùng đến, mỗi yêu cầu đều thấy đủ tiền, hệ thống có vô tình chấp nhận cả hai không?”

Bạn sẽ dùng **MySQL thật với nhiều connection**, tái hiện lỗi đọc dữ liệu cũ và kiểm tra các cơ chế bảo vệ.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Hai lệnh tranh tiền, khớp và hủy cạnh tranh | Hiểu bất biến phải giữ |
| 30 phút kỹ thuật | Row lock, conditional update, optimistic locking | Chọn đúng cơ chế |
| 30–60 phút thực hành | Kiểm thử nhiều connection và lỗi transaction | Có bằng chứng không vượt khả dụng |

**Sản phẩm cuối buổi:**

- Hai lệnh cùng cần 7 triệu trong tài khoản 10 triệu: chỉ một được giữ tiền.
- Số tổng, chi tiết khoản giữ và ledger cùng khớp nhau.
- Deadlock hoặc lock timeout được xử lý rõ ràng.
- Không cho xác nhận hủy giải phóng tiền dựa trên trạng thái cũ.

Nếu code ngày 10 đã dùng khóa đúng, hôm nay ưu tiên **kiểm chứng**, không viết lại chỉ để đổi cách triển khai.

---

## 2. Nghiệp vụ — 30 phút

### 2.1. Hai yêu cầu đều thấy đủ tiền

Tài khoản:

```text
settledCash = 10.000.000
reservedCash = 0
buyPayable = 0
blockedCash = 0
```

Hai ý định mua khác nhau:

```text
A: Mua 280 cổ phiếu tại 25.000 → cần 7 triệu.
B: Mua 280 cổ phiếu tại 25.000 → cần 7 triệu.
```

Nếu cùng đọc trước khi bên nào ghi:

| Thời điểm | Request A | Request B |
|---|---|---|
| 1 | Đọc khả dụng 10 triệu | |
| 2 | | Đọc khả dụng 10 triệu |
| 3 | Kết luận đủ tiền | |
| 4 | | Kết luận đủ tiền |
| 5 | Giữ 7 triệu | |
| 6 | | Giữ thêm 7 triệu |

Tổng tiền cam kết có thể thành 14 triệu.

**Kiểm tra đủ tiền và giữ tiền phải được bảo vệ như một thao tác nghiệp vụ thống nhất.**

### 2.2. Không âm chưa đủ để chứng minh đúng

Một lỗi khác:

```text
A đọc reserved=0.
B đọc reserved=0.

A ghi reserved=7 triệu.
B cũng ghi reserved=7 triệu.
```

Kết quả có thể là:

```text
cash_balances.reservedCash = 7 triệu.

Nhưng:
reservation A = 7 triệu.
reservation B = 7 triệu.
Tổng chi tiết = 14 triệu.
```

Số dư không âm nhưng dữ liệu vẫn sai.

Bất biến cần kiểm tra:

```text
reservedCash
= tổng remainingAmount của các khoản giữ liên quan
```

và:

```text
Số dư hiện tại
= số dư đầu kỳ + tổng biến động ledger
```

### 2.3. Idempotency không thay thế concurrency control

| Tình huống | Cơ chế chính |
|---|---|
| Gửi lại cùng ý định | Idempotency |
| Hai ý định khác nhau tranh cùng tiền | Bảo vệ tài nguyên trong transaction |
| Cùng execution được giao lại | Business dedup / consumer dedup |

Trong bài hôm nay, A và B phải dùng **hai Idempotency-Key khác nhau**. Nếu dùng cùng khóa, bạn đang kiểm tra chống trùng, chưa kiểm tra cạnh tranh tài sản.

---

## 3. Transaction tự nó có giải quyết không?

Không mặc định như vậy.

MySQL nêu rõ rằng một `SELECT` thông thường chưa đủ bảo vệ chuỗi đọc rồi cập nhật dữ liệu liên quan trong cùng transaction. [dev.mysql.com](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html?utm_source=chatgpt.com)

Ví dụ vẫn có vấn đề:

```text
BEGIN
SELECT số dư không khóa
Kiểm tra đủ tiền
UPDATE dựa trên giá trị cũ
COMMIT
```

MySQL InnoDB mặc định dùng `REPEATABLE READ`, nhưng mức cô lập không thay thế việc thiết kế điều kiện cập nhật và khóa phù hợp. [dev.mysql.com](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html?utm_source=chatgpt.com)

Hôm nay giữ cấu hình hiện có, ghi nhận rõ isolation level đang dùng và kiểm thử trên chính cấu hình đó.

---

## 4. So sánh ba chiến lược

| Cách | Cơ chế | Phù hợp trong bài |
|---|---|---|
| Row lock | Khóa hàng, đọc hiện trạng rồi cập nhật | Lựa chọn chính |
| Conditional update | Chỉ cập nhật nếu điều kiện còn đúng | Phương án thay thế gọn |
| Optimistic locking | Cập nhật khi version chưa đổi | Phù hợp khi kiểm soát được retry |

Không cần kết hợp cả ba vào mọi thao tác.

### 4.1. Row lock — tiếp tục cách ngày 10

```sql
SELECT
    settled_cash,
    reserved_cash,
    buy_payable,
    blocked_cash
FROM cash_balances
WHERE account_id = ?
FOR UPDATE;
```

Sau khi có khóa mới tính:

```text
available
= settled − reserved − payable − blocked
```

Nếu đủ, thực hiện các thay đổi và commit.

Khi A giữ khóa, B phải chờ. Sau khi A commit, B đọc dữ liệu hiện tại:

```text
Khả dụng còn 3 triệu.
B cần 7 triệu.
→ B bị từ chối.
```

Khóa phải được lấy trong transaction và dùng cùng connection với các cập nhật sau đó.

### 4.2. Conditional update — một phương án khác

```sql
UPDATE cash_balances
SET reserved_cash = reserved_cash + ?
WHERE account_id = ?
  AND settled_cash
      - reserved_cash
      - buy_payable
      - blocked_cash >= ?;
```

Hai tham số tiền đều là `requiredCash`.

Kiểm tra:

```text
affectedRows = 1 → đã giữ được tiền.
affectedRows = 0 → điều kiện không đạt hoặc thiếu hàng dữ liệu.
```

Phải phân biệt trường hợp thiếu `cash_balances` với không đủ tiền; không mặc định cả hai là cùng lỗi.

Order, reservation, ledger và kết quả idempotency vẫn cần cùng transaction. Nếu bước sau thất bại, cập nhật số dư phải rollback.

Nếu đang dùng row lock đúng, không thêm một thao tác giữ tiền thứ hai theo cách này.

### 4.3. Optimistic locking

Ví dụ với order:

```sql
UPDATE orders
SET
    filled_quantity = ?,
    remaining_quantity = ?,
    status = ?,
    version = version + 1
WHERE id = ?
  AND version = ?;
```

Nếu `affectedRows = 0`, dữ liệu có thể đã thay đổi.

Không ghi đè bằng dữ liệu cũ. Cần đọc lại và đánh giá lại nghiệp vụ.

Optimistic locking không có nghĩa mọi xung đột đều được retry thành công. Sau khi đọc lại, lệnh có thể đã hết lượng hoặc không còn được hủy.

---

## 5. Giữ phạm vi khóa ngắn và nhất quán

Tiếp tục quy ước từ các bài trước:

```text
Idempotency của request
→ Cash balance
→ Order
→ Cash reservation
→ Position
→ Nghĩa vụ thanh toán nếu cần
```

Không phải thao tác nào cũng khóa tất cả các hàng. Nhưng những hàng có dùng phải theo thứ tự đã thống nhất.

Nếu cần khóa nhiều tài khoản hoặc nhiều vị thế:

```text
Sắp xếp theo khóa định danh trước khi khóa.
```

Ví dụ vị thế theo:

```text
accountId, securityId
```

Trong lúc đang giữ khóa, không:

- Gọi matching hoặc broker qua network.
- Chờ phản hồi từ frontend.
- Gọi API giá.
- Render báo cáo lớn.
- Chờ timer để mô phỏng độ trễ.

Các hook trì hoãn chỉ dùng trong kiểm thử để kiểm soát lịch chạy.

Index cũng ảnh hưởng phạm vi quét và khóa. Ưu tiên truy vấn số dư bằng khóa chính `account_id`, vị thế bằng `(account_id, security_id)`.

---

## 6. Deadlock và lock timeout

### 6.1. Ví dụ deadlock

```text
A giữ cash balance, chờ order.
B giữ order, chờ cash balance.
```

Giữ thứ tự khóa nhất quán giúp giảm tình huống này, nhưng ứng dụng vẫn cần xử lý deadlock. MySQL khuyến nghị transaction ngắn, thứ tự thao tác nhất quán và chuẩn bị chạy lại transaction khi bị rollback do deadlock. [dev.mysql.com](https://dev.mysql.com/doc/refman/8.4/en/innodb-deadlocks-handling.html?utm_source=chatgpt.com)

### 6.2. Phân biệt cách rollback

MySQL có thể rollback toàn transaction khi deadlock, nhưng lock wait timeout mặc định có thể chỉ rollback statement đang chờ. [dev.mysql.com](https://dev.mysql.com/doc/refman/8.4/en/innodb-error-handling.html?utm_source=chatgpt.com)

Chính sách ứng dụng trong bài:

```text
Gặp lỗi khóa có thể retry
→ Chủ động rollback toàn transaction còn mở
→ Retry toàn thao tác bằng transaction mới
```

Không retry riêng câu `UPDATE` cuối trong một luồng đã cập nhật dở.

### 6.3. Chính sách retry giả lập

```text
Tối đa 3 lần.
Backoff ngắn có jitter.
Giữ nguyên Idempotency-Key.
```

| Lỗi | Retry tự động? |
|---|---|
| Deadlock | Có giới hạn |
| Lock timeout | Có giới hạn sau rollback toàn transaction |
| Không đủ tiền | Không |
| Không còn quyền | Không |
| Payload sai | Không |
| Cùng key khác payload | Không |

Nếu hết số lần thử do tranh chấp tạm thời, trả lỗi như:

```text
503 TEMPORARY_CONTENTION
```

Không đổi thành `INSUFFICIENT_CASH` nếu chưa thực sự xác định thiếu tiền.

Nếu mất kết nối ở thời điểm commit và chưa biết kết quả, dùng cơ chế idempotency để xác định lại; không tự kết luận transaction chắc chắn rollback.

---

## 7. Bài thực hành chính — hai lệnh tranh tiền

### 7.1. Fixture

Tạo tài khoản mới:

```text
acc-019
settledCash = 10.000.000
reservedCash = 0
buyPayable = 0
blockedCash = 0
```

Có OPENING ledger và membership TRADE cho người dùng kiểm thử.

Đảm bảo không có thanh khoản bán làm các lệnh mua khớp ngay, để bài kiểm tra tập trung vào khoản giữ.

Hai request:

```text
A: BUY280 @25000, key=day19-A.
B: BUY280 @25000, key=day19-B.
```

### 7.2. Kết quả mong đợi

Không bắt buộc A phải thắng. B có thể thắng trước.

| Thành phần | Kết quả |
|---|---:|
| Request được chấp nhận | 1 |
| Request bị từ chối vì thiếu tiền | 1 |
| Tổng tiền giữ | 7.000.000 |
| Tiền khả dụng | 3.000.000 |
| Số khoản giữ mới | 1 |
| Tổng delta RESERVE | 7.000.000 |

Request thất bại không để lại order hoặc reservation dở dang, theo chính sách rollback đã dùng ở ngày 9–10.

Audit từ chối có thể được ghi riêng.

### 7.3. Kiểm thử phải có nhiều connection

`Promise.all()` chỉ là điểm khởi đầu. Nếu mọi truy vấn dùng cùng một connection thì chúng vẫn có thể chạy nối tiếp.

Cần:

- MySQL InnoDB thật.
- Ít nhất hai connection độc lập.
- Test hook/latch để kiểm soát điểm giao nhau.
- Timeout hữu hạn để tránh test treo.

Ví dụ:

```text
A lấy khóa số dư.
A dừng tại latch kiểm thử.

B bắt đầu truy vấn khóa cùng số dư.

Cho A tiếp tục và commit.
B tiếp tục, đọc số dư mới rồi từ chối.
```

Không thiết kế barrier yêu cầu cả A và B đều lấy được cùng khóa trước khi thả A; điều đó khiến test tự chờ vô hạn.

---

## 8. Tái hiện lỗi trước khi sửa

Trong một test harness riêng, mô phỏng cách sai:

```text
A và B cùng SELECT không khóa.
Cả hai đọc reserved=0.
Cả hai kết luận đủ tiền.
Cả hai ghi giá trị tuyệt đối reserved=7 triệu.
Cả hai tạo reservation7 triệu.
```

Kiểm thử phải phát hiện ít nhất:

```text
SUM(reservation.remainingAmount) != reservedCash
```

hoặc:

```text
SUM(ledger.deltaReservedCash) != reservedCash
```

Không đưa mã lỗi có chủ đích vào đường chạy thông thường.

Sau đó chạy cùng tình huống với service thật đã bảo vệ bằng row lock. Bằng chứng cần có là **test phát hiện bản lỗi và đạt với bản sửa**.

---

## 9. Khớp thêm và xác nhận hủy cạnh tranh

Bắt đầu từ:

```text
BUY100 @25000.
Đã khớp40 @24900.
Còn60.
Đang chờ hủy.
```

Sau đó có thêm execution20 @25000 và xác nhận hủy40.

Kết quả đúng:

```text
filledQuantity = 60
canceledQuantity = 40
remainingQuantity = 0

buyPayable = 1.496.000
reservedCash = 0
availableCash = 8.504.000
```

### 9.1. Row lock giải quyết điều gì?

Nó ngăn hai transaction cập nhật cùng order và khoản giữ bằng trạng thái cũ rồi ghi đè nhau.

Execution handler phải:

```text
Khóa
→ Đọc lại trạng thái
→ Kiểm tra dedup
→ Áp dụng execution
```

Cancel confirmation handler cũng phải đọc lại sau khi có khóa.

### 9.2. Row lock không tự sắp xếp bản tin nguồn

Nếu xác nhận hủy đến trước execution đã xảy ra, chỉ khóa hàng chưa đủ để hiểu đúng thứ tự thị trường.

Trong simulator, duy trì phản hồi đúng thứ tự của cùng lệnh. Bổ sung dữ liệu xác nhận hủy:

```json
{
  "orderId": "ord-001",
  "cumulativeFilledQuantity": 60,
  "canceledQuantity": 40
}
```

Nếu OMS mới biết khớp40:

```text
ACK báo khớp60 nhưng OMS mới40.
→ Chưa áp dụng xác nhận hủy.
→ Giữ nguyên khoản giữ.
→ Xử lý execution còn thiếu rồi đánh giá lại ACK.
```

Không tự “bù” 20 cổ phiếu bằng cách sửa `filledQuantity`, vì còn thiếu giá khớp, tiền, giá vốn và nghĩa vụ thanh toán.

Nếu không thể phục hồi sau số lần chờ giới hạn, đưa vào trạng thái cần điều tra; không giải phóng tiền bằng cách đoán.

---

## 10. Bài mở rộng — hai lệnh bán tranh một vị thế

Dùng fixture riêng:

```text
settledQuantity = 100.
pendingSell = 0.
blocked = 0.
Không có khoản giữ.
```

Hai yêu cầu giữ bán, mỗi yêu cầu 70:

```text
Chỉ một khoản giữ được tạo.
Reserved = 70.
Available = 30.
```

Bài này có thể kiểm tra ở Position Reservation Service, chưa cần mở API bán hoàn chỉnh.

Cách bảo vệ:

1. Khóa hàng `positions`.
2. Đọc hiện trạng khoản giữ bằng cách nhất quán với transaction.
3. Tính lại khả dụng.
4. Tạo reservation nếu đủ.
5. Commit.

Với `REPEATABLE READ`, tránh dùng một `SUM` đọc từ snapshot cũ để quyết định sau khi đã chờ khóa. Có thể đọc các reservation ACTIVE bằng locking read rồi cộng, theo quy ước mọi writer đều khóa position trước.

---

## 11. Log và kiểm thử cuối buổi

Log cần đủ để dựng timeline:

```text
requestId
accountId
orderId
idempotencyKey — hoặc mã băm phù hợp
transactionAttempt
lockRequestedAt
lockAcquiredAt
outcome
durationMs
```

Không log token hoặc mật khẩu.

| Kiểm thử | Kết quả |
|---|---|
| Hai key khác nhau tranh 10 triệu | Một lệnh giữ7 triệu |
| Cùng key đồng thời | Một ý định, không thêm nghiệp vụ |
| Hai tài khoản khác nhau | Không bị khóa cùng một hàng số dư |
| Transaction đang giữ tiền bị lỗi | Rollback, yêu cầu khác dùng được tiền |
| Deadlock | Retry toàn transaction có giới hạn |
| Lock timeout | Rollback rõ ràng, không trả connection còn transaction mở |
| Execution và hủy | Không ghi đè hoặc giải phóng sai |
| Khả dụng không âm | Đồng thời chi tiết reservation và ledger cũng khớp |
| API trái quyền | Bị chặn trước tác động tài sản |

Chỉ lặp lại test khi cần kiểm tra tính ổn định hoặc điều tra lỗi. Không thay một lịch chạy có kiểm soát bằng việc chạy ngẫu nhiên hàng nghìn lần rồi hy vọng bắt được race.

---

## 12. Prompt cho OpenCode

```text
Tôi đang học ngày 19 của Securities Trading Simulator:
Concurrency và chống sử dụng tài sản vượt mức.

Môi trường:
- Node.js + TypeScript, MySQL InnoDB.
- OpenCode, cấu hình model hiện tại.
- Giữ nghiệp vụ, authorization và idempotency ngày 1–18.

Trước khi sửa:
1. Đọc transaction tạo order, giữ tiền, execution và cancel.
2. Kiểm tra isolation level và pool connection thực tế.
3. Xác định các SELECT quyết định nghiệp vụ có khóa hay chưa.
4. Rà soát thứ tự khóa và connection được dùng.
5. Nếu ngày10 đã đúng, ưu tiên chứng minh bằng test,
   không refactor không cần thiết.

Chiến lược chính:
- Row lock cash_balances bằng PK account_id.
- Sau khi lấy khóa mới tính lại khả dụng.
- Cùng connection/transaction cho order, event,
  reservation, balance, ledger, idempotency và audit thành công.
- Không network/matching call trong transaction.
- Không đọc số dư bên ngoài rồi dùng lại để quyết định sau khi khóa.
- Không dùng Redis làm khóa quyết định số dư trong bài này.

Fixture:
- Tài khoản acc-019 mới, CASH ACTIVE.
- Settled10000000, các thành phần khác0.
- OPENING ledger và membership TRADE hợp lệ.
- Không có sell liquidity để order khớp ngay.
- Hai request BUY280@25000, key day19-A và day19-B.

Kỳ vọng:
- Một request accepted, một INSUFFICIENT_CASH.
- Không bắt buộc A hoặc B thắng.
- Reserved7000000, available3000000.
- Một reservation mới, một RESERVE ledger.
- Failed request không để order/hold dở dang.
- Tổng chi tiết hold và ledger khớp balance.

Test concurrency:
- MySQL thật, ít nhất hai connection riêng.
- Có hook/latch và timeout hữu hạn.
- A giữ lock rồi dừng.
- B bắt đầu tranh cùng lock.
- Thả A, B đọc số dư mới sau A commit.
- Không chờ cả A/B cùng lấy được lock.
- Không chỉ dựa vào Promise.all nếu mọi query cùng connection.
- Không dùng sleep dài để điều phối.

Tái hiện bản lỗi trong test harness riêng:
- Hai plain SELECT cùng thấy reserved0.
- Hai UPDATE dùng giá trị tuyệt đối oldReserved+7000000.
- Hai khoản giữ có thể thành14tr nhưng balance chỉ7tr.
- Test phải phát hiện sai lệch giữa balance/hold/ledger.
- Không đưa unsafe implementation vào runtime thường.

So sánh nhưng không triển khai cả ba:
- SELECT FOR UPDATE.
- Conditional UPDATE với điều kiện available>=required.
- Optimistic version.
Chỉ thay chiến lược nếu có lý do cụ thể.
Không giữ tiền hai lần bằng hai cơ chế.

Khóa:
- Giữ thứ tự nhất quán theo quy ước dự án.
- Với nhiều hàng cùng loại, sort theo khóa trước.
- Review create/execution/cancel/settlement để không đảo thứ tự.
- Index query khóa đúng tài nguyên.

Retry:
- Deadlock/lock timeout: rollback toàn transaction còn mở,
  retry transaction mới tối đa3 lần, backoff ngắn có jitter.
- Giữ Idempotency-Key.
- Không retry insufficient funds, auth hoặc payload error.
- Hết retry contention:503 TEMPORARY_CONTENTION.
- Commit outcome không rõ: kiểm tra idempotency,
  không mặc định rollback.
- Luôn release connection trong finally sau commit/rollback.

Execution/cancel fixture:
- BUY100@25000, đã fill40@24900, cancel PENDING.
- Fill thêm20@25000 rồi confirm cancel40.
- Kỳ vọng filled60, canceled40,
  payable1496000, reserved0, available8504000.
- Mọi handler khóa và đọc lại.
- Dedup trước áp dụng execution mới.
- Cancel ACK có cumulativeFilledQuantity và canceledQuantity.
- ACK báo filled60 nhưng OMS mới40:
  chưa giải phóng tiền, chờ execution thiếu.
- Không dùng row lock để giả định đã giải quyết out-of-order.
- Không tự sửa filled để bù execution thiếu.

Nếu còn thời gian:
- Test giữ bán70 và70 trên vị thế100:
  một thành công, available30.
- Chỉ Position Reservation Service, chưa cần API SELL end-to-end.
- Lock position trước, đọc active reservations nhất quán,
  tránh SUM trên read snapshot cũ.

Sau khi làm:
- Chạy kiểm tra phù hợp, báo kết quả thực tế.
- Ghi timeline hai transaction và invariants.
- Cập nhật README về isolation, lock order, retry và giới hạn.
- Không tuyên bố đã giải quyết mọi lỗi phân tán.
```

**Ngày 19 hoàn thành khi:**

- [ ] Hai ý định khác nhau không dùng vượt cùng khoản tiền.
- [ ] Kiểm thử thực sự dùng nhiều connection.
- [ ] Số dư, reservation và ledger đồng nhất.
- [ ] Deadlock và timeout không để transaction dở dang.
- [ ] Khớp và hủy không ghi đè trạng thái cũ.
- [ ] Bạn phân biệt được khóa dữ liệu với xử lý thứ tự bản tin.

Ngày 20 sẽ xây **Transactional Outbox**, giải quyết khoảng lỗi “nghiệp vụ đã commit nhưng sự kiện chưa được phát”, kết hợp với consumer chống trùng ngày 18.
