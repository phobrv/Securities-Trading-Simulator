# Ngày 28 — Capstone: hoàn thiện và trình diễn Securities Trading Simulator

Hôm nay, bạn tổng hợp những phần đã học thành một demo xuyên suốt: **đăng nhập → xem bảng giá → đặt lệnh → khớp một phần → hủy phần còn lại → thanh toán → đối chiếu tài sản → phục hồi một sự cố**.

Mục tiêu cuối cùng là giải thích được **mỗi thay đổi của tiền, chứng khoán và trạng thái lệnh đều đến từ nghiệp vụ nào**, kèm bằng chứng trong database và giao diện.

Tiếp tục sử dụng **Vue 3 + TypeScript + Tailwind CSS, Node.js + TypeScript, MySQL/InnoDB, Redis, WebSocket và OpenCode với cấu hình model bạn đã chọn**. Toàn bộ dữ liệu, lịch và quy tắc giao dịch dưới đây thuộc simulator.

---

## 1. Mục tiêu và sản phẩm cuối ngày

| Sản phẩm | Nội dung |
|---|---|
| Demo xuyên suốt | BUY, SELL, cancel và settlement |
| Fixture có thể tái lập | Tài khoản riêng, dữ liệu mở đầu rõ ràng |
| Báo cáo đối chiếu | Tiền, chứng khoán, giá vốn, lãi/lỗ |
| Demo phục hồi sự cố | Chọn một tình huống ngày 27 |
| Tài liệu bàn giao | Cách chạy, kiến trúc, giới hạn và hướng phát triển |

Phân bổ 90–120 phút:

| Thời lượng | Công việc |
|---|---|
| 20 phút | Ôn luồng nghiệp vụ và kiến trúc |
| 20 phút | Chuẩn bị fixture và kết quả kỳ vọng |
| 40–60 phút | Chạy demo, kiểm tra và xử lý lỗi |
| 10–20 phút | Viết tổng kết và tự đánh giá |

**Không cần bổ sung nhiều tính năng mới.** Ưu tiên làm cho luồng hiện có chạy đúng, có thể giải thích và có thể kiểm tra lại.

---

## 2. Kiến trúc bạn cần giải thích được

| Thành phần | Trách nhiệm chính |
|---|---|
| Security Master | Danh tính và thuộc tính chứng khoán |
| Market Session | Xác định phiên và loại lệnh được phép |
| Market Data | Snapshot, delta, sequence và đồng bộ bảng giá |
| OMS | Vòng đời lệnh và yêu cầu hủy |
| Matching Engine | Ghép lệnh theo giá và thứ tự đến |
| Accounts / PositionService | Quản lý tiền, giữ tài sản và vị thế |
| Execution Processing | Áp dụng kết quả khớp vào các module trong transaction |
| Settlement | Chuyển nghĩa vụ chờ thành tiền/chứng khoán đã thanh toán |
| Outbox / Consumer | Giao event và chống tác động trùng |
| Portfolio | Đọc tài sản và tính định giá |
| Auth / Audit / Observability | Phân quyền, truy vết và quan sát hệ thống |

Ba ranh giới cần trình bày rõ:

1. **Nhận lệnh chưa có nghĩa là đã khớp.**
2. **Khớp lệnh chưa có nghĩa là đã thanh toán.**
3. **Transaction MySQL không bao trùm bộ nhớ matching engine hoặc việc giao message bên ngoài.**

---

## 3. Chuẩn bị fixture capstone

Tạo một lần chạy riêng:

```text
fixtureRunId: capstone-028-<unique-suffix>
account: acc-028-<unique-suffix>
securityId: sec-001
symbol: SIMAAA
market: SIM_EQ_A
```

Sử dụng `securityId` để liên kết dữ liệu; không dùng riêng symbol làm khóa.

**Tài sản mở đầu**

