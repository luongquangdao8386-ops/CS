# Checksheet · 点检表

App kiểm tra thiết bị hằng ngày (checksheet): Google Sheets + Apps Script (máy chủ) + PWA trên GitHub Pages (iPhone và máy tính).
Cùng bố cục, màu sắc và lõi đăng nhập/đồng bộ với app M&E. Giao diện luôn song ngữ Việt · 中文. Đăng nhập bằng mã nhân viên + PIN 6 số.

**Trạng thái:** bản `1.0.0-d1.1` — bản đầu, đang chờ dựng máy chủ THỬ.

## App làm gì

- **Thiết bị và khu vực lấy một chiều từ M&E** (cửa chỉ-đọc `feed.equipment` của M&E, mỗi giờ hoặc bấm *Cập nhật từ M&E*). Thiết bị chỉ sửa ở M&E. Tem QR M&E đang dán trên máy quét được luôn trong Checksheet.
- **Mẫu checksheet** có phiên bản: tần suất mỗi ca / ngày / tuần / tháng; hạng mục lấy từ thư viện (~34 hạng mục có sẵn: nhiệt độ, áp suất, điện áp, dòng 3 pha, độ rung, mức dầu, rò rỉ…) hoặc tự thêm. Kiểu tiêu chuẩn: khoảng, tối đa, tối thiểu, định mức ± %, không có; ngưỡng *Cần chú ý*; dòng 3 pha tự tính lệch pha. Tiêu chuẩn riêng cho từng máy.
- **Màn kiểm**: tiêu chuẩn hiện ngay cạnh ô nhập, gõ tới đâu tô màu tới đó (Đạt / Cần chú ý / Không đạt), Không đạt bắt buộc ghi chú, chụp ảnh. Mất mạng vẫn lưu trên máy, có mạng tự gửi. Máy chủ đánh giá lại khi lưu và lưu kèm tiêu chuẩn lúc kiểm.
- **Trưởng bộ phận**: mục Không đạt chờ xử lý, máy bỏ sót kỳ kiểm (ghi lý do), xác nhận ngày (khóa sửa). Mỗi người chỉ thấy khu vực mình phụ trách.
- **Bảng tháng** (lịch trên iPhone, bảng như phiếu giấy + biểu đồ xu hướng trên web) và **báo cáo** mỗi máy mỗi tháng: PDF (máy chủ dựng, logo công ty ở đầu trang) và Excel (có logo).

## Cấu trúc

| Thư mục | Nội dung |
| --- | --- |
| `index.html`, `config.js`, `sw.js`, `manifest.webmanifest`, `css/`, `js/` | App tĩnh (GitHub Pages, phạm vi `/CS/`, trang thử `/CS-thu/`) |
| `js/judge.js` | Đánh giá Đạt/Chú ý/Không đạt, ca, kỳ — cùng quy tắc với `server/src/17_judge.js` (test đối chiếu) |
| `assets/` | Biểu tượng app (bảng kẹp + dấu tick, SVG và PNG 180/192/512), ảnh nền |
| `vendor/` | jsQR 1.4.0 (quét QR), SheetJS 0.20.3 (Excel) |
| `server/src/` | Mã máy chủ theo mô-đun |
| `apps-script/` | `Code.gs` (tạo bằng `npm run build`) và `appsscript.json` để dán vào Apps Script |
| `i18n/labels.json` | Từ điển nhãn duy nhất [Việt, 中文] → `js/dict.js` và `LABELS` trong `Code.gs` |
| `tests/` | Giả lập Apps Script cho Node, test máy chủ, test giao diện Playwright |
| `tools/` | Ghép `Code.gs`, quét bí mật trước khi push |

## Lệnh

```
npm run build        # ghép server/src → apps-script/Code.gs, sinh js/dict.js, kiểm phiên bản khớp 4 nơi
npm test             # test máy chủ + đối chiếu app/máy chủ + đủ nhãn song ngữ
npm run test:ui      # test giao diện 390×844 và 1440×900 (cần Playwright)
npm run check        # build + test + quét bí mật
```

Triển khai: xem `HUONG_DAN_TRIEN_KHAI.md`.

## Quy ước

- Repo public: không commit ID bảng tính, link `/exec` thật (trừ `config.js`), dữ liệu, PIN, khóa bí mật, logo công ty. Bí mật nằm trong Thuộc tính tập lệnh của Apps Script.
- Mọi tên lưu trữ trình duyệt có tiền tố `cs` (IndexedDB `cs_*`, Cache `cs-*`, localStorage `cs.*`; trang THỬ `cs_thu`) — chung origin `github.io` với M&E (`me*`) mà không đụng nhau.
- Biểu tượng app chỉ ở biểu tượng iPhone, màn đăng nhập và trang Hôm nay. Logo công ty chỉ ở báo cáo (PDF, Excel, bản xem trước) — quản trị tải lên trong app, lưu riêng tư trên Drive.
- Phiên bản phải khớp ở `package.json`, `server/src/00_config.js`, `config.js`, `sw.js` (build kiểm). Thêm tệp js mới thì thêm vào `FILES` của `sw.js`.
