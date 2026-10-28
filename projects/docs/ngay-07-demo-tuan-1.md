# Ngày 7 — Demo tuần 1: bảng giá và giao dịch mô phỏng

## Phạm vi và luồng dữ liệu

Demo ghép Security Master, Market Session, Accounts, Matching Simulator và Market Data trong modular monolith. Dashboard hiển thị danh mục, phiên, bảng giá, sổ lệnh, executions và tài sản; kiểm tra tài sản là preview riêng, không phải gửi lệnh.

`sec-001 / SIMAAA / SIM_EQ_A` là mã duy nhất được Matching Simulator hỗ trợ. Matching là nguồn dữ liệu giao dịch của mã này: `PriceSimulator` ngày 3 vẫn còn trong mã để kiểm thử, nhưng không được khởi chạy bởi backend hiện tại.

Khi gửi lệnh LO:

1. Matching kiểm tra security và phiên `CONTINUOUS`, rồi xử lý lệnh trong engine bộ nhớ. Các submit được xử lý tuần tự trong một instance.
2. Market Data nhận các execution mới và sổ sau xử lý. Mỗi execution được cộng một lần vào volume/value; `lastPrice` và `lastQuantity` lấy từ execution cuối, OHLC được cập nhật theo giá execution.
3. Best bid/ask lấy từ sổ hiện tại, kể cả khi không có execution. Snapshot được lưu vào Redis rồi publish; gateway chuyển snapshot đầy đủ qua WebSocket.
4. Dashboard ghép quote theo `securityId` và thay toàn bộ snapshot, kể cả giá trị `null`. Sổ và executions được đọc qua REST, làm mới mỗi 2 giây; các panel có thể cập nhật lệch thời điểm so với quote.

Matching chưa gọi kiểm tra tài sản, chưa giữ tài sản và chưa thay đổi số dư. Mở tab hay reload dashboard chỉ đọc/subscribe, không tạo lệnh.

## Cấu hình và khởi tạo

Điều kiện môi trường và cài đặt chung xem [`../README.md`](../README.md). Ngày 7 không thêm migration MySQL; migration Security Master và Accounts trước đó tạo schema và fixture cần dùng. Chạy migration từ `projects/backend/`:

```bash
npm run migration:show
npm run migration:run
```

TypeORM theo dõi migration đã chạy; không chạy lại seed bằng cách xóa dữ liệu để demo. Kiểm tra fixture `acc-001` sau migration: `availableCash` là chuỗi `"6000000"`, `sec-001` có `availableQuantity=550`. Nếu fixture không đúng, kiểm tra trạng thái database và migration trước khi tiếp tục.

Trong `projects/backend/.env`, đặt thời gian và ngày snapshot thống nhất:

```dotenv
SIM_CLOCK_MODE=FIXED
SIM_NOW=2026-10-20T10:00:00+07:00
MARKET_DATA_TRADING_DATE=2026-10-20
```

`MARKET_DATA_TRADING_DATE` được cấu hình riêng, không tự suy ra từ `SIM_NOW`. Không ghi mật khẩu thật vào tài liệu. Khởi động MySQL, Redis, backend và frontend theo README chung; `redis-cli ping` phải trả `PONG`.

Khi backend khởi động, engine mới có sổ và executions rỗng. Nếu kết nối Redis và khởi tạo thành công, backend ghi snapshot rỗng vào đúng key `md:quote:2026-10-20:sec-001`, rồi publish; không xóa database hoặc toàn bộ Redis. Ban đầu `lastPrice`, `lastQuantity`, OHLC, best bid/ask là `null`; tổng volume/value là 0. Kiểm tra snapshot trước khi gửi lệnh, vì khởi tạo Redis diễn ra bất đồng bộ sau khi HTTP bắt đầu lắng nghe.

## Kịch bản chạy và kết quả

Mở dashboard tại `http://localhost:5173`, chờ danh mục, phiên và quote tải xong. Từ terminal khác:

```bash
cd projects/backend
npm run demo:week-one
```

Có thể đặt `SIMULATOR_API_URL` nếu backend không ở `http://localhost:3000`. Script kiểm tra health, security, phiên, fixture và preview tài sản; nó dừng nếu sổ hoặc executions không rỗng. Sau đó script gửi lần lượt:

| ID | Phía | Giá (đồng) | Số lượng |
| --- | --- | ---: | ---: |
| S1 | SELL | 24.900 | 40 |
| S2 | SELL | 25.000 | 100 |
| S3 | SELL | 25.100 | 50 |
| B1 | BUY | 25.000 | 100 |

Trước B1, sổ bán tốt nhất là `24.900 × 40`; chưa có execution nên `lastPrice=null` và `totalVolume=0`. B1 tạo `40 @ 24.900` và `60 @ 25.000`. Script đối chiếu các execution, sổ còn lại, quote và tài sản sau khớp; khi chờ quote, script polling tối đa 5 giây.

Snapshot mong đợi sau B1, lược bỏ metadata:

```json
{
  "securityId": "sec-001",
  "referencePrice": 25000,
  "lastPrice": 25000,
  "lastQuantity": 60,
  "totalVolume": 100,
  "totalValue": 2496000,
  "openPrice": 24900,
  "highPrice": 25000,
  "lowPrice": 24900,
  "bestBid": null,
  "bestAsk": { "price": 25000, "quantity": 40 }
}
```

