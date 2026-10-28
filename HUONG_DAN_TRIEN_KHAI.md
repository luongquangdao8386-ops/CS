# Hướng dẫn triển khai Checksheet — bản 1.0.0-d1.1 (bản đầu, dựng THỬ trước)

Checksheet là app riêng, máy chủ riêng (dự án Apps Script riêng, bảng tính riêng), chỉ **đọc** danh sách thiết bị và khu vực từ M&E.
Cách làm giống hệt M&E: dán `Code.gs` vào Apps Script, triển khai web app, mở trang app trên GitHub Pages.

## Hai môi trường

| | THỬ (làm trước) | THẬT (sau khi nói "phát hành THẬT") |
| --- | --- | --- |
| Dự án Apps Script | `CS_MayChu_THU`, thuộc tính `ENV = THU` | `CS_MayChu_THAT`, `ENV = THAT` |
| Thư mục Drive tự tạo | `CS_HeThong_THU` | `CS_HeThong` |
| Lấy thiết bị từ | M&E THỬ (`ME_MayChu_THU`) | M&E THẬT (`ME_MayChu_THAT`) |
| Trang app | <https://luongquangdao8386-ops.github.io/CS/> — dán link `/exec` THỬ ở màn đăng nhập | `/CS/` cố định link THẬT; trang thử riêng `/CS-thu/` (repo `CS-thu`, như `ME-thu`) |

App THỬ có nhãn vàng **THỬ** trên đầu màn hình; tên trên iPhone là "Checksheet THỬ".

---

## Phần A — Bật trang app (GitHub Pages, làm một lần)

1. Claude đẩy nhánh `main` của repo `CS` (Claude hỏi trước khi đẩy).
2. <https://github.com/luongquangdao8386-ops/CS> → **Settings → General → Default branch** → đổi sang `main` (lúc đầu GitHub lấy nhánh đẩy đầu tiên `claude/checksheet-d1`).
3. **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main`, thư mục `/ (root)` → **Save**.
4. Chờ 2–3 phút → mở <https://luongquangdao8386-ops.github.io/CS/> → thấy màn đăng nhập có biểu tượng bảng kẹp vàng.

## Phần B — Dựng máy chủ THỬ (`CS_MayChu_THU`)

1. <https://script.google.com> → **Dự án mới** → đổi tên thành `CS_MayChu_THU`.
2. **Cài đặt dự án** (bánh răng bên trái):
   - tích **Hiển thị tệp kê khai "appsscript.json" trong trình chỉnh sửa**;
   - **Múi giờ**: `(GMT+07:00) Giờ Đông Dương - Hồ Chí Minh` (hoặc Bangkok);
   - **Thuộc tính tập lệnh → Thêm thuộc tính**: `ENV` = `THU` → **Lưu**.
3. **Trình chỉnh sửa** (`<>`):
   - tệp `appsscript.json` → Ctrl+A → xóa → dán nội dung link raw `https://raw.githubusercontent.com/luongquangdao8386-ops/CS/main/apps-script/appsscript.json`;
   - tệp `Code.gs` → Ctrl+A → xóa → mở link raw `https://raw.githubusercontent.com/luongquangdao8386-ops/CS/main/apps-script/Code.gs` → Ctrl+A → Ctrl+C → dán vào → **Lưu** (Ctrl+S).
   - (Chưa có `main` thì thay `main` trong hai link bằng `claude/checksheet-d1`.)
4. Ô chọn hàm → **`setup`** → **Chạy** → Google hỏi quyền: **Xem lại quyền** → chọn tài khoản → **Nâng cao** → **Đi tới CS_MayChu_THU (không an toàn)** → **Cho phép**.
   Nhật ký thực thi: `Xong setup. ENV=THU. Đã tạo 19 sheet…` và `Đã cài trigger: syncMachinesHourly, runBackgroundJobs, backupData`.
5. **Cài đặt dự án → Thuộc tính tập lệnh** → thêm 3 thuộc tính:
   - `SETUP_OWNER_CODE` = mã nhân viên của anh (vd `NV001`);
   - `SETUP_OWNER_NAME` = tên hiển thị;
   - `SETUP_OWNER_TEMP_PIN` = 6 số tạm (không dùng dãy dễ đoán như 123456, 111111, ngày sinh).
6. Chọn hàm **`adminSetupOwner`** → **Chạy** → nhật ký `Đã tạo owner …`. Ba thuộc tính trên tự xóa.
7. **Triển khai → Tùy chọn triển khai mới** → bánh răng → **Ứng dụng web** → Mô tả `THỬ d1.1` → Thực thi với tư cách **Tôi** → Người có quyền truy cập **Bất kỳ ai** → **Triển khai** → chép **URL ứng dụng web** (đuôi `/exec`).
8. Kiểm tra: cửa sổ ẩn danh → dán link `/exec` thêm `?action=system.health` → thấy `"ok":true`.

