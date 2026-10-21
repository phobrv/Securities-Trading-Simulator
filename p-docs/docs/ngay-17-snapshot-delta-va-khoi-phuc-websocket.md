# Ngày 17 — Snapshot, delta và khôi phục WebSocket

Ngày 3 đã có bảng giá realtime. Hôm nay bạn xử lý trường hợp khó hơn:

> “Client mất một bản tin hoặc vừa reconnect. Làm sao biết dữ liệu đang đúng và đồng bộ lại mà không bị giá cũ ghi đè?”

Bạn sẽ bổ sung **sequence, nhận diện luồng dữ liệu, phát hiện khoảng trống và quy trình lấy lại snapshot**.

Môi trường giữ nguyên: **Node.js + TypeScript, Redis, Vue 3 + TypeScript + Tailwind CSS, MySQL và OpenCode**.

---

## 1. Mục tiêu và thời gian học

| Thời gian | Nội dung | Kết quả |
|---|---|---|
| 30 phút nghiệp vụ | Dữ liệu đứng yên, mất kết nối và dữ liệu thiếu | Phân biệt các trạng thái |
| 30 phút kỹ thuật | Snapshot, delta, sequence và đồng bộ | Có giao thức nhất quán |
| 30–60 phút thực hành | Chủ động bỏ bản tin và reconnect | Client tự khôi phục đúng |

**Sản phẩm cuối buổi:**

- Snapshot đi kèm phiên bản dữ liệu.
- Delta có sequence theo từng chứng khoán.
- Client bỏ bản tin cũ, phát hiện thiếu bản tin.
- Reconnect luôn đồng bộ lại.
- Snapshot đến muộn không ghi đè trạng thái mới.
- UI phân biệt kết nối WebSocket với tình trạng dữ liệu.

Hôm nay khôi phục **trạng thái giá mới nhất**, chưa xây lịch sử để phát lại toàn bộ tick đã bỏ lỡ.

---

## 2. Nghiệp vụ — 30 phút

### 2.1. Bảng giá đứng yên có thể là hành vi đúng

| Tình huống | Có thể không có giá mới? | UI cần thể hiện |
|---|---|---|
| Không có giao dịch mới | Có | Giá gần nhất vẫn giữ nguyên |
| Nghỉ trưa hoặc đóng cửa | Có | Trạng thái phiên |
| WebSocket mất kết nối | Có | Mất kết nối |
| Client bỏ lỡ bản tin | Có | Đang đồng bộ lại |
| Backend không đọc được Redis | Có | Dữ liệu chưa xác minh được |

Không kết luận mất dữ liệu chỉ vì `lastPrice` không đổi.

Ngược lại, WebSocket còn mở cũng chưa chứng minh bảng giá đã nhận đủ dữ liệu. `readyState = OPEN` chỉ mô tả trạng thái kết nối. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState?utm_source=chatgpt.com)

### 2.2. Snapshot là gì?

Snapshot là trạng thái đầy đủ của một chứng khoán tại một phiên bản:

```text
Snapshot sequence 100:
lastPrice = 25.000
totalVolume = 1.000
bestBid = ...
bestAsk = ...
```

Client có thể dùng nó làm điểm bắt đầu mà không cần biết 99 phiên bản trước.

### 2.3. Delta là gì?

Delta chỉ chứa phần thay đổi so với phiên bản trước.

Ví dụ:

```json
{
  "changes": {
    "lastPrice": 25100,
    "lastQuantity": 40,
    "totalVolume": 1040
  }
}
```

Quy ước của bài học: **các giá trị trong `changes` là giá trị mới tuyệt đối**.

```text
totalVolume = 1040
```

Không có nghĩa:

```text
totalVolume += 1040
```

### 2.4. Không được áp dụng delta khi thiếu dữ liệu nền

Giả sử:

```text
Client có sequence 100.
Bỏ lỡ 101.
Nhận 102.
```

Delta 102 có thể chỉ thay đổi dư bán. Nếu áp dụng ngay, client vẫn giữ giá khớp và tổng khối lượng cũ từ 100.

Vì vậy:

```text
Thiếu sequence
→ Ngừng áp dụng delta
→ Lấy snapshot mới
→ Tiếp tục từ phiên bản phù hợp
```

---

## 3. Thiết kế phiên bản dữ liệu

### 3.1. Sequence phải có phạm vi rõ ràng

Trong demo, mỗi luồng được xác định bằng:

```text
securityId + tradingDate + streamId
```

| Trường | Ý nghĩa |
|---|---|
| `securityId` | Chứng khoán |
| `tradingDate` | Ngày phiên theo backend |
| `streamId` | Thế hệ của luồng dữ liệu |
| `sequence` | Số phiên bản trong luồng đó |

Ví dụ:

```json
{
  "securityId": "sec-001",
  "tradingDate": "2026-10-23",
  "streamId": "stream-a",
  "sequence": 100
}
```

Không dùng sequence chung cho mọi chứng khoán rồi bắt client đăng ký một mã phải nhận đủ toàn bộ sequence đó.

### 3.2. Ai tăng sequence?

Market Data tăng sequence **một lần cho mỗi thay đổi trạng thái được công bố**.

Không tăng theo:

- Số client.
- Số tab.
- Số lần subscribe.
- Số lần client gọi snapshot.

Một lần thay đổi dư mua/bán cũng có thể tạo sequence mới, dù không phát sinh execution.

### 3.3. Khi backend khởi tạo lại nguồn dữ liệu

Nếu trạng thái nguồn bị khởi tạo lại và sequence bắt đầu lại, phải cấp `streamId` mới.

Không cho client hiểu nhầm:

```text
Luồng cũ sequence 500.
Luồng mới sequence 1.
```

là một bản tin cũ của cùng luồng.

Client chỉ chấp nhận thế hệ mới sau khi thực hiện lại quy trình subscribe và snapshot. Không lấy một delta khác `streamId` làm lý do xóa dữ liệu ngay.

---

## 4. Contract snapshot và delta

### 4.1. Snapshot

Mở rộng response Market Data ngày 3:

```json
{
  "type": "quote.snapshot",
  "securityId": "sec-001",
  "tradingDate": "2026-10-23",
  "streamId": "stream-a",
  "sequence": 100,
  "quote": {
    "referencePrice": 25000,
    "ceilingPrice": 27000,
    "floorPrice": 23000,
    "lastPrice": 25000,
    "lastQuantity": 100,
    "totalVolume": 1000,
    "totalValue": 25000000,
    "openPrice": 25000,
    "highPrice": 25000,
    "lowPrice": 25000,
    "bestBid": {
      "price": 24900,
      "quantity": 200
    },
    "bestAsk": {
      "price": 25100,
      "quantity": 300
    },
    "updatedAt": "2026-10-23T03:00:00Z",
    "source": "SIMULATOR"
  }
}
```

Các trường tiền tệ, đơn vị giá và kiểu dữ liệu tiếp tục giữ đúng contract đã thống nhất.

### 4.2. Delta

```json
{
  "type": "quote.delta",
  "securityId": "sec-001",
  "tradingDate": "2026-10-23",
  "streamId": "stream-a",
  "previousSequence": 100,
  "sequence": 101,
  "changes": {
    "lastPrice": 25100,
    "lastQuantity": 40,
    "totalVolume": 1040,
    "totalValue": 26004000,
    "highPrice": 25100,
    "updatedAt": "2026-10-23T03:00:02Z"
  }
}
```

Điều kiện áp dụng:

```text
Cùng securityId, tradingDate, streamId.
previousSequence = sequence hiện tại của client.
sequence = previousSequence + 1.
```

**Quy tắc patch:**

- Không có trường: giữ giá trị cũ.
- Có trường bằng `null`: thay bằng `null`.
- `bestBid` và `bestAsk` được thay nguyên object, không merge từng thuộc tính.

Ví dụ:

```json
{
  "changes": {
    "bestAsk": null
  }
}
```

nghĩa là hiện không còn mức bán tốt nhất.

---

## 5. Redis và nguồn snapshot

Giữ key ngày 3:

```text
md:quote:<tradingDate>:<securityId>
```

Nhưng giá trị phải chứa **cả metadata phiên bản và quote trong cùng một JSON**.