Sổ bán còn `40 @ 25.000` và `50 @ 25.100`. Giá khớp cuối bằng giá tham chiếu nên hiển thị màu tham chiếu; `lastQuantity` là 60, còn tổng volume là 100. Tiền khả dụng vẫn `6.000.000` đồng và lượng có thể bán vẫn 550; đây không phải thanh toán cho B1.

Để chạy lại từ đầu, khởi động lại backend và chờ snapshot rỗng; không chạy script lần thứ hai trên engine cũ. Nếu script đã gửi một phần lệnh rồi thất bại, cũng cần khởi động lại phiên trước khi thử lại.

## API và đối chiếu thủ công

| Chức năng | Endpoint |
| --- | --- |
| Process / MySQL | `GET /health/live`, `GET /health/ready` |
| Danh mục / security | `GET /api/securities`, `GET /api/securities/sec-001` |
| Phiên | `GET /api/markets/SIM_EQ_A/session` |
| Tiền / positions | `GET /api/accounts/acc-001/balances`, `GET /api/accounts/acc-001/positions` |
| Preview tài sản | `POST /api/accounts/acc-001/availability-checks` |
| Đặt lệnh simulator | `POST /api/simulator/orders` |
| Sổ / executions | `GET /api/simulator/order-books/sec-001`, `GET /api/simulator/executions?securityId=sec-001` |
| Snapshot | `GET /api/market-data/quotes?securityIds=sec-001` |
| Realtime | WebSocket `/ws/market-data`, gửi `{"type":"subscribe","securityIds":["sec-001"]}` |

Ví dụ preview BUY và SELL, không làm thay đổi tài sản:

```bash
curl -X POST http://localhost:3000/api/accounts/acc-001/availability-checks \
  -H 'Content-Type: application/json' \
  -d '{"securityId":"sec-001","side":"BUY","orderType":"LO","price":25000,"quantity":100}'

curl -X POST http://localhost:3000/api/accounts/acc-001/availability-checks \
  -H 'Content-Type: application/json' \
  -d '{"securityId":"sec-001","side":"SELL","orderType":"LO","price":25000,"quantity":600}'
```

BUY trả `valid=true`, `requiredCash="2500000"`; SELL trả `valid=false`, `reasonCode=INSUFFICIENT_SECURITIES`, `shortfallQuantity=50`. Chi tiết hợp đồng Accounts và matching xem [ngày 6](./ngay-06-tai-khoan-va-tai-san-kha-dung.md) và [ngày 5](./ngay-05-matching-simulator.md).

Đối chiếu bằng REST:

```bash
curl 'http://localhost:3000/api/market-data/quotes?securityIds=sec-001,sec-005'
curl http://localhost:3000/api/simulator/order-books/sec-001
curl 'http://localhost:3000/api/simulator/executions?securityId=sec-001'
```

`sec-005` cùng symbol nhưng thuộc thị trường khác, không được nhận quote của `sec-001`; nếu chưa có quote, ID này nằm trong `missingQuoteSecurityIds`. Mở thêm tab và reload, rồi đọc lại executions: số lần khớp không được tăng.

## Kiểm thử và xử lý sự cố

```bash
cd projects/backend
npm test
npm run build
```

```bash
cd projects/frontend
npm run build
```

Kiểm thử `backend/tests/matching-simulator/matching-market-data.integration.test.ts` dùng fake store và kiểm tra quote trước/sau B1; không thay thế kiểm tra đầu-cuối với MySQL, Redis và trình duyệt thật. Khi đối chiếu giao diện với REST/WebSocket, chờ cập nhật với timeout hữu hạn.

| Triệu chứng | Cách kiểm tra |
| --- | --- |
| `/health/ready` lỗi | Kiểm tra MySQL, cấu hình và quyền kết nối; readiness chỉ kiểm tra MySQL, không chứng minh Redis sẵn sàng. |
| Quote thiếu hoặc Market Data lỗi | Kiểm tra Redis, log khởi tạo backend và key đúng ngày; sau khi Redis hoạt động, khởi động lại backend để bắt đầu phiên sạch. |
| Script báo sổ không rỗng | Khởi động lại backend, chờ snapshot rỗng rồi chạy lại; không xóa toàn bộ Redis/MySQL. |
| REST đúng nhưng UI chưa đúng | Kiểm tra WebSocket, map `securityId`, snapshot đầy đủ và đợi panel sổ/execution polling. |
| Submit báo lỗi sau khi đã xử lý | Kiểm tra sổ/executions trước khi thử lại; không tự động gửi lại lệnh vì engine có thể đã thay đổi. Khởi động lại phiên sạch nếu cần. |

## Giới hạn và demo 5 phút

Sổ, execution và ID lệnh chỉ tồn tại trong bộ nhớ một backend instance, mất khi restart. Không có transaction bao trùm matching và Redis; chưa có outbox/replay hoặc khôi phục lỗi giữa các bước. Chưa có OMS, giữ tài sản, settlement hoặc cập nhật số dư theo execution.

Để trình bày trong 5 phút: (1) giới thiệu `sec-001`, thị trường, clock và phiên; (2) xem số dư và chạy hai preview; (3) chạy script; (4) chỉ hai execution và sổ còn lại; (5) đối chiếu quote, đặc biệt `lastQuantity=60` và `totalVolume=100`; (6) giải thích số dư vẫn là fixture.
