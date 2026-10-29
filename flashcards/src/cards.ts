export type Card = {
  id: string
  topic: string
  question: string
  answer: string
  example?: string
  source: string
}

export const topics = ['Thị trường', 'Bảng giá', 'Phiên & lệnh', 'Tài sản', 'Danh mục & thanh toán'] as const

export const cards: Card[] = [
  { id: 'stock', topic: 'Thị trường', question: 'Cổ phiếu là gì?', answer: 'Cổ phiếu thể hiện quyền sở hữu một phần trong doanh nghiệp phát hành.', example: 'Người sở hữu cổ phiếu là cổ đông của doanh nghiệp.', source: 'ngay-02-security-master.md' },
  { id: 'bond', topic: 'Thị trường', question: 'Trái phiếu là gì?', answer: 'Trái phiếu thể hiện quan hệ nợ: tổ chức phát hành có nghĩa vụ với người sở hữu theo điều khoản trái phiếu.', source: 'ngay-02-security-master.md' },
  { id: 'etf', topic: 'Thị trường', question: 'ETF là gì?', answer: 'ETF là quỹ hoán đổi danh mục; người mua sở hữu chứng chỉ quỹ, không trực tiếp sở hữu từng chứng khoán trong danh mục quỹ.', source: 'ngay-02-security-master.md' },
  { id: 'secondary', topic: 'Thị trường', question: 'Thị trường thứ cấp là gì?', answer: 'Là nơi nhà đầu tư mua bán lại các chứng khoán đã được phát hành.', source: 'ngay-01-nen-mong.md' },
  { id: 'broker', topic: 'Thị trường', question: 'Công ty chứng khoán có vai trò gì?', answer: 'Cung cấp tài khoản, tiếp nhận và kiểm tra yêu cầu giao dịch của nhà đầu tư.', source: 'ngay-01-nen-mong.md' },
  { id: 'exchange', topic: 'Thị trường', question: 'Sở giao dịch có vai trò gì?', answer: 'Tổ chức giao dịch và xử lý lệnh trên thị trường.', source: 'ngay-01-nen-mong.md' },
  { id: 'vsdc', topic: 'Thị trường', question: 'VSDC có vai trò gì?', answer: 'Thực hiện các nghiệp vụ đăng ký, lưu ký, bù trừ và thanh toán chứng khoán.', source: 'ngay-01-nen-mong.md' },
  { id: 'symbol', topic: 'Thị trường', question: 'Mã chứng khoán (symbol) là gì?', answer: 'Là mã hiển thị dùng để nhận diện chứng khoán trên giao diện giao dịch.', example: 'Trong simulator, SIMAAA là một mã giả lập; ID nội bộ được dùng để nhận diện ổn định.', source: 'ngay-02-security-master.md' },
  { id: 'reference', topic: 'Bảng giá', question: 'Giá tham chiếu là gì?', answer: 'Là mức giá dùng để so sánh trong phiên giao dịch.', example: 'Trong simulator, giá tham chiếu được nhập sẵn; không tính theo quy định thị trường thực tế.', source: 'ngay-03-market-data-realtime.md' },
  { id: 'ceiling', topic: 'Bảng giá', question: 'Giá trần và giá sàn là gì?', answer: 'Giá trần là mức giá cao nhất, giá sàn là mức giá thấp nhất được phép theo cấu hình phiên.', example: 'Simulator nhập sẵn hai giá này, không tính theo quy định từng thị trường.', source: 'ngay-03-market-data-realtime.md' },
  { id: 'last', topic: 'Bảng giá', question: 'Giá khớp gần nhất là gì?', answer: 'Là giá của lần giao dịch khớp gần nhất; không đảm bảo bạn sẽ mua hoặc bán được tại giá đó.', source: 'ngay-03-market-data-realtime.md' },
  { id: 'bid', topic: 'Bảng giá', question: 'Giá mua tốt nhất là gì?', answer: 'Là mức giá mua cao nhất đang chờ trong sổ lệnh.', source: 'ngay-03-market-data-realtime.md' },
  { id: 'ask', topic: 'Bảng giá', question: 'Giá bán tốt nhất là gì?', answer: 'Là mức giá bán thấp nhất đang chờ trong sổ lệnh.', source: 'ngay-03-market-data-realtime.md' },
  { id: 'volume', topic: 'Bảng giá', question: 'Tổng khối lượng và khối lượng khớp gần nhất khác nhau thế nào?', answer: 'Tổng khối lượng là lượng đã khớp từ đầu phiên; khối lượng khớp gần nhất chỉ thuộc lần khớp mới nhất.', source: 'ngay-03-market-data-realtime.md' },
  { id: 'order', topic: 'Phiên & lệnh', question: 'Lệnh giao dịch (order) là gì?', answer: 'Là yêu cầu mua hoặc bán chứng khoán với các điều kiện cụ thể.', example: 'Mua 100 cổ phiếu với giá giới hạn 25.000 đồng.', source: 'ngay-01-nen-mong.md' },
  { id: 'execution', topic: 'Phiên & lệnh', question: 'Một lần khớp (execution) là gì?', answer: 'Là một kết quả khớp cụ thể của lệnh, với giá và khối lượng xác định. Một lệnh có thể có nhiều lần khớp.', source: 'ngay-01-nen-mong.md' },
  { id: 'lo', topic: 'Phiên & lệnh', question: 'Lệnh giới hạn LO là gì?', answer: 'Lệnh mua không cao hơn giá giới hạn hoặc lệnh bán không thấp hơn giá giới hạn do người dùng nhập.', example: 'Lệnh mua LO 25.000 đồng có thể khớp ở 24.900 đồng, nhưng không ở 25.100 đồng.', source: 'ngay-04-phien-giao-dich.md' },
  { id: 'ato', topic: 'Phiên & lệnh', question: 'Lệnh ATO là gì?', answer: 'Lệnh giao dịch tại giá khớp xác định mở cửa; người đặt không nhập giá giới hạn.', source: 'ngay-04-phien-giao-dich.md' },
  { id: 'atc', topic: 'Phiên & lệnh', question: 'Lệnh ATC là gì?', answer: 'Lệnh giao dịch tại giá khớp xác định đóng cửa; người đặt không nhập giá giới hạn.', source: 'ngay-04-phien-giao-dich.md' },
  { id: 'continuous', topic: 'Phiên & lệnh', question: 'Khớp lệnh liên tục là gì?', answer: 'Các lệnh được xét khớp với lệnh đối ứng khi được xử lý, theo các điều kiện khớp của hệ thống.', source: 'ngay-04-phien-giao-dich.md' },
  { id: 'periodic', topic: 'Phiên & lệnh', question: 'Khớp lệnh định kỳ là gì?', answer: 'Các lệnh được tập hợp để xác định giá khớp tại thời điểm của đợt; nhận lệnh không đồng nghĩa khớp ngay.', source: 'ngay-04-phien-giao-dich.md' },
  { id: 'book', topic: 'Phiên & lệnh', question: 'Sổ lệnh (order book) là gì?', answer: 'Là tập hợp các lệnh mua và bán đang chờ, được tổ chức theo phía và mức giá.', source: 'ngay-05-so-lenh-va-khop-lenh.md' },
  { id: 'priority', topic: 'Phiên & lệnh', question: 'Ưu tiên giá–thời gian nghĩa là gì?', answer: 'Lệnh có giá tốt hơn được ưu tiên trước; với cùng mức giá, lệnh đến trước được ưu tiên trước.', source: 'ngay-05-so-lenh-va-khop-lenh.md' },
  { id: 'partial', topic: 'Phiên & lệnh', question: 'Khớp một phần là gì?', answer: 'Chỉ một phần khối lượng lệnh đã được thực hiện; phần còn lại có thể tiếp tục chờ khớp hoặc được hủy.', source: 'ngay-05-so-lenh-va-khop-lenh.md' },
  { id: 'cancel', topic: 'Phiên & lệnh', question: 'Yêu cầu hủy có đồng nghĩa lệnh đã hủy?', answer: 'Không. Lệnh chỉ được xác nhận hủy khi có phản hồi hủy thành công; trong lúc chờ vẫn có thể phát sinh khớp.', source: 'ngay-08-oms-va-vong-doi-lenh.md' },
  { id: 'oms', topic: 'Phiên & lệnh', question: 'OMS là gì?', answer: 'Order Management System là hệ thống quản lý lệnh và vòng đời của lệnh, từ tiếp nhận đến các trạng thái kết thúc.', source: 'ngay-08-oms-va-vong-doi-lenh.md' },
  { id: 'account', topic: 'Tài sản', question: 'Tài khoản và tiểu khoản được dùng để làm gì?', answer: 'Tài khoản gắn với khách hàng; tiểu khoản là đơn vị quản lý tài sản và giao dịch theo chính sách của hệ thống.', source: 'ngay-06-tai-khoan-va-tai-san-kha-dung.md' },
  { id: 'available-cash', topic: 'Tài sản', question: 'Tiền khả dụng trong simulator được tính thế nào?', answer: 'Tiền đã thanh toán trừ tiền đang giữ, tiền mua phải trả và tiền bị phong tỏa.', example: 'Khoản tiền bán chờ nhận không tự động làm tăng tiền khả dụng trong mô hình này.', source: 'ngay-06-tai-khoan-va-tai-san-kha-dung.md' },
  { id: 'reserved', topic: 'Tài sản', question: 'Giữ tiền hoặc chứng khoán là gì?', answer: 'Là dành riêng tài sản để bảo đảm cho lệnh đang hoạt động, tránh sử dụng cùng tài sản cho nhiều lệnh.', source: 'ngay-24-tich-hop-risk-va-kiem-soat-tai-san-cho-ca-mua-lan-ban.md' },
  { id: 'available-stock', topic: 'Tài sản', question: 'Số lượng chứng khoán khả dụng để bán là gì?', answer: 'Trong simulator: số lượng đã thanh toán trừ lượng bán chờ thanh toán, đang giữ và bị phong tỏa.', example: 'Chứng khoán mua chờ nhận chưa mặc định được tính vào lượng có thể bán.', source: 'ngay-06-tai-khoan-va-tai-san-kha-dung.md' },
  { id: 'payable', topic: 'Tài sản', question: 'Tiền mua phải trả là gì?', answer: 'Là nghĩa vụ tiền phát sinh từ giao dịch mua đã khớp nhưng chưa được thanh toán.', source: 'ngay-10-giu-tien-va-so-cai-tien.md' },
  { id: 'ledger', topic: 'Tài sản', question: 'Sổ cái tiền dùng để làm gì?', answer: 'Ghi nhận các biến động tiền theo nghiệp vụ để có thể theo dõi và đối chiếu số dư.', source: 'ngay-10-giu-tien-va-so-cai-tien.md' },
  { id: 'portfolio', topic: 'Danh mục & thanh toán', question: 'Danh mục đầu tư là gì?', answer: 'Là tập hợp các vị thế chứng khoán của tài khoản, cùng thông tin như số lượng, giá vốn và giá trị định giá.', source: 'ngay-11-danh-muc-gia-von-va-lai-lo.md' },
  { id: 'average-cost', topic: 'Danh mục & thanh toán', question: 'Giá vốn bình quân là gì?', answer: 'Là giá vốn trung bình trên mỗi đơn vị chứng khoán của vị thế, được tính từ giá trị vốn và số lượng tương ứng.', source: 'ngay-11-danh-muc-gia-von-va-lai-lo.md' },
  { id: 'unrealized', topic: 'Danh mục & thanh toán', question: 'Lãi/lỗ chưa thực hiện là gì?', answer: 'Là chênh lệch giữa giá trị định giá hiện tại và giá vốn của vị thế còn nắm giữ; chưa phải kết quả của việc bán vị thế đó.', source: 'ngay-11-danh-muc-gia-von-va-lai-lo.md' },
  { id: 'margin', topic: 'Danh mục & thanh toán', question: 'Margin là gì?', answer: 'Là hình thức sử dụng vốn vay để giao dịch theo điều kiện và chính sách kiểm soát rủi ro của hệ thống.', source: 'ngay-12-margin-tai-san-bao-dam-va-suc-mua.md' },
  { id: 'collateral', topic: 'Danh mục & thanh toán', question: 'Tài sản bảo đảm trong margin là gì?', answer: 'Là tài sản được xét theo chính sách để bảo đảm cho khoản vay và đánh giá năng lực giao dịch.', source: 'ngay-12-margin-tai-san-bao-dam-va-suc-mua.md' },
  { id: 'settlement', topic: 'Danh mục & thanh toán', question: 'Thanh toán chứng khoán khác khớp lệnh thế nào?', answer: 'Khớp lệnh xác lập giao dịch và phát sinh nghĩa vụ; thanh toán thực hiện nghĩa vụ tiền và chứng khoán đó.', source: 'ngay-13-thanh-toan-va-doi-soat.md' },
  { id: 't2', topic: 'Danh mục & thanh toán', question: 'T+2 trong simulator được hiểu thế nào?', answer: 'Là chu kỳ hai ngày làm việc theo lịch giả lập, không phải cộng 48 giờ vào thời điểm giao dịch.', example: 'Simulator xử lý nghĩa vụ riêng và chưa mô phỏng đầy đủ bù trừ đa phương thực tế.', source: 'ngay-13-thanh-toan-va-doi-soat.md' },
  { id: 'reconciliation', topic: 'Danh mục & thanh toán', question: 'Đối soát là gì?', answer: 'Là việc so sánh các nguồn dữ liệu hoặc báo cáo để phát hiện giao dịch thiếu, thừa hoặc sai khác.', source: 'ngay-13-thanh-toan-va-doi-soat.md' },
]