## Phần C — Đăng nhập lần đầu (owner, trên máy tính)

1. Mở <https://luongquangdao8386-ops.github.io/CS/> → cuối màn đăng nhập bấm **Địa chỉ máy chủ (/exec)** → dán link `/exec` THỬ → **Lưu**.
2. Nhập mã owner + PIN tạm → app bắt **đổi PIN** → đặt PIN mới 6 số.
3. Vào app thấy nhãn **THỬ**. **Tài khoản → Quản trị → Trạng thái hệ thống** → dòng `app_base_url` → **Sửa** → `https://luongquangdao8386-ops.github.io/CS/` → PIN.
4. Muốn khỏi dán link ở mỗi máy: gửi link `/exec` THỬ cho Claude để cố định trong trang thử (chỉ gửi link `/exec`, không gửi PIN hay mã nào khác).

## Phần D — Nối M&E THỬ (lấy thiết bị, khu vực)

Làm theo **Phần U** trong hướng dẫn của M&E (máy chủ M&E THỬ cần bản `1.0.0-d4.12` — đã có trên `ME-thu/main`):

1. Dự án `ME_MayChu_THU` → dán `Code.gs` từ `https://raw.githubusercontent.com/luongquangdao8386-ops/ME-thu/main/apps-script/Code.gs` → **Lưu** → **Triển khai → Quản lý các bản triển khai** → bút chì → **Phiên bản mới** → **Triển khai** (link M&E giữ nguyên).
2. Bên M&E chọn hàm **`adminCreateFeedKey`** → **Chạy** → chép mã kết nối trong nhật ký.
3. Chép link `/exec` của **M&E THỬ**.
4. **Checksheet → Tài khoản → Quản trị → Kết nối M&E** → dán link `/exec` M&E và mã kết nối → **Lưu và lấy danh sách** → PIN → báo số thiết bị vừa lấy.
5. **Thiết bị** (web: menu trái; iPhone: Tài khoản → Công việc → Thiết bị) → thấy danh sách máy của M&E. Từ đây Checksheet tự cập nhật mỗi giờ; sửa thiết bị thì sửa ở M&E.

## Phần E — (Tùy chọn) Dữ liệu mẫu để thử nhanh

Dùng khi muốn thử app trước khi nối M&E. **Làm trước Phần D**, vì khi đã nối M&E, lần cập nhật sau sẽ ngừng các máy mẫu (không có bên M&E).

**Tài khoản → Quản trị → Dữ liệu mẫu → Tạo dữ liệu mẫu** → PIN → tạo 3 khu vực, 5 máy (TB-0007, TB-0008, TB-0012, TB-0031, TB-0102), 3 mẫu (theo ca / ngày / tuần) đã gán máy, 3 tài khoản mẫu `MAU-KT` (Người kiểm), `MAU-C3` (Trưởng bộ phận), `MAU-C1` (Tra cứu) — PIN tạm hiện **một lần**, chép lại ngay.

## Phần F — Thiết lập để dùng

1. **Giờ ca**: Tài khoản → Quản trị → **Giờ ca** (mặc định Ca 1 06:00–14:00, Ca 2 14:00–22:00, Ca 3 22:00–06:00). Ngày làm việc bắt đầu lúc vào Ca 1; ca qua nửa đêm tính vào ngày bắt đầu ca.
2. **Người dùng**: Quản trị → **Người dùng → Thêm người dùng**: mã nhân viên, tên, cấp (**Người kiểm** nhập checksheet · **Trưởng bộ phận** xử lý Không đạt, xác nhận ngày, sửa mẫu · **Tra cứu** chỉ xem · **Quản trị**), **khu vực phụ trách** (bỏ trống = mọi khu vực) → **Lưu** → PIN → PIN tạm hiện một lần, đưa tận tay người đó.
3. **Mẫu checksheet** (web dễ làm hơn): **Mẫu checksheet → Mẫu mới** → tên (một thứ tiếng là đủ, máy chủ tự dịch) → tần suất (mỗi ca / ngày / tuần / tháng) và ca → **Thêm từ thư viện** (tích các hạng mục) → mở từng hạng mục **sửa tiêu chuẩn theo tài liệu của máy** (tiêu chuẩn trong thư viện chỉ là ví dụ) → **Lưu** → **Gán cho máy** (chọn nhiều máy một lần).
4. **Tiêu chuẩn riêng của một máy** (vd máy cũ chạy nóng hơn): **Thiết bị → máy → Tiêu chuẩn riêng**.
5. **Logo công ty trên báo cáo**: Quản trị → **Logo trên báo cáo** → chọn ảnh PNG/JPG → xem mẫu → **Lưu** → PIN. Thay logo: làm lại bước này lúc nào cũng được. Logo chỉ hiện trên báo cáo (PDF, Excel, bản xem trước).
6. **iPhone**: mở link app bằng **Safari** → **Chia sẻ → Thêm vào MH chính** → mở từ biểu tượng → dán link `/exec` (nếu chưa cố định) → đăng nhập.

