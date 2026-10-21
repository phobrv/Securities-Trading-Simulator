# Ngày 5 — Sổ lệnh và khớp lệnh cơ bản

Hôm nay bạn xây **Matching Simulator**: nhận lệnh LO, tìm lệnh đối ứng và tạo các lần khớp theo ưu tiên giá rồi thời gian.

Bạn sẽ tự tính kết quả trước, sau đó dùng code để kiểm chứng. Môi trường giữ nguyên: **Node.js + TypeScript, MySQL, Redis, Vue 3 + TypeScript + Tailwind CSS**, triển khai bằng **OpenCode**.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Sổ lệnh, ưu tiên giá/thời gian, khớp một phần | Tính được kết quả giao dịch |
| 30 phút kỹ thuật | Thiết kế engine, order và execution | Có thuật toán và bất biến |
| 30–60 phút thực hành | Engine trong bộ nhớ, API demo, kiểm thử | Một lệnh khớp được với nhiều lệnh đối ứng |

**Phạm vi bắt buộc hôm nay:**

- Một chứng khoán: `sec-001 / SIMAAA / SIM_EQ_A`.
- Chỉ nhận `LO` trong phiên `CONTINUOUS`.
- Sổ lệnh lưu trong bộ nhớ backend.
- Giá khớp lấy theo **lệnh đang nằm trong sổ**.
- Khối lượng dùng số nguyên dương; demo cho phép từng đơn vị, chưa áp dụng quy tắc lô thực tế.
- Chưa xử lý tiền, chứng khoán khả dụng hoặc thanh toán.

---

## 2. Nghiệp vụ — 30 phút

### 2.1. Sổ lệnh là gì?

Sổ lệnh — `Order Book` — chứa các lệnh mua và bán đang chờ thực hiện, bao gồm phần chưa khớp của lệnh đã khớp một phần.

Ví dụ:

| Bên mua | Khối lượng | Bên bán | Khối lượng |
|---:|---:|---:|---:|
| 25.000 | 100 | 25.100 | 100 |
| 24.900 | 200 | 25.200 | 200 |
| 24.800 | 300 | 25.300 | 300 |

Ở đây:

```text
Giá mua tốt nhất = 25.000
Giá bán tốt nhất = 25.100
```

Chưa có giao dịch vì bên mua chưa chấp nhận mức bán thấp nhất.

**Điều kiện giao nhau về giá:**

```text
Giá mua >= Giá bán
```

Điều kiện này phải được xét trên các lệnh phù hợp cùng chứng khoán và cùng sổ giao dịch.

### 2.2. Ưu tiên giá rồi thời gian