| Chỉ tiêu | Giá trị |
|---|---:|
| Settled cash | 10.000.000 VND |
| Reserved cash | 0 |
| Buy payable | 0 |
| Pending receivable | 0 |
| Blocked cash | 0 |
| Settled quantity | 100 |
| Pending buy / sell quantity | 0 |
| Reserved / blocked quantity | 0 |
| Total cost | 2.400.000 VND |
| Realized P&L | 0 |

Giá vốn bình quân ban đầu:

```text
2.400.000 / 100 = 24.000 VND/cổ phiếu
```

Fixture phải có bản ghi OPENING tiền và vị thế phù hợp với mô hình đã triển khai. Không chỉ cập nhật số dư rồi bỏ trống lịch sử.

Chuẩn bị thêm:

- Một người dùng có quyền TRADE trên tài khoản.
- Một người dùng khác không có quyền truy cập tài khoản.
- Market Clock ở phiên CONTINUOUS.
- Order book riêng, không có lệnh cũ của bài thực hành khác.
- Consumer projection BUY-only, nếu dùng, có phạm vi fixture riêng và baseline được khai báo rõ.

**Dashboard tài sản tiếp tục đọc nguồn Accounts/Portfolio**, không chuyển sang projection BUY-only vì demo hôm nay có cả SELL.

---

## 4. Kịch bản A — BUY khớp một phần rồi hủy

**Bước 1: Chuẩn bị thanh khoản**

Đưa vào book một lệnh hệ thống:

```text
SYSTEM_LIQUIDITY:
SELL 40 @ 24.900
```

Đây là thanh khoản giả lập. Không tự xem nó như một tài khoản khách hàng có đầy đủ tài sản và settlement.

**Bước 2: Khách hàng đặt BUY**

```text
BUY 100 SIMAAA
LO price: 25.000
```

Ngay sau khi nhận lệnh và giữ tiền, trước khi áp dụng execution:

```text
Reserved cash = 100 × 25.000 = 2.500.000
Available cash = 7.500.000
```

**Bước 3: Khớp 40 tại 24.900**

Lệnh SELL đang nằm trên book là maker, nên execution dùng giá 24.900.

```text
Execution quantity = 40
Execution amount   = 40 × 24.900 = 996.000
```

Cập nhật reservation:

```text
Giảm reservation: 40 × 25.000 = 1.000.000
Tăng buy payable:                  996.000
Giải phóng chênh lệch giá:           4.000
```

Kết quả:

| Chỉ tiêu | Sau fill |
|---|---:|
| Order status | PARTIALLY_FILLED |
| Filled / remaining | 40 / 60 |
| Reserved cash | 1.500.000 |
| Buy payable | 996.000 |
| Available cash | 7.504.000 |
| Settled quantity | 100 |
| Pending buy quantity | 40 |
| Economic quantity | 140 |
| Total cost | 3.396.000 |

Giá vốn bình quân kinh tế:

```text
3.396.000 / 140 = 24.257,142857… VND/cổ phiếu
```

Giữ `totalCost` chính xác; giá bình quân hiển thị có thể làm tròn.

**Bước 4: Hủy 60 còn lại**

Khi mới gửi yêu cầu hủy:

- Order vẫn có thể nhận execution.
- Chưa giải phóng 1.500.000 tiền giữ.

Trong kịch bản này không phát sinh thêm execution. Sau khi matching xác nhận hủy:

| Chỉ tiêu | Sau cancel confirmed |
|---|---:|
| Order status | CANCELED |
| Filled quantity | 40 |
| Remaining quantity | 0 |
| Canceled quantity | 60 |
| Reserved cash | 0 |
| Buy payable | 996.000 |
| Available cash | 9.004.000 |

Kiểm tra reservation:

```text
Initial amount  = 2.500.000
Consumed amount =   996.000
Released amount = 1.504.000
Remaining amount =        0
```

Trong đó tiền được giải phóng gồm:

```text
4.000 chênh lệch giá + 1.500.000 phần hủy
```

---

## 5. Kịch bản B — Thanh toán nghĩa vụ BUY