## Phần G — Thử trên THỬ

1. iPhone, tài khoản Người kiểm: **Hôm nay** hiện đúng ca và các máy phải kiểm theo khu vực; **Quét** tem QR M&E dán trên máy → mở thẳng phiếu của máy đó.
2. Nhập số đo: ô đổi màu ngay khi gõ (xanh Đạt, vàng Cần chú ý, đỏ Không đạt) và báo thấp/cao hơn tiêu chuẩn bao nhiêu; dòng 3 pha tự tính lệch pha; mục Không đạt bắt buộc ghi chú, **Chụp ảnh** được → **Lưu**.
3. Bật **chế độ máy bay** → kiểm một máy → **Lưu** → phiếu hiện "Đã lưu trên máy, chờ gửi" → tắt chế độ máy bay → app tự gửi, báo "Đã lưu máy chủ".
4. Tài khoản Trưởng bộ phận: **Chờ xử lý** → Không đạt → **Đã xử lý** (ghi cách xử lý); **Bỏ sót** → **Ghi lý do** hoặc **Kiểm bù** (trong 7 ngày); **Xác nhận ngày** → PIN → lượt kiểm ngày đó khóa sửa.
5. **Bảng tháng**: iPhone là lịch tô màu theo ngày, chạm ngày xem chi tiết; web là bảng hạng mục × ngày như phiếu giấy, bấm một dòng số đo để xem biểu đồ.
6. **Báo cáo** → chọn máy, tháng → **Tải PDF** (logo đầu trang, bảng từng ca, bất thường, khối ký) và **Tải Excel**.
7. Chụp màn hình chỗ chưa ưng gửi Claude.

## Phần H — Cập nhật máy chủ khi có bản mới

1. Dán `Code.gs` mới (link raw Claude gửi) vào dự án → **Lưu**.
2. Nếu ghi chú bản mới có thêm sheet/cột: chọn hàm **`migrateSchema`** → **Chạy**.
3. **Triển khai → Quản lý các bản triển khai** → bút chì → **Phiên bản mới** → **Triển khai** (link `/exec` giữ nguyên).
4. App trên GitHub Pages tự cập nhật; máy đang mở app bấm **Tải lại bản mới** nếu được hỏi.

## Phần I — Lên THẬT (sau khi nói "phát hành THẬT")

1. M&E THẬT phải có bản `1.0.0-d4.12` (phát hành M&E trước, theo Phần U của M&E).
2. Làm lại **Phần B** với dự án `CS_MayChu_THAT`, `ENV = THAT`; triển khai lấy link `/exec` THẬT.
3. Gửi link `/exec` THẬT cho Claude: Claude cố định link trong `config.js` của repo `CS` và dựng trang thử riêng `CS-thu` (anh tạo repo trống `CS-thu`, public, rồi báo Claude).
4. **Phần C, D, F** trên THẬT (không có Dữ liệu mẫu ở THẬT). Tải lại logo trên THẬT.

## Lưu ý an toàn

- **Mã kết nối M&E** giống mật khẩu: chỉ dán ở màn Kết nối M&E. Lộ mã: bên M&E xóa thuộc tính `FEED_KEY_CS` → chạy lại `adminCreateFeedKey` → nhập mã mới bên Checksheet.
- Không chia sẻ, không sửa tay hai bảng tính `CS_NghiepVu` / `CS_BaoMat` trong thư mục `CS_HeThong`.
- **Owner quên PIN**: Thuộc tính tập lệnh thêm `OWNER_RESET_TEMP_PIN` = 6 số → chạy **`adminResetOwnerPin`** → đăng nhập bằng PIN tạm và đổi ngay.
- **Sao lưu** tự động hằng tuần (Chủ nhật 1 giờ, giữ 8 bản trong `CS_Backups`); **Quản trị → Sao lưu → Sao lưu ngay** trước khi sửa lớn.
- **Bảo trì** (tạm dừng ghi): chạy `adminMaintenanceOn` / `adminMaintenanceOff`.
- **Kiểm tra sức khỏe**: chạy `healthCheck` hoặc Quản trị → **Trạng thái hệ thống** (kết nối M&E, trigger, sao lưu, số ô bảng tính).
- Lượt kiểm giữ trên điện thoại 40 ngày gần nhất; tháng cũ hơn xem ở Bảng tháng/Báo cáo khi có mạng.