```text
{
  securityId,
  tradingDate,
  streamId,
  sequence,
  quote
}
```

Không lưu sequence và quote bằng hai thao tác độc lập khiến REST đọc được:

```text
sequence mới + quote cũ
```

Trong demo một backend:

1. Xử lý cập nhật nối tiếp cho từng chứng khoán.
2. Tính snapshot và delta tương ứng.
3. Lưu snapshot đầy đủ vào Redis.
4. Publish delta.
5. Gateway chuyển delta cho các subscription phù hợp.

Redis Pub/Sub có cơ chế giao nhận at-most-once; subscriber mất kết nối có thể bỏ lỡ thông báo và không được phát lại từ channel. Vì vậy, Redis key lưu snapshot vẫn cần thiết. [Docs](https://redis.io/docs/latest/develop/use-cases/pub-sub/?utm_source=chatgpt.com)

Chưa triển khai nhiều publisher cùng ghi một chứng khoán hoặc một lịch sử replay bền vững.

---

## 6. Quy trình subscribe không làm mất bản tin giữa hai bước

### 6.1. Cách dễ gây lỗi

```text
GET snapshot sequence 100.
Có update 101.
Client chưa subscribe.
Client subscribe.
Nhận update 102.
```

101 bị mất giữa hai thao tác.

### 6.2. Quy trình hôm nay

**Bước 1 — Chuẩn bị nhận bản tin**

Client đăng ký message handler và bật chế độ đệm.

**Bước 2 — Gửi subscribe**

```json
{
  "type": "subscribe",
  "subscriptionId": "sub-001",
  "securityIds": ["sec-001"]
}
```

Gateway đăng ký subscription trước khi trả ACK. Kết nối Redis subscriber của gateway phải sẵn sàng.

**Bước 3 — Nhận ACK**

```json
{
  "type": "subscribed",
  "subscriptionId": "sub-001",
  "streams": [
    {
      "securityId": "sec-001",
      "tradingDate": "2026-10-23",
      "streamId": "stream-a"
    }
  ]
}
```

**Bước 4 — Lấy snapshot**

Sau ACK, client gọi REST snapshot cho luồng đang theo dõi:

```http
GET /api/market-data/quotes?securityIds=sec-001
```

Trong lúc chờ REST, tiếp tục đệm delta.

**Bước 5 — Áp dụng snapshot và buffer**

Ví dụ snapshot trả sequence 105:

```text
Bỏ delta cùng luồng có sequence <=105.
Áp dụng 106, 107… nếu liên tiếp.
Nếu thiếu 106 nhưng có 107 → lấy lại snapshot.
```

Nếu snapshot không khớp thế hệ luồng đã được ACK, bắt đầu một vòng subscribe/sync mới.

**Bước 6 — Chuyển sang LIVE**

Chỉ báo đồng bộ khi có snapshot hợp lệ và phần buffer được áp dụng liên tục.

---

## 7. State machine phía client

Dùng hai nhóm trạng thái riêng.

**Kết nối:**

```text
DISCONNECTED
CONNECTING
CONNECTED
```

**Đồng bộ dữ liệu theo từng chứng khoán:**

```text
NO_DATA
SYNCING
LIVE
STALE
ERROR
```

Ví dụ:

```text
WebSocket: CONNECTED.
sec-001: SYNCING.
sec-003: NO_DATA.
```

Không cần làm toàn bảng thành lỗi chỉ vì một mã chưa có snapshot.

**Quy tắc xử lý delta khi LIVE:**

| Trường hợp | Xử lý |
|---|---|
| Sequence bằng hoặc thấp hơn hiện tại, cùng luồng | Bỏ qua |
| Sequence kế tiếp, previousSequence khớp | Áp dụng |
| Sequence nhảy cóc | Chuyển SYNCING, đệm và tải snapshot |
| Stream hoặc ngày phiên thay đổi | Bắt đầu đồng bộ luồng mới |
| Payload không hợp lệ | Không áp dụng; báo lỗi hoặc đồng bộ lại |

---

## 8. Snapshot đến muộn và request cũ

Sequence chưa đủ để xử lý mọi race condition.

Client cần thêm:

```text
connectionGeneration
syncGeneration theo từng mã
```

Ví dụ:

```text
Lần sync A bắt đầu.
Lần sync B bắt đầu sau đó.
Snapshot B về trước.
Snapshot A về sau.
```

Kết quả A phải bị bỏ vì không thuộc vòng sync hiện tại.

Các nguyên tắc:

- Snapshot cùng luồng có sequence thấp hơn trạng thái đã áp dụng không được làm dữ liệu lùi.
- Callback từ WebSocket cũ không được cập nhật store của kết nối mới.
- Request snapshot cũ nên được hủy bằng `AbortController`, đồng thời vẫn kiểm tra generation.
- Mỗi mã chỉ có một tác vụ sync đang hoạt động.
- Buffer phải có giới hạn, ví dụ 200 bản tin mỗi mã.

Nếu buffer tràn, bỏ vòng sync đó và lấy lại snapshot; không tiếp tục tăng bộ nhớ vô hạn.

---

## 9. Phát hiện bản tin cuối bị mất

Nếu mất 101 rồi nhận 102, sequence giúp phát hiện khoảng trống.

Nhưng nếu mất 101 và sau đó thị trường không có update nữa thì sao?

Bổ sung heartbeat ứng dụng, ví dụ mỗi 5 giây:

```json
{
  "type": "market-data.heartbeat",
  "serverSentAt": "2026-10-23T03:00:10Z",
  "heads": [
    {
      "securityId": "sec-001",
      "tradingDate": "2026-10-23",
      "streamId": "stream-a",
      "sequence": 101
    }
  ]
}
```

Gateway lấy head từ snapshot Redis hiện tại, không chỉ báo sequence cuối mà chính gateway đã nhận qua Pub/Sub.

Nếu client đang ở 100 mà heartbeat báo 101:

```text
Chuyển SYNCING.
Lấy snapshot mới.
```

Nếu Redis không đọc được, gateway không được tuyên bố dữ liệu đã cập nhật đầy đủ.

**Phân biệt đồng hồ:**

- Market Clock: thời điểm nghiệp vụ của phiên.
- Transport clock/timer: heartbeat, timeout và reconnect.
- Auth Clock: hiệu lực token ngày 16.

Không dùng Market Clock cố định để đo timeout mạng. Một quote có thể giữ nguyên `updatedAt` trong lúc không có giao dịch mà kết nối vẫn khỏe.

---

## 10. Reconnect và Vue 3

Khi mất kết nối:

1. Đánh dấu `DISCONNECTED`.
2. Giữ giá cuối để người dùng còn xem được, kèm trạng thái chưa xác minh.
3. Reconnect với backoff có giới hạn.
4. Tạo connection generation mới.
5. Subscribe và lấy snapshot lại.
6. Chuyển LIVE khi đồng bộ hoàn tất.

Ví dụ backoff:

```text
0,5 giây → 1 → 2 → 4 → tối đa 10 giây.
```

Có thể thêm jitter để nhiều client không reconnect cùng lúc.

Cấu trúc Vue 3:

```text
src/market-data/
  market-data.client.ts
  quote-sync.reducer.ts
  quote.store.ts
  useMarketData.ts
```

Reducer xử lý phiên bản dữ liệu; component chỉ đọc store và render.

`onMounted`/`onUnmounted` và watcher trong composable phải dọn socket, listener, timer và request. Thiếu cleanup dễ tạo kết nối hoặc vòng lặp reconnect trùng. [Vue](https://vuejs.org/guide/essentials/lifecycle.html)

Giữ chính sách ngày 16: nếu socket hiện chỉ phân phối quote công khai, không tự nhét dữ liệu tài khoản vào cùng channel mà bỏ qua authorization.

---

## 11. Bài thực hành chính

Dùng test fixture Market Data; không cần tạo giao dịch tài sản mới cho từng tình huống mạng.

**Kịch bản A — mất một delta**

```text
Snapshot 100.
Phát 101.
Chủ động bỏ 101 trên đường gửi tới một client.
Phát 102.
```

Kỳ vọng:

```text
Client không áp dụng 102 trên nền100.
Phát hiện gap.
Lấy snapshot >=102.
Đồng bộ lại đúng.
```

**Kịch bản B — snapshot và delta chạy đua**

```text
Client đã subscribe.
REST snapshot bị trì hoãn.
Server phát thêm delta.
REST trả về.
```

Kỳ vọng: buffer được lọc và áp dụng đúng; không mất update giữa subscribe và snapshot.

**Kịch bản C — mất update cuối cùng**

```text
Client có100.
Bỏ101.
Không phát102.
Heartbeat báo head101.
```

Kỳ vọng: client vẫn phát hiện cần sync.

**Kịch bản D — backend khởi tạo luồng mới**

```text
Luồng cũ: stream-a, sequence100.
Luồng mới: stream-b, sequence1.
```

Kỳ vọng: client lấy snapshot của stream mới thay vì bỏ mọi bản tin vì sequence thấp.

**Kịch bản E — hai tab**

Chỉ bỏ bản tin của tab A.

- Tab A đồng bộ lại.
- Tab B tiếp tục bình thường.
- Không tạo thêm publisher hoặc bộ sinh giá.

Công cụ bỏ/trì hoãn bản tin chỉ bật trong demo hoặc test; giữ kiểm soát OPS nếu có endpoint điều khiển.

---

## 12. Kiểm thử bắt buộc

| Kiểm thử | Điều cần chứng minh |
|---|---|
| Delta kế tiếp | Áp dụng đúng |
| Delta cũ hoặc trùng | Không làm trạng thái lùi |
| Thiếu sequence | Không áp dụng patch sai nền |
| `bestAsk: null` | Xóa mức bán cũ |
| Snapshot cũ về sau | Không ghi đè trạng thái mới |
| Delta trong lúc tải snapshot | Được đệm và xử lý đúng |
| Reconnect | Luôn subscribe/snapshot lại |
| Thay stream | Không so sequence giữa hai thế hệ |
| Mất update cuối | Heartbeat head phát hiện |
| Buffer tràn | Có giới hạn và resync |
| Redis lỗi | Không báo đồng bộ giả |
| Vue unmount | Dọn socket, timer và request |
| Không có giao dịch mới | Không tự kết luận mất dữ liệu |

Không cần thêm bảng MySQL trong ngày 17. Phiên bản và snapshot nằm trong luồng Market Data/Redis; log ghi được lý do resync như `SEQUENCE_GAP`, `STREAM_CHANGED`, `HEARTBEAT_HEAD_AHEAD`.

---

## 13. Prompt cho OpenCode

```text
Tôi đang học ngày 17 của Securities Trading Simulator:
Snapshot, delta và khôi phục WebSocket.

Môi trường:
- Node.js + TypeScript, Redis, Vue 3 + TypeScript + Tailwind CSS, MySQL.
- OpenCode, cấu hình model hiện tại.
- Giữ Market Data ngày 3 và authorization ngày 16.

Trước khi code:
1. Đọc snapshot Redis, publisher, WebSocket gateway và Vue composable.
2. Tìm race giữa subscribe và snapshot.
3. Xác định publisher và connection cleanup hiện tại.
4. Đề xuất phạm vi 30–60 phút.

Phạm vi:
- Một backend/publisher cho mỗi chứng khoán trong demo.
- Khôi phục trạng thái mới nhất bằng snapshot.
- Chưa có durable replay toàn bộ tick.
- Không thêm message broker hoặc bảng MySQL mới.

Versioning:
- Scope: securityId + tradingDate + streamId.
- Sequence tăng một lần mỗi quote state update,
  không theo client/tab/subscription.
- Khởi tạo lại nguồn và reset sequence phải đổi streamId.
- Snapshot lưu metadata và quote trong cùng JSON Redis.
- Các update của cùng mã được xử lý nối tiếp.

Delta:
- type quote.delta.
- Có securityId, tradingDate, streamId,
  previousSequence, sequence, changes.
- Changes là giá trị tuyệt đối.
- Trường vắng giữ nguyên; null xóa giá trị.
- bestBid/bestAsk thay nguyên object.
- Không cộng lại totalVolume từ snapshot/delta.

Backend:
1. Tính snapshot và delta từ cùng update.
2. Lưu snapshot Redis thành công rồi publish delta.
3. Gateway Redis subscriber phải sẵn sàng trước ACK subscription.
4. Subscription có subscriptionId.
5. ACK xác định stream của từng mã.
6. Không tạo publisher/subscriber Redis mới cho mỗi tab.

Sync protocol:
- Client đăng ký handler và bật buffer trước subscribe.
- Gateway gắn subscription trước ACK.
- Sau ACK client lấy REST snapshot.
- Buffer delta trong lúc chờ.
- Snapshot phải khớp luồng hiện tại.
- Bỏ delta <= snapshot.sequence cùng luồng.
- Chỉ áp dụng chuỗi liên tiếp.
- Có gap thì tải snapshot lại, không patch trên nền thiếu.
- Giữ REST contract cũ nếu cần tương thích, nhưng bổ sung
  version metadata rõ ràng.

Client:
- Tách connection state và sync state từng security.
- Có connectionGeneration và syncGeneration.
- Ignore callback/request cũ.
- Abort snapshot request cũ và vẫn kiểm tra generation.
- Không cho snapshot cùng stream sequence thấp làm rollback.
- Stream/ngày đổi phải fresh subscribe/sync;
  không adopt từ một delta lạ.
- Một sync task mỗi mã.
- Buffer giới hạn200 bản tin/mã.
- Overflow hoặc lỗi sync: bounded retry/resnapshot.
- Không có dữ liệu khác với giá0.

Heartbeat:
- Mỗi5 giây gửi head của các mã đã subscribe.
- Head đọc từ snapshot Redis hiện tại,
  không chỉ từ delta gateway đã nhận.
- Head cao hơn client hoặc stream khác thì resync.
- Redis lỗi không báo dữ liệu đầy đủ.
- Đo heartbeat/reconnect bằng transport clock thực/monotonic,
  không dùng Fixed Market Clock.
- Không coi thiếu giao dịch mới là mất kết nối.

Reconnect:
- Backoff0.5,1,2,4... tối đa10 giây, có jitter nếu phù hợp.
- Reconnect tạo generation mới, subscribe và snapshot lại.
- Cleanup socket/listener/timer/request khi unmount.
- Vòng đời component/composable không để lại kết nối hoặc timer trùng.

Authorization:
- Giữ policy quote công khai hiện có nếu đã chọn như vậy.
- Không đưa dữ liệu tài khoản vào public quote socket.
- Công cụ fault injection chỉ local/test hoặc OPS theo ngày16.

Tests:
- Normal next delta.
- Duplicate/old delta.
- Missing delta.
- bestAsk=null.
- Snapshot cũ về sau snapshot mới.
- Delta xuất hiện trong lúc fetch snapshot.
- Reconnect.
- Stream reset.
- Drop update cuối, heartbeat phát hiện.
- Buffer overflow.
- Redis unavailable.
- Hai tab, chỉ một tab mất bản tin.
- Không update khi không có giao dịch vẫn giữ trạng thái đúng.

Sau khi làm:
- Chạy kiểm tra phù hợp và báo kết quả thực tế.
- Cập nhật README về protocol và giới hạn replay.
- Log lý do resync có cấu trúc.
- Chứng minh reconnect không làm giá mới bị ghi đè bởi dữ liệu cũ.
```

**Ngày 17 hoàn thành khi:**

- [ ] Sequence có phạm vi rõ ràng.
- [ ] Client không áp dụng delta trên trạng thái thiếu bản tin.
- [ ] Subscribe và snapshot không để hở khoảng mất dữ liệu.
- [ ] Snapshot cũ hoặc callback cũ không làm giá lùi.
- [ ] Reconnect và thay stream đều khôi phục đúng.
- [ ] Mất bản tin cuối cũng được phát hiện.
- [ ] UI phân biệt kết nối, đồng bộ và phiên giao dịch.

Ngày 18 sẽ chuyển sang **sự kiện nghiệp vụ, retry và chống xử lý trùng**, bảo đảm giao lại execution không làm tiền hoặc chứng khoán tăng thêm lần nữa.