Chuyển Market Clock tới `dueAt` của obligation được tính bằng lịch nghiệp vụ đã cấu hình.

Không hard-code “cộng hai ngày lịch”. Dùng kết quả lịch thanh toán của simulator.

Chạy settlement:

| Chỉ tiêu | Trước settlement | Sau settlement |
|---|---:|---:|
| Settled cash | 10.000.000 | 9.004.000 |
| Buy payable | 996.000 | 0 |
| Available cash | 9.004.000 | 9.004.000 |
| Settled quantity | 100 | 140 |
| Pending buy quantity | 40 | 0 |
| Economic quantity | 140 | 140 |
| Total cost | 3.396.000 | 3.396.000 |

Điểm cần giải thích:

- Tiền khả dụng không giảm lần nữa vì nghĩa vụ mua đã được trừ trước đó.
- Chứng khoán chuyển từ pending buy sang settled.
- Settlement không tính lại giá vốn hoặc phát sinh realized P&L.
- Order đã CANCELED vẫn có obligation cần thanh toán cho phần đã khớp.

Chạy settlement thêm một lần: **không thay đổi tài sản**.

---

## 6. Kịch bản C — SELL một phần số cổ phiếu đã thanh toán

Sau settlement BUY, chọn một thời điểm CONTINUOUS hợp lệ để tiếp tục.

Đặt trước thanh khoản:

```text
SYSTEM_LIQUIDITY:
BUY 50 @ 26.000
```

Khách hàng gửi:

```text
SELL 50 SIMAAA
LO price: 26.000
```

**Trước execution**

```text
Settled quantity = 140
Reserved quantity = 50
Available quantity = 90
```

**Sau execution**

```text
Proceeds = 50 × 26.000 = 1.300.000
```

Giá vốn phân bổ theo quy tắc làm tròn số nguyên đã chọn:

```text
Allocated cost
= roundHalfUp(3.396.000 × 50 / 140)
= 1.212.857
```

Lãi đã thực hiện:

```text
Realized P&L
= 1.300.000 − 1.212.857
= 87.143
```

Kết quả:

| Chỉ tiêu | Sau SELL fill |
|---|---:|
| SELL order status | FILLED |
| Settled quantity | 140 |
| Pending sell quantity | 50 |
| Reserved quantity | 0 |
| Economic quantity | 90 |
| Available quantity | 90 |
| Total cost còn lại | 2.183.143 |
| Realized P&L | 87.143 |
| Pending receivable | 1.300.000 |
| Available cash | 9.004.000 |

Tiền bán đang chờ thanh toán chưa được dùng để tăng tiền mua khả dụng trong mô hình này.

---

## 7. Kịch bản D — Thanh toán nghĩa vụ SELL

Chuyển Market Clock tới thời điểm obligation SELL đến hạn và chạy settlement.

| Chỉ tiêu | Trước settlement SELL | Sau settlement SELL |
|---|---:|---:|
| Settled cash | 9.004.000 | 10.304.000 |
| Pending receivable | 1.300.000 | 0 |
| Available cash | 9.004.000 | 10.304.000 |
| Settled quantity | 140 | 90 |
| Pending sell quantity | 50 | 0 |
| Economic quantity | 90 | 90 |
| Total cost | 2.183.143 | 2.183.143 |
| Realized P&L | 87.143 | 87.143 |

**Đối chiếu toàn bộ luồng**

```text
Tiền cuối
= Tiền đầu − Giá trị BUY + Giá trị SELL
= 10.000.000 − 996.000 + 1.300.000
= 10.304.000
```

```text
Chứng khoán cuối
= Chứng khoán đầu + BUY quantity − SELL quantity
= 100 + 40 − 50
= 90
```

```text
Giá vốn cuối
= Giá vốn đầu + Giá vốn BUY − Giá vốn SELL phân bổ
= 2.400.000 + 996.000 − 1.212.857
= 2.183.143
```