Trong mô hình khớp lệnh liên tục, lệnh mua giá cao hơn và lệnh bán giá thấp hơn được ưu tiên về giá; cùng mức giá thì xét thứ tự vào hệ thống. Hướng dẫn giao dịch của TCBS cũng mô tả nguyên tắc này. [Trung tâm hỗ trợ - TCBS](https://help.tcbs.com.vn/quy-dinh-giao-dich-chung-khoan-tai-hsx/?utm_source=chatgpt.com)

| Phía | Ưu tiên giá | Khi cùng giá |
|---|---|---|
| Mua | Cao trước | Vào trước được xét trước |
| Bán | Thấp trước | Vào trước được xét trước |

Ví dụ bên bán:

| Lệnh | Giá | Khối lượng | Thứ tự vào |
|---|---:|---:|---:|
| S1 | 25.000 | 100 | 1 |
| S2 | 24.900 | 100 | 2 |
| S3 | 25.000 | 100 | 3 |

Thứ tự ưu tiên:

```text
S2 → S1 → S3
```

S2 đến sau S1 nhưng bán giá thấp hơn nên được ưu tiên. S1 và S3 cùng giá thì S1 đứng trước.

### 2.3. Giá đặt khác giá khớp

Giả sử trong sổ có:

```text
S1: Bán 40 cổ phiếu tại 24.900 đồng.
```

Lệnh mới đến:

```text
B1: Mua 100 cổ phiếu, LO giá 25.000 đồng.
```

Theo quy tắc simulator:

```text
Khớp 40 cổ phiếu tại 24.900 đồng.
```

Giá 25.000 là giới hạn mua, không phải bắt buộc khớp đúng 25.000.

Trong hướng dẫn của TCBS, giá khớp liên tục được mô tả là giá của lệnh nhập vào hệ thống trước khi hai lệnh thỏa mãn điều kiện giá. [Trung tâm hỗ trợ - TCBS](https://help.tcbs.com.vn/quy-dinh-giao-dich-chung-khoan-tai-hsx/?utm_source=chatgpt.com)

Hôm nay ta biểu diễn bằng:

- `maker`: lệnh đã nằm trong sổ.
- `taker`: lệnh mới đến và được xét với sổ.

```text
execution.price = maker.price
```

Đây là tên vai trò trong engine, chưa liên quan đến biểu phí.

### 2.4. Một lệnh có thể sinh nhiều lần khớp

Sổ ban đầu:

| Lệnh bán | Giá | Khối lượng còn lại |
|---|---:|---:|
| S1 | 24.900 | 40 |
| S2 | 25.000 | 100 |
| S3 | 25.100 | 50 |

Lệnh mới:

```text
B1: Mua 100, LO giá 25.000.
```

Engine xử lý:

| Lần khớp | Lệnh đối ứng | Khối lượng | Giá |
|---|---|---:|---:|
| E1 | S1 | 40 | 24.900 |
| E2 | S2 | 60 | 25.000 |

Kết quả:

| Lệnh | Đã khớp | Còn lại | Trạng thái |
|---|---:|---:|---|
| B1 | 100 | 0 | `FILLED` |
| S1 | 40 | 0 | `FILLED` |
| S2 | 60 | 40 | `PARTIALLY_FILLED` |
| S3 | 0 | 50 | `NEW` |

S1 được loại khỏi danh sách lệnh đang chờ. S2 vẫn nằm trong sổ với khối lượng còn lại là 40.

Giá trị B1 đã mua:

```text
40 × 24.900 + 60 × 25.000
= 996.000 + 1.500.000
= 2.496.000 đồng
```

Giá khớp bình quân:

```text
2.496.000 / 100 = 24.960 đồng/cổ phiếu
```

### 2.5. Khớp một phần rồi nằm lại trong sổ

Bắt đầu lại từ sổ ban đầu, thay B1 bằng:

```text
B2: Mua 160, LO giá 25.000.
```

Kết quả:

- Khớp 40 với S1 tại 24.900.
- Khớp 100 với S2 tại 25.000.
- Không khớp với S3 vì S3 bán 25.100.
- B2 còn 20, nằm lại bên mua tại giá 25.000.

```text
B2:
quantity          = 160
filledQuantity    = 140
remainingQuantity = 20
status            = PARTIALLY_FILLED
```

**Phần còn lại của LO không tự mất chỉ vì chưa tìm được giá phù hợp.**

---

## 3. Kỹ thuật — 30 phút

### 3.1. Tách Matching Simulator khỏi OMS

| Thành phần | Trách nhiệm |
|---|---|
| Security Master | Chứng khoán có tồn tại và được giao dịch không |
| Market Session | Có đang ở phiên cho phép engine hoạt động không |
| Matching Simulator | Ưu tiên lệnh, so khớp, tạo execution |
| OMS — học sâu từ ngày 8 | Quản lý vòng đời lệnh của khách hàng |
| Accounts — từ ngày 6 | Tài sản và khả dụng |
| Market Data | Công bố giá và độ sâu thị trường |

API hôm nay là **API thử nghiệm của simulator**, chưa phải API đặt lệnh khách hàng hoàn chỉnh.

### 3.2. Cấu trúc module

```text
src/modules/matching-simulator/
  matching.types.ts
  order-book.ts
  matching-engine.ts
  matching.service.ts
  matching.routes.ts
  matching-engine.test.ts
```

Nguyên tắc triển khai:

- Engine chỉ xử lý dữ liệu trong bộ nhớ.
- Không gọi MySQL, Redis hoặc HTTP bên trong vòng lặp khớp.
- Service kiểm tra dữ liệu và phiên trước khi gọi engine.
- Mỗi lần submit được xử lý nối tiếp cho cùng sổ lệnh.

Có thể bắt đầu bằng hai mảng được sắp xếp. Quy mô bài học chưa cần cây giá hoặc cấu trúc tối ưu phức tạp.

### 3.3. Kiểu dữ liệu lệnh

```ts
type Side = "BUY" | "SELL";

type SimulatorOrderStatus =
  | "NEW"
  | "PARTIALLY_FILLED"
  | "FILLED";

type SimulatorOrder = {
  orderId: string;
  clientOrderId: string;

  securityId: string;
  side: Side;
  orderType: "LO";

  price: number;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;

  arrivalSequence: number;
  acceptedAt: string;

  status: SimulatorOrderStatus;
};
```

Các trường quan trọng:

| Trường | Ý nghĩa |
|---|---|
| `quantity` | Khối lượng ban đầu, không đổi |
| `filledQuantity` | Tổng khối lượng đã khớp |
| `remainingQuantity` | Phần chưa khớp |
| `arrivalSequence` | Thứ tự engine chấp nhận lệnh |
| `acceptedAt` | Thời gian dùng để hiển thị và điều tra |

Dùng sequence do server cấp để xác định thứ tự. Với `FixedClock`, nhiều lệnh có thể có cùng timestamp nhưng vẫn phải có thứ tự rõ ràng.

**Không lấy thời gian từ client để quyết định ưu tiên.**

### 3.4. Kiểu dữ liệu lần khớp

```ts
type Execution = {
  executionId: string;
  securityId: string;

  buyOrderId: string;
  sellOrderId: string;

  makerOrderId: string;
  takerOrderId: string;

  price: number;
  quantity: number;
  executedAt: string;
};
```

Một execution biểu diễn **một giao dịch giữa hai lệnh đối ứng**.

Không tạo hai execution thị trường khác nhau chỉ vì cần cập nhật cả bên mua và bên bán. Sau này, cùng execution có thể tạo các biến động tài sản tương ứng cho từng tài khoản.

### 3.5. Cấu trúc sổ

```ts
type OrderBook = {
  securityId: string;
  bids: SimulatorOrder[];
  asks: SimulatorOrder[];
};
```

Sắp xếp:

```ts
// Bên mua: giá cao trước, cùng giá thì đến trước.
bids.sort(
  (a, b) =>
    b.price - a.price ||
    a.arrivalSequence - b.arrivalSequence
);

// Bên bán: giá thấp trước, cùng giá thì đến trước.
asks.sort(
  (a, b) =>
    a.price - b.price ||
    a.arrivalSequence - b.arrivalSequence
);
```

Lệnh khớp một phần nằm lại trong sổ phải giữ nguyên `arrivalSequence`.

### 3.6. Thuật toán khớp

```text
Nhận incoming order đã được kiểm tra.

Chọn phía đối ứng:
- Incoming BUY → xem asks.
- Incoming SELL → xem bids.

Trong khi incoming còn khối lượng:
1. Lấy lệnh đối ứng tốt nhất.
2. Nếu không có → dừng.
3. Nếu giá không giao nhau → dừng.
4. matchedQty = min(incoming.remaining, resting.remaining).
5. Tạo execution theo giá resting.
6. Cập nhật khối lượng của cả hai lệnh.
7. Nếu resting hết khối lượng → loại khỏi sổ.
8. Tiếp tục xét lệnh đối ứng tiếp theo.

Nếu incoming còn khối lượng:
- Đưa phần còn lại vào đúng phía của sổ.

Cập nhật trạng thái và trả kết quả.
```

Điều kiện giá:

```ts
function canMatch(
  incoming: SimulatorOrder,
  resting: SimulatorOrder
): boolean {
  return incoming.side === "BUY"
    ? incoming.price >= resting.price
    : incoming.price <= resting.price;
}
```

Hàm trên giả định đã chọn đúng phía đối ứng và cùng sổ chứng khoán.

---

## 4. Những bất biến phải giữ

Đây là phần quan trọng nhất khi viết và debug engine.

| Bất biến | Ý nghĩa |
|---|---|
| `quantity = filledQuantity + remainingQuantity` | Không làm mất hoặc tạo thêm khối lượng |
| `remainingQuantity >= 0` | Không khớp vượt lệnh |
| `execution.quantity > 0` | Không tạo lần khớp rỗng |
| Giá khớp ≤ giới hạn mua | Không vi phạm LO mua |
| Giá khớp ≥ giới hạn bán | Không vi phạm LO bán |
| Lệnh còn trong sổ có remaining > 0 | Không giữ lệnh đã hết |
| Execution liên kết hai lệnh cùng chứng khoán | Không khớp chéo mã |
| Sổ sau xử lý không còn cặp giá giao nhau | Không bỏ sót cơ hội khớp trong mô hình |
| Khớp một phần giữ thứ tự cũ | Không làm mất ưu tiên thời gian |

**Lưu ý khi đối chiếu:** tổng `filledQuantity` của tất cả lệnh mua và bán bằng **hai lần** tổng khối lượng execution, vì mỗi giao dịch ghi nhận cho cả hai phía.

Ví dụ một execution 100 cổ phiếu:

```text
Lệnh mua tăng filled 100.
Lệnh bán tăng filled 100.
Khối lượng thị trường tăng 100, không phải 200.
```

---

## 5. MySQL, Redis và bộ nhớ hôm nay

| Dữ liệu | Nơi quản lý |
|---|---|
| Danh mục chứng khoán | MySQL ngày 2 |
| Lịch phiên | Config và Clock ngày 4 |
| Lệnh simulator đang chờ | Bộ nhớ backend |
| Execution của phiên demo | Bộ nhớ backend |
| Snapshot bảng giá | Redis ngày 3, nếu tích hợp mở rộng |

**Chưa cần tạo bảng `orders` và `executions` trong MySQL hôm nay.** Thiết kế lưu trữ và vòng đời OMS sẽ triển khai từ ngày 8.

Hệ quả cần ghi rõ trong README:

- Khởi động lại backend làm mất sổ và execution trong bộ nhớ.
- Demo một backend instance.
- Chưa có khôi phục sau sự cố.
- Chưa bảo vệ tài sản vì chưa có luồng tài khoản.

---

## 6. API demo cần xây

### 6.1. Gửi lệnh vào simulator

```http
POST /api/simulator/orders
```

Ví dụ tạo lệnh bán:

```json
{
  "clientOrderId": "S1",
  "securityId": "sec-001",
  "side": "SELL",
  "orderType": "LO",
  "price": 24900,
  "quantity": 40
}
```

Backend tự cấp `orderId`, `arrivalSequence` và thời điểm tiếp nhận.

Ví dụ response cho lệnh mua B1 sau khi đã có S1, S2, S3:

```json
{
  "data": {
    "order": {
      "orderId": "sim-ord-b1",
      "clientOrderId": "B1",
      "securityId": "sec-001",
      "side": "BUY",
      "orderType": "LO",
      "price": 25000,
      "quantity": 100,
      "filledQuantity": 100,
      "remainingQuantity": 0,
      "arrivalSequence": 4,
      "acceptedAt": "2026-10-20T03:00:00Z",
      "status": "FILLED"
    },
    "executions": [
      {
        "executionId": "sim-exe-001",
        "securityId": "sec-001",
        "buyOrderId": "sim-ord-b1",
        "sellOrderId": "sim-ord-s1",
        "makerOrderId": "sim-ord-s1",
        "takerOrderId": "sim-ord-b1",
        "price": 24900,
        "quantity": 40,
        "executedAt": "2026-10-20T03:00:00Z"
      },
      {
        "executionId": "sim-exe-002",
        "securityId": "sec-001",
        "buyOrderId": "sim-ord-b1",
        "sellOrderId": "sim-ord-s2",
        "makerOrderId": "sim-ord-s2",
        "takerOrderId": "sim-ord-b1",
        "price": 25000,
        "quantity": 60,
        "executedAt": "2026-10-20T03:00:00Z"
      }
    ]
  }
}
```

Các ID trên chỉ minh họa; có thể sinh UUID trong code.

### 6.2. Xem sổ lệnh

```http
GET /api/simulator/order-books/sec-001
```

Response sau B1:

```json
{
  "data": {
    "securityId": "sec-001",
    "bids": [],
    "asks": [
      {
        "price": 25000,
        "quantity": 40,
        "orderCount": 1
      },
      {
        "price": 25100,
        "quantity": 50,
        "orderCount": 1
      }
    ]
  }
}
```

API trả **khối lượng cộng gộp theo mức giá**. Engine vẫn giữ từng lệnh riêng để bảo toàn ưu tiên thời gian.

### 6.3. Xem execution

```http
GET /api/simulator/executions?securityId=sec-001
```

Trả các execution theo thứ tự được tạo, giúp đối chiếu kết quả.

### 6.4. Quy tắc từ chối

| Trường hợp | HTTP | Mã lỗi |
|---|---:|---|
| Giá hoặc khối lượng không phải số nguyên dương an toàn | 400 | `INVALID_ORDER_INPUT` |
| Loại lệnh khác LO | 400 | `UNSUPPORTED_ORDER_TYPE` |
| Chứng khoán không tồn tại | 404 | `SECURITY_NOT_FOUND` |
| Chứng khoán không được giao dịch | 422 | `SECURITY_NOT_TRADABLE` |
| Không thuộc phạm vi chứng khoán của demo | 422 | `SECURITY_NOT_SUPPORTED` |
| Không phải phiên liên tục | 422 | `MATCHING_SESSION_NOT_SUPPORTED` |
| Trùng `clientOrderId` trong lần chạy engine | 409 | `DUPLICATE_CLIENT_ORDER_ID` |

Hôm nay **từ chối ID trùng**, chưa triển khai trả lại kết quả cũ theo idempotency.

Kiểm tra thất bại phải xảy ra trước khi thay đổi sổ.

---

## 7. Thực hành — 30–60 phút

**Bước 1 — Cố định thời gian trong phiên liên tục**

```dotenv
SIM_CLOCK_MODE=FIXED
SIM_NOW=2026-10-20T10:00:00+07:00
```

Ngày được chọn là ngày mô phỏng để tiếp tục fixture của bài trước, không bắt buộc trùng ngày hiện tại.

**Bước 2 — Xây và kiểm thử engine trước API**

Viết được:

```ts
submitOrder(input): {
  order: SimulatorOrder;
  executions: Execution[];
}
```

và:

```ts
getOrderBook(securityId)
```

Kết quả trả ra nên là bản sao dữ liệu, tránh code bên ngoài sửa trực tiếp trạng thái nội bộ.

**Bước 3 — Tạo ba lệnh bán theo thứ tự**

| clientOrderId | Side | Giá | Khối lượng |
|---|---|---:|---:|
| S1 | SELL | 24.900 | 40 |
| S2 | SELL | 25.000 | 100 |
| S3 | SELL | 25.100 | 50 |

**Bước 4 — Gửi B1**

```json
{
  "clientOrderId": "B1",
  "securityId": "sec-001",
  "side": "BUY",
  "orderType": "LO",
  "price": 25000,
  "quantity": 100
}
```

Đối chiếu:

```text
2 execution.
Tổng khối lượng: 100.
Tổng giá trị: 2.496.000 đồng.
S2 còn 40.
S3 còn 50.
Bên mua không còn B1.
```

**Bước 5 — Chạy kịch bản khớp một phần độc lập**

Dùng một instance engine mới trong kiểm thử hoặc khởi động lại backend để có sổ rỗng. Seed lại S1, S2, S3 rồi gửi B2 mua 160 tại 25.000.

Không chạy B2 trên sổ đã bị B1 thay đổi rồi kỳ vọng kết quả như ví dụ ban đầu.

---

## 8. Kiểm thử bắt buộc

| Kiểm thử | Kết quả cần chứng minh |
|---|---|
| Lệnh mua thấp hơn giá bán tốt nhất | Không có execution |
| Giá mua bằng giá bán | Khớp được |
| Hai lệnh bán khác giá | Giá bán thấp hơn được xét trước |
| Hai lệnh mua khác giá | Giá mua cao hơn được xét trước |
| Hai lệnh cùng phía, cùng giá | `arrivalSequence` nhỏ hơn được xét trước |
| Một lệnh gặp hai lệnh đối ứng | Tạo hai execution đúng khối lượng |
| Incoming chỉ khớp một phần | Phần dư nằm lại trong sổ |
| Resting chỉ khớp một phần | Giữ nguyên ưu tiên cũ |
| Resting là lệnh mua | Giá khớp theo giá mua đang nằm trong sổ |
| Request sai hoặc ID trùng | Sổ không thay đổi |
| Hai lệnh cùng timestamp | Sequence vẫn xác định đúng thứ tự |

Ví dụ kiểm tra chiều bán:

```text
B1 nằm sẵn: mua 100 tại 25.000.
S1 mới đến: bán 40 tại 24.900.

Kết quả:
Khớp 40 tại 25.000.
B1 còn mua 60 tại 25.000.
```

Trường hợp này giúp phát hiện engine chỉ đúng cho lệnh mua mới đến.

---

## 9. Tình huống debug

### A. Lệnh mua khớp giá bán cao trước

Lỗi:

```ts
asks.sort((a, b) => b.price - a.price);
```

Bên bán đang bị sắp xếp giảm dần. Với S1 bán 24.900 và S2 bán 25.000, engine xét S2 trước.

Cách điều tra:

1. In thứ tự sổ trước khi khớp.
2. So với quy tắc bên bán giá thấp trước.
3. Viết kiểm thử thất bại rồi sửa comparator.

### B. Khớp vượt khối lượng

Lỗi:

```ts
const matchedQuantity = resting.remainingQuantity;
```

Incoming còn 20 nhưng resting còn 100 thì engine tạo execution 100.

Cách sửa:

```ts
const matchedQuantity = Math.min(
  incoming.remainingQuantity,
  resting.remainingQuantity
);
```

Sau mỗi execution, kiểm tra bất biến của cả hai lệnh.

### C. Lệnh khớp một phần mất ưu tiên

Lỗi: khi đưa phần còn lại vào sổ, code cấp sequence mới.

Ví dụ:

```text
S1 bán 100 tại 25.000, vào trước.
S2 bán 100 tại 25.000, vào sau.

S1 khớp 40.
S1 còn 60 phải tiếp tục đứng trước S2.
```

Phần còn lại vẫn thuộc lệnh cũ, không phải lệnh mới.

### D. Khối lượng thị trường bị nhân đôi

Cùng execution 100 cổ phiếu được xử lý cho bên mua một lần, bên bán một lần rồi cộng cả hai vào Market Data.

Kết quả sai: `totalVolume` tăng 200.

Cách sửa: Market Data nhận **một execution thị trường duy nhất** và tăng 100.

---

## 10. Tích hợp bảng giá — phần mở rộng

Nếu còn thời gian, thay nguồn dữ liệu giá ngẫu nhiên bằng execution của matching engine.

| Trường Market Data | Nguồn mới |
|---|---|
| `lastPrice` | Giá execution mới nhất |
| `lastQuantity` | Khối lượng execution mới nhất |
| `totalVolume` | Cộng khối lượng mỗi execution một lần |
| `totalValue` | Cộng `price × quantity` mỗi execution |
| `bestBid` | Mức mua tốt nhất trong sổ |
| `bestAsk` | Mức bán tốt nhất trong sổ |

**Chọn một nguồn cho mỗi chứng khoán:** khi dùng matching engine cho `sec-001`, tắt bộ sinh tick ngẫu nhiên của mã đó.

Chỉ thay đổi sổ cũng có thể làm dư mua/bán thay đổi mà không có execution. Khi đó cập nhật `bestBid`/`bestAsk`, giữ nguyên giá khớp gần nhất và tổng khối lượng.

---

## 11. Prompt cho OpenCode

```text
Tôi đang học ngày 5 của Securities Trading Simulator:
Order Book và Matching Simulator.

Môi trường:
- Node.js + TypeScript, MySQL, Redis, Vue 3 + TypeScript + Tailwind CSS.
- OpenCode, dùng cấu hình model hiện tại của tôi.
- Modular monolith.
- Giữ cấu trúc project ngày 1–4.

Trước khi code:
1. Đọc Security Master, Market Session và Clock.
2. Tóm tắt luồng kiểm tra trước khi engine nhận lệnh.
3. Đề xuất phạm vi 30–60 phút.
4. Giải thích ưu tiên giá, thời gian và giá khớp theo resting order.

Phạm vi:
- Chỉ sec-001 / SIMAAA / SIM_EQ_A.
- Chỉ LO trong CONTINUOUS.
- Sổ lệnh và executions trong bộ nhớ.
- Một backend instance.
- Chưa có tài khoản, giữ tài sản, settlement hoặc OMS hoàn chỉnh.
- Khối lượng nguyên dương theo đơn vị giả lập, chưa áp dụng lô.
- Chưa cần bảng orders/executions trong MySQL.

Engine:
- Tách khỏi HTTP, MySQL và Redis.
- Xử lý mỗi submit nối tiếp cho cùng sổ.
- Không await I/O trong vòng lặp matching.
- Bids: giá giảm dần, cùng giá sequence tăng dần.
- Asks: giá tăng dần, cùng giá sequence tăng dần.
- arrivalSequence do server cấp, không lấy từ client.
- Khớp nếu buy.price >= sell.price.
- Giá khớp lấy theo resting order.
- Khối lượng khớp = min hai remainingQuantity.
- Cập nhật cả hai lệnh.
- Loại resting khỏi sổ khi remaining bằng 0.
- Incoming còn dư thì đưa vào sổ.
- Lệnh khớp một phần giữ sequence ban đầu.
- Tạo executionId duy nhất cho mỗi giao dịch đối ứng.
- Trả bản sao dữ liệu, không lộ object nội bộ để sửa.

Order gồm:
orderId, clientOrderId, securityId, side, orderType,
price, quantity, filledQuantity, remainingQuantity,
arrivalSequence, acceptedAt, status.

Execution gồm:
executionId, securityId, buyOrderId, sellOrderId,
makerOrderId, takerOrderId, price, quantity, executedAt.

API:
- POST /api/simulator/orders.
- GET /api/simulator/order-books/:securityId:
  trả độ sâu cộng gộp theo mức giá.
- GET /api/simulator/executions?securityId=...
  trả theo thứ tự tạo.

Kiểm tra trước khi sửa sổ:
- Input giá và quantity là số nguyên dương an toàn.
- Chỉ LO.
- Security tồn tại, TRADABLE, nằm trong phạm vi demo.
- Phiên CONTINUOUS theo Clock ngày 4.
- clientOrderId chưa dùng trong lần chạy engine.
- Trùng clientOrderId trả 409, chưa triển khai idempotency.
- Request bị từ chối không thay đổi sổ.

Fixture:
S1 SELL 40 @24900.
S2 SELL 100 @25000.
S3 SELL 50 @25100.
Sau đó B1 BUY 100 @25000.

Kỳ vọng:
- Khớp 40 @24900 và 60 @25000.
- B1 FILLED.
- S1 FILLED.
- S2 PARTIALLY_FILLED, còn 40.
- S3 NEW, còn 50.
- Tổng giá trị 2496000.

Fixture độc lập thứ hai:
- Reset bằng instance engine mới trong test.
- Seed lại S1,S2,S3.
- BUY 160 @25000.
- Khớp 140, còn mua 20 nằm lại sổ.

Kiểm thử:
- Giá không giao nhau.
- Giá bằng nhau.
- Ưu tiên giá ở cả phía mua và bán.
- FIFO cùng giá, kể cả cùng timestamp.
- Nhiều execution cho một incoming order.
- Partial fill ở cả incoming và resting.
- Giá khớp theo resting BUY và resting SELL.
- Không khớp vượt quantity.
- Không còn lệnh remaining=0 trong sổ.
- Không đổi ưu tiên của phần còn lại.
- Input sai và clientOrderId trùng không làm đổi sổ.

Nếu tích hợp Market Data:
- Tắt generator ngẫu nhiên của sec-001.
- Mỗi execution chỉ cộng volume/value một lần.
- Bid/ask lấy từ sổ, có thể đổi dù không có execution.
- Không xây cơ chế outbox hôm nay.

Sau khi làm:
- Chạy kiểm thử phù hợp và báo kết quả thực tế.
- Giải thích từng execution trong fixture.
- Cập nhật README về API, cách demo và dữ liệu mất khi restart.
```

## Ngày 5 hoàn thành khi:

- [ ] Bạn tự tính được thứ tự khớp theo giá và thời gian.
- [ ] Một lệnh tạo được nhiều execution đúng giá, đúng khối lượng.
- [ ] Phần chưa khớp nằm lại đúng vị trí trong sổ.
- [ ] Engine xử lý đúng cả incoming BUY và incoming SELL.
- [ ] Các bất biến về khối lượng đều được kiểm thử.
- [ ] Bạn giải thích được vì sao một execution cập nhật hai phía nhưng khối lượng thị trường chỉ tính một lần.

Ngày 6 sẽ bổ sung **tài khoản, tiền và chứng khoán khả dụng**, để kiểm tra tài khoản có đủ tài sản trước khi cho lệnh đi tiếp.