Trong bài demo không có phí, thuế hoặc nghiệp vụ khác.

---

## 8. Kiểm tra Portfolio và P&L

Dùng giá định giá giả lập **26.000 VND** sau hai lần settlement.

```text
Market value
= 90 × 26.000
= 2.340.000
```

```text
Unrealized P&L
= 2.340.000 − 2.183.143
= 156.857
```

```text
Realized + Unrealized P&L
= 87.143 + 156.857
= 244.000
```

Đối chiếu tài sản:

| Chỉ tiêu | Giá trị |
|---|---:|
| Tiền cuối | 10.304.000 |
| Giá trị cổ phiếu cuối | 2.340.000 |
| Tổng tài sản cuối | 12.644.000 |
| Tiền đầu + giá vốn mở đầu | 12.400.000 |
| Chênh lệch | 244.000 |

Đây là đối chiếu với **giá trị ghi sổ mở đầu** của fixture. Nếu đo hiệu suất từ một thời điểm thị trường cụ thể, cần định nghĩa thêm giá thị trường mở đầu và các dòng tiền vào/ra.

---

## 9. Demo một tình huống lỗi

Chọn lại tình huống **mất response sau khi tạo lệnh đã commit** từ ngày 27.

Dùng tài khoản riêng để giữ số liệu capstone chính dễ đối chiếu.

Trình diễn:

1. Gửi BUY với key đã lưu trước khi gọi API.
2. Backend commit nhưng response bị bỏ.
3. Frontend hiển thị `UNKNOWN`.
4. Tra cứu kết quả bằng đúng người dùng, tài khoản và key.
5. Gửi lại cùng key/payload khi cần.
6. Backend trả replay.
7. GET order lấy trạng thái mới nhất.

Bằng chứng:

- Một order.
- Một reservation.
- Một hiệu ứng giữ tiền.
- Request ID khác nhau giữa các lần gọi.
- Replay không dispatch lại matching.
- Audit/log thể hiện được cả request đầu và replay.

Nếu chọn outbox làm demo thay thế, phải chứng minh cùng event được giao lại nhưng projection chỉ thay đổi một lần.

---

## 10. Checklist nghiệm thu

| Nhóm | Điều kiện đạt |
|---|---|
| Security Master | Phân biệt đúng chứng khoán bằng `securityId` |
| Session | Chấp nhận/từ chối theo phiên fixture |
| BUY | Giữ theo giá limit, ghi payable theo giá khớp |
| SELL | Chặn bán vượt khả dụng, giữ và tiêu thụ reservation đúng |
| Cancel | Chỉ giải phóng phần còn lại sau xác nhận |
| Execution | Chống tác động trùng; nội dung xung đột bị từ chối |
| Settlement | Áp dụng một lần, không thay đổi lại giá vốn/P&L |
| Realtime | Phát hiện gap và đồng bộ lại |
| Frontend | Có trạng thái UNKNOWN và phục hồi cùng intent |
| Authorization | Người ngoài tài khoản không đọc hoặc thao tác được |
| Observability | Truy vết được từ request tới order/execution/event |
| Reconciliation | Tiền, số lượng và giá vốn khớp kết quả kỳ vọng |

Đối chiếu nên dùng **bảng kết quả kỳ vọng độc lập của bài học**. Không tạo “expected result” bằng chính hàm tính đang cần kiểm tra.

---

## 11. Kịch bản trình diễn trong 10–15 phút

| Thời lượng | Nội dung |
|---|---|
| 1 phút | Giới thiệu kiến trúc và tài sản mở đầu |
| 2 phút | Bảng giá, session và đặt BUY |
| 2 phút | Khớp 40, kiểm tra tài sản, hủy 60 |
| 2 phút | Settlement BUY |
| 2 phút | SELL 50 và settlement SELL |
| 2 phút | Portfolio, P&L và đối chiếu |
| 2–4 phút | Phục hồi sự cố và trình bày giới hạn |

Các API hỗ trợ:

```http
GET /api/me/accounts
GET /api/securities
GET /api/markets/SIM_EQ_A/session

POST /api/orders
GET /api/orders/:orderId
POST /api/orders/:orderId/cancel

GET /api/orders/:orderId/events
GET /api/orders/:orderId/executions
GET /api/orders/:orderId/timeline

GET /api/accounts/:accountId/balances
GET /api/accounts/:accountId/positions
GET /api/accounts/:accountId/portfolio
GET /api/accounts/:accountId/cash-ledger
GET /api/accounts/:accountId/settlement-obligations
```

Dùng công cụ điều khiển clock, thanh khoản và settlement nội bộ đã có; các thao tác đó tiếp tục giới hạn cho OPS/local.

---

## 12. Tài liệu bàn giao cần có

Chuẩn bị ngắn gọn trong repository:

| Tài liệu | Nội dung |
|---|---|
| README | Cài đặt, cấu hình, chạy ứng dụng |
| Demo guide | Seed fixture, thao tác và kết quả kỳ vọng |
| Architecture | Ranh giới module và transaction |
| Invariants | Công thức và quy tắc tài sản |
| Runbook | Điều tra, retry và phục hồi |
| Known limitations | Phần chưa được hỗ trợ |

Trong giới hạn hiện tại, cần nêu rõ:

- Matching book trong bộ nhớ chưa có khả năng phục hồi crash đầy đủ.
- Không tự gửi lại toàn bộ order NEW vào engine sau restart.
- Outbox hiện tại không giải quyết việc dispatch/recovery của matching.
- Projection thử nghiệm chỉ hỗ trợ BUY, không đại diện toàn bộ danh mục sau SELL.
- Chưa hỗ trợ đầy đủ phí/thuế, corporate actions, sửa giao dịch và mọi loại lệnh.
- Lịch và quy tắc demo không phải bộ quy tắc giao dịch thực tế.
- Demo thành công chưa đủ để kết luận hệ thống sẵn sàng vận hành giao dịch thật.

---

## 13. Prompt cho OpenCode

```text
Hoàn thiện capstone ngày 28 trên Securities Trading Simulator hiện tại.

Stack:
- Vue 3 + TypeScript + Tailwind CSS.
- Node.js + TypeScript, modular monolith.
- MySQL/InnoDB.
- Redis, WebSocket.
- Giữ công cụ và thư viện đang dùng.

Mục tiêu:
Chạy demo xuyên suốt BUY, partial fill, cancel, BUY settlement,
SELL, SELL settlement, portfolio reconciliation và một incident recovery.

Trước khi sửa:
1. Đọc code và tài liệu hiện có.
2. Xác định tính năng đã chạy được, phần còn thiếu và lỗi chặn demo.
3. Ưu tiên sửa luồng hiện có, tránh refactor lớn.
4. Không thay đổi công thức tài sản hoặc matching chỉ để khớp fixture.

A. Fixture riêng
- Dùng run ID/account ID duy nhất.
- Security sec-001 / SIMAAA / SIM_EQ_A.
- Settled cash 10000000.
- Settled quantity 100.
- Total cost 2400000.
- Realized P&L 0.
- Các bucket pending/reserved/blocked bằng 0.
- Có opening ledger và position history phù hợp.
- Có user TRADE và user không được truy cập.
- Không xóa lịch sử cũ, không flush toàn Redis.

B. Luồng BUY
- Seed SYSTEM_LIQUIDITY SELL 40 @ 24900.
- Customer BUY 100 LO @ 25000.
- Fill 40 @ 24900.
- Cancel confirmed remaining 60, không có fill bổ sung.

Kết quả sau cancel:
- Order CANCELED, filled 40, canceled 60, remaining 0.
- Reserved cash 0.
- Buy payable 996000.
- Available cash 9004000.
- Settled quantity 100.
- Pending buy quantity 40.
- Economic quantity 140.
- Total cost 3396000.
- Cash reservation:
  initial 2500000, consumed 996000,
  released 1504000, remaining 0.

C. BUY settlement
- Dùng calendar/dueAt đã có.
- Chuyển Market Clock tới thời điểm đến hạn.
- Settled cash 9004000, buy payable 0.
- Settled quantity 140, pending buy 0.
- Available cash vẫn 9004000.
- Total cost vẫn 3396000.
- Chạy lại không có tác động thêm.

D. Luồng SELL
- Chọn phiên CONTINUOUS hợp lệ.
- Seed SYSTEM_LIQUIDITY BUY 50 @ 26000.
- Customer SELL 50 LO @ 26000.
- Proceeds 1300000.
- Allocated cost roundHalfUp(3396000 * 50 / 140) = 1212857.
- Realized P&L 87143.
- Sau fill:
  settled quantity 140;
  pending sell 50;
  economic/available quantity 90;
  reservation remaining 0;
  total cost 2183143;
  pending receivable 1300000;
  available cash 9004000.

E. SELL settlement
- Settled cash 10304000.
- Pending receivable 0.
- Settled quantity 90.
- Pending sell 0.
- Total cost 2183143.
- Realized P&L 87143.
- Chạy lại không có tác động thêm.

F. Portfolio đối chiếu
Với mark price 26000:
- Market value 2340000.
- Unrealized P&L 156857.
- Realized + unrealized P&L 244000.
- Total assets 12644000.
- So với opening cash + opening cost 12400000,
  chênh lệch 244000.
- Dashboard đọc source Accounts/Portfolio.
- Không dùng projection BUY-only cho toàn bộ danh mục có SELL.

G. Incident demo
- Dùng fixture riêng.
- Bỏ response sau create-order commit.
- Frontend UNKNOWN.
- Lookup/retry cùng intent và idempotency key.
- Một order, một reservation, một hiệu ứng giữ tiền.
- Replay không redispatch matching.

H. Kiểm tra
- Dùng expected values độc lập nêu trên.
- Kiểm tra quyền, replay, execution duplicate/conflict,
  settlement duplicate và tài sản cuối.
- Chạy các check hiện có phù hợp.
- Không tạo test chỉ để lặp lại implementation.

I. Tài liệu
- README và hướng dẫn demo.
- Kiến trúc/transaction boundaries.
- Invariants và reconciliation.
- Runbook và known limitations.
- Nêu rõ matching in-memory chưa có crash recovery đầy đủ.
- Không blind resubmit DB NEW orders.

Sau khi hoàn thành:
- Báo thay đổi thực tế.
- Liệt kê kiểm tra đã chạy và kết quả.
- Nêu lỗi hoặc giới hạn còn lại.
- Không tuyên bố demo đã chạy nếu chưa thực sự chạy.
```

## 14. Tự đánh giá sau 28 ngày

Bạn nên tự giải thích được những câu hỏi sau mà không cần đọc code:

1. Vì sao BUY giữ tiền theo giá limit nhưng nghĩa vụ mua theo giá khớp?
2. Vì sao khớp BUY chưa làm giảm settled cash ngay?
3. Vì sao cancel requested chưa được giải phóng tài sản?
4. Vì sao SELL fill làm giảm vị thế kinh tế trước khi giảm settled quantity?
5. Vì sao retry HTTP và retry execution cần danh tính chống trùng khác nhau?
6. Vì sao outbox vẫn có thể giao event nhiều lần?
7. Vì sao không dùng timestamp đơn thuần để sắp thứ tự trạng thái?
8. Vì sao MySQL rollback không khôi phục được matching book trong bộ nhớ?
9. Làm sao chứng minh số dư cuối đúng bằng ledger và movement?
10. Khi có lỗi, bạn biết dữ liệu nào là bằng chứng đã commit?

**Hoàn thành ngày 28 khi bạn chạy được demo, đối chiếu đúng tài sản cuối và chỉ ra rõ phần hệ thống đã bảo đảm cùng phần chưa hỗ trợ.**
