# Hướng dẫn triển khai Checksheet — bản 1.0.0-d1.5 (d1.1 THỬ chạy và phát hành THẬT 28/10/2026; d1.2 bộ mẫu theo biểu ISO 30/10/2026; d1.3 bộ mẫu hằng ngày 7 loại máy; d1.4 số tiêu chuẩn đề xuất; d1.5 xóa hẳn mẫu)

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

## Phần I — Lên THẬT — đã xong 28/10/2026 (M&E THẬT 1.0.0-d4.12, `CS_MayChu_THAT`, trang `/CS/` dùng THẬT; còn trang thử `/CS-thu/` chờ repo `CS-thu`)

1. M&E THẬT phải có bản `1.0.0-d4.12` (phát hành M&E trước, theo Phần U của M&E).
2. Làm lại **Phần B** với dự án `CS_MayChu_THAT`, `ENV = THAT`; triển khai lấy link `/exec` THẬT.
3. Gửi link `/exec` THẬT cho Claude: Claude cố định link trong `config.js` của repo `CS` và dựng trang thử riêng `CS-thu` (anh tạo repo trống `CS-thu`, public, rồi báo Claude).
4. **Phần C, D, F** trên THẬT (không có Dữ liệu mẫu ở THẬT). Tải lại logo trên THẬT.

## Phần J — Bản 1.0.0-d1.2: bộ mẫu theo biểu ISO cơ điện (BM-CĐ-xx)

Thêm nút **Mẫu checksheet → Tạo bộ mẫu theo biểu ISO**: 23 mẫu soạn sẵn từ 21 biểu kiểm tra định kỳ trong bộ biểu ISO cơ điện
(03-04, 07-01/02/03/04/06/07/10/11, 08-12, 09-10/11/12, 10-02/03/04, 11-03/04/07, 13-01/02; biểu 07-06 và 07-07 mỗi biểu hai mẫu).
Mỗi mẫu mang **mã biểu mẫu** in trên PDF/Excel Bảng tháng (khối thông tin bên phải, tiêu đề từng mẫu, chân trang). Mẫu tự soạn
cũng nhập được mã ở ô **Mã biểu mẫu ISO** trong màn sửa mẫu.

Bản này đổi mã máy chủ, làm lần lượt trên **THỬ** (`CS_MayChu_THU`) rồi **THẬT** (`CS_MayChu_THAT`):

1. **Quản trị → Sao lưu → Sao lưu ngay** (cho chắc).
2. Mở dự án Apps Script → xóa hết `Code.gs` cũ → dán `Code.gs` mới (link raw Claude gửi) → **Lưu**.
3. Chọn hàm **`migrateSchema`** → **Chạy**. Nhật ký phải có: `Thêm: Templates(form_code)`. Chạy lại lần hai báo `Thêm: không có` là đúng.
4. **Triển khai → Quản lý các bản triển khai** → bút chì → **Phiên bản mới** → **Triển khai** (link `/exec` giữ nguyên).
5. Trên app (Trưởng bộ phận hoặc Quản trị): **Mẫu checksheet → Tạo bộ mẫu theo biểu ISO** → bỏ chọn biểu không dùng → **Tạo các mẫu đã chọn** → nhập PIN.
   Mẫu đã tạo hiện **Đã tạo · MS-xxxx**, bấm lại không tạo trùng (kể cả mẫu đã ngừng dùng).
6. Mở từng mẫu → **Gán cho máy**. Ô tiêu chuẩn để trống "……" trên biểu (theo nhà sản xuất) đang là *Không đặt*:
   đặt ở mẫu (áp cho mọi máy) hoặc **Thiết bị → Tiêu chuẩn riêng** (từng máy).
7. Biểu kiểm theo **khu vực / nhóm** (khu vực kỹ thuật 09-12, bình chữa cháy 10-02, sprinkler – họng nước 10-03, đèn sự cố 10-04,
   kho hóa chất 11-07, kính – nhựa cứng 13-01/02…): Checksheet chỉ gán mẫu cho *thiết bị lấy từ M&E*, nên tạo bên M&E một thiết bị
   đại diện (vd "Khu vực kỹ thuật – Xưởng A", "Bình chữa cháy – Xưởng A") → **Cập nhật từ M&E** → gán mẫu.
8. Kiểm thử: **Báo cáo** → chọn máy đã gán mẫu ISO → **Tải PDF** → thấy *Mã biểu mẫu: BM-CĐ-…* ở góc phải và chân trang.

Nếu bấm *Tạo bộ mẫu* mà app báo **Máy chủ chưa chạy migrateSchema** → làm lại bước 3 rồi bước 4.

## Phần K — Bản 1.0.0-d1.3: bộ mẫu hằng ngày cho 7 loại máy, bỏ mục "nếu có" theo từng máy

Thêm nút **Mẫu checksheet → Tạo bộ mẫu hằng ngày**: 7 mẫu kiểm **mỗi ngày**, làm cùng cách bộ mẫu ISO (mã cố định, chọn để tạo, không tạo trùng):

| Mã | Mẫu | Hạng mục |
| --- | --- | --- |
| HN-01 | Máy phát điện (lúc máy đứng chờ) | 11 |
| HN-02 | Phòng điện | 10 |
| HN-03 | Máy nén khí | 10 |
| HN-04 | Máy sấy lạnh | 6 |
| HN-05 | Máy sấy hấp thụ | 8 |
| HN-06 | Chiller | 12 |
| HN-07 | Hệ bơm chiller (gán cho từng bơm) | 9 |

- Mẫu ISO vẫn giữ. Máy phát: mẫu ngày (đứng chờ) và mẫu ISO 07-06 (chạy thử tuần/tháng) gán cùng một máy được.
  Phòng điện, máy nén khí, chiller: mỗi máy nên gán **một** trong hai (mẫu ngày *hoặc* mẫu ISO theo ca 07-01 / 07-02 / 07-04), tránh ghi hai lần.
- **[Mức]** (dầu nhớt, nước làm mát, dầu máy nén) là ô chọn **Đủ** (Đạt) / **Thấp** (Cần chú ý) / **Dưới min** (Không đạt).
- Tiêu chuẩn "theo nhà sản xuất / cài đặt / thiết kế / định mức" để **Không đặt** (chỉ hiện chữ). Các số đề xuất (nhiên liệu ≥ 50 %,
  phòng điện ≤ 35 °C, điện áp 380 V ± 5 %, cos φ ≥ 0,9, phòng máy nén ≤ 40 °C, điểm sương ≤ 10 °C / ≤ −40 °C…) sửa được ở mẫu
  (áp cho mọi máy) hoặc **Thiết bị → máy → Tiêu chuẩn riêng** (từng máy, đổi được cả đơn vị, vd dòng máy nén chiller theo **%** tải).
- **Lưu ý điện áp**: 380 V ± 5 % = 361–399 V. Tủ tổng lưới 400 V thường đo 400–410 V → sẽ báo Không đạt. Khi đó sửa ở mẫu HN-02
  (hạng mục *Điện áp thanh cái tổng* → Định mức 400) hoặc ở Tiêu chuẩn riêng của từng phòng điện.
- **Mục "(nếu có)"** (nước giải nhiệt và dàn ngưng của chiller; biến tần và tháp giải nhiệt của bơm) không bắt buộc. Máy không có:
  **Thiết bị → máy → Tiêu chuẩn riêng** → tích **Máy này không có** ở mục đó → **Lưu**. Mục đó biến mất khỏi phiếu kiểm, Bảng tháng,
  PDF/Excel của máy đó và không làm phiếu thành "Chưa đủ". Bỏ tích là hiện lại. (Cũng dùng được cho mục "nếu có" của mẫu ISO.)
- Đổi sang kiểm **theo ca** sau này: mở mẫu → **Tần suất: Mỗi ca** → chọn ca → **Lưu** (từ hôm đó bảng tháng tách theo ca).

### Cập nhật máy chủ (không thêm sheet/cột — không cần migrateSchema)

Làm lần lượt trên **THỬ** (`CS_MayChu_THU`) rồi **THẬT** (`CS_MayChu_THAT`):

1. **Quản trị → Sao lưu → Sao lưu ngay**.
2. Mở dự án Apps Script → xóa hết `Code.gs` cũ → dán `Code.gs` mới (link raw Claude gửi) → **Lưu**.
3. **Triển khai → Quản lý các bản triển khai** → bút chì → **Phiên bản mới** → **Triển khai** (link `/exec` giữ nguyên).
4. Trên app: **Mẫu checksheet → Tạo bộ mẫu hằng ngày** → bỏ chọn mẫu không dùng → **Tạo các mẫu đã chọn** → PIN → mở từng mẫu → **Gán cho máy**.
   App báo **Máy chủ chưa có bộ mẫu này** → máy chủ chưa dán Code.gs mới hoặc chưa tạo Phiên bản mới (làm lại bước 2–3).

### Khai phòng điện và bơm bên M&E để gán mẫu

Checksheet chỉ gán mẫu cho **thiết bị lấy từ M&E**. Phòng điện và từng bơm phải là thiết bị trong M&E:

1. **M&E** → **Thiết bị** → thêm thiết bị mới, mỗi dòng dưới đây là **một thiết bị**:
   - Phòng điện: một thiết bị cho mỗi phòng điện (nếu một phòng có hai tủ tổng từ hai máy biến áp thì mỗi tủ tổng một thiết bị, vì điện áp/dòng đo theo tủ).
     Tên vd `Phòng điện – Xưởng A` / `配电室–A车间`; **khu vực** = khu vực có phòng điện; loại vd *Tủ điện*.
   - Bơm: mỗi bơm một thiết bị, vd `Bơm nước lạnh CHWP-1`, `Bơm nước lạnh CHWP-2`, `Bơm giải nhiệt CWP-1` (khu vực = phòng chiller / phòng bơm);
     ghi model, công suất, dòng định mức trên nhãn động cơ vào thông tin thiết bị để tra khi đặt tiêu chuẩn.
   - Trạng thái **đang dùng** (thiết bị ngừng / thanh lý thì Checksheet tự ẩn).
2. In **tem QR M&E** của thiết bị, dán ở cửa phòng điện / thân bơm → bấm **Quét** trên Checksheet mở thẳng phiếu kiểm.
3. **Checksheet → Thiết bị → Cập nhật từ M&E** (hoặc chờ tối đa 1 giờ) → thiết bị mới hiện trong danh sách.
4. **Mẫu checksheet** → mở **HN-02 Phòng điện** → **Gán cho máy** → chọn các phòng điện. Mở **HN-07 Hệ bơm chiller** → **Gán cho máy** → chọn tất cả bơm một lần.
5. **Thiết bị → từng máy → Tiêu chuẩn riêng**:
   - Phòng điện: *Dòng điện tổng* → **Dùng tiêu chuẩn riêng** → *Không quá* = dòng định mức tủ (A); lệch pha giữ 10 %.
   - Bơm: *Dòng điện động cơ* → *Không quá* = dòng định mức trên nhãn; *Áp suất hút / đẩy* → *Trong khoảng* theo thiết kế.
     Bơm không có biến tần → tích **Máy này không có** ở *Biến tần*; bơm nước lạnh (không cấp tháp) → tích **Máy này không có** ở *Tháp giải nhiệt*.
   - Bơm dự phòng đang đứng: vẫn kiểm mục "Bơm chạy; bơm dự phòng ở AUTO"; số đo bỏ trống và ghi chú "dự phòng" (phiếu hiện *Chưa đủ*).

## Phần L — Bản 1.0.0-d1.4: số tiêu chuẩn đề xuất cho bộ mẫu hằng ngày (vượt là báo đỏ)

Các mục số trước để "theo nhà sản xuất / cài đặt / thiết kế" nay có **số đề xuất** (người dùng duyệt 05/11/2026). Gõ số vượt tiêu chuẩn
thì ô tô **đỏ** (Không đạt, bắt buộc ghi chú, vào Chờ xử lý), vào vùng Cần chú ý thì tô **vàng**. Số nào cũng sửa được ở mẫu hoặc
**Tiêu chuẩn riêng** của từng máy.

| Mẫu | Hạng mục | Tiêu chuẩn (vàng = Cần chú ý) |
| --- | --- | --- |
| HN-01 Máy phát | Điện áp ắc quy | 24 – 28,8 V, vàng ≤ 25 V (máy ắc quy 12 V: đặt riêng 12 – 14,4 V) |
| HN-02 Phòng điện | Nhiệt độ phòng · cos φ | ≤ 35 °C (vàng ≥ 32) · ≥ 0,9 (vàng ≤ 0,92) |
| HN-03 Máy nén khí | Áp suất khí ra · nhiệt độ đầu nén · phòng máy | 6 – 8 bar (vàng ≤ 6,3) · 70 – 100 °C (vàng ≥ 95) · ≤ 40 °C (vàng ≥ 37) |
| HN-04 Máy sấy lạnh | Điểm sương | ≤ 10 °C (vàng ≥ 7) |
| HN-05 Máy sấy hấp thụ | Áp suất tháp làm việc | 6 – 8 bar |
| HN-06 Chiller | Nước lạnh vào · ra | 10 – 13 °C · 6 – 8 °C |
| HN-06 Chiller | Nước giải nhiệt vào · ra | ≤ 32 °C · ≤ 37 °C |
| HN-06 Chiller | Dòng máy nén | ≤ 100 % tải (vàng ≥ 95 %); máy hiện A: đặt riêng đơn vị A |

**Mục phải đặt theo từng máy** (không có số chung): dòng điện tổng phòng điện (định mức tủ), áp suất hút/đẩy môi chất chiller
(theo loại gas), áp suất hút/đẩy và dòng động cơ của bơm. Màn kiểm hiện chữ cam **Chưa đặt tiêu chuẩn**, thẻ mẫu ở màn máy hiện
**"N mục chưa đặt tiêu chuẩn"** cho tới khi Trưởng bộ phận đặt ở **Thiết bị → máy → Tiêu chuẩn riêng** (tích *Dùng tiêu chuẩn riêng* →
chọn kiểu → nhập số → Lưu). Gas thường gặp, áp suất đồng hồ (bar): R134a hút 1,8 – 3,5 · đẩy 6 – 13; R410A hút 6,5 – 9,5 · đẩy 20 – 34;
R22/R407C hút 3,8 – 5,5 · đẩy 12 – 19 — đối chiếu tài liệu chiller trước khi đặt. Số giờ chạy là số cộng dồn nên chỉ ghi.

Sửa thêm: tiêu chuẩn riêng của máy là **trọn bộ** — ô Cần chú ý để trống ở máy thì máy đó không có ngưỡng Cần chú ý (trước đây lấy
ngưỡng của mẫu dù ô để trống). Trong ô sửa hạng mục của mẫu có thêm tích **Mỗi máy phải đặt số (theo nhãn máy)** (khi Kiểu tiêu chuẩn
là *Chỉ ghi số*).

### Cập nhật (không cần migrateSchema)

1. **THẬT** (`CS_MayChu_THAT`) rồi **THỬ** (`CS_MayChu_THU`): **Sao lưu ngay** → dán `Code.gs` mới → **Lưu** → **Triển khai → Quản lý các bản
   triển khai** → bút chì → **Phiên bản mới** → **Triển khai**.
2. App: **Tải lại bản mới** → **Mẫu checksheet → Tạo bộ mẫu hằng ngày**. Mẫu đã tạo ở bản d1.3 hiện **"N mục có số đề xuất mới"** →
   bấm **Cập nhật tiêu chuẩn đề xuất (… mẫu)** → PIN. Chỉ điền mục còn *Không đặt* và ngưỡng Cần chú ý còn trống — số anh/chị đã sửa giữ
   nguyên; mẫu lên phiên bản mới, máy đã gán và tiêu chuẩn riêng giữ nguyên; lượt kiểm cũ giữ tiêu chuẩn lúc kiểm.
3. **Thiết bị** → từng phòng điện, chiller, bơm có chữ cam *N mục chưa đặt tiêu chuẩn* → **Tiêu chuẩn riêng** → đặt số.

## Phần M — Bản 1.0.0-d1.5: Xóa hẳn mẫu

Màn **Mẫu checksheet** có nút đỏ **Xóa hẳn mẫu…** (chọn một hoặc nhiều mẫu) và trong từng mẫu có nút **Xóa hẳn mẫu**.
App hỏi máy chủ đếm trước những gì sẽ bị xóa rồi mới cho xác nhận:

| Mẫu | Ai xóa được | Xác nhận | Bị xóa theo |
| --- | --- | --- | --- |
| Chưa có lượt kiểm, bất thường, lý do bỏ sót | Trưởng bộ phận, Quản trị | PIN | Mẫu, mọi phiên bản hạng mục, phần gán máy |
| Đã có lượt kiểm | Chỉ chủ hệ thống (owner) | Gõ chữ **XÓA** + PIN | Như trên + lượt kiểm, bất thường, lý do bỏ sót, ảnh (tệp ảnh trên Drive vào thùng rác, lấy lại được 30 ngày) |

- Hộp xác nhận ghi rõ số lượt kiểm / bất thường (còn mở bao nhiêu) / lý do bỏ sót / ảnh và ngày đầu – ngày cuối của dữ liệu, lần sao lưu gần
  nhất, nút **Mở Sao lưu**. Nên **Sao lưu ngay**, đợi báo *Đã kiểm chứng* rồi mới xóa (bản sao lưu không chứa ảnh).
- Có người vừa kiểm thêm sau lúc xem → máy chủ từ chối, app cho xem lại số mới.
- Chỉ xóa đúng các mẫu đã chọn; mẫu khác, lượt kiểm của mẫu khác không đổi. **Mã MS đã xóa không cấp lại** (mẫu mới lấy số tiếp theo).
  Bộ mẫu soạn sẵn (ISO, hằng ngày) đã xóa thì tạo lại được, mang mã MS mới.
- Điện thoại đang mở app: lần đồng bộ tới (mở lại app, quay lại tab, bấm Đồng bộ ngay) tự tải lại dữ liệu và bỏ mẫu đã xóa —
  **không phải đăng nhập lại**, cả máy chưa tải bản app mới. Phiếu đang chờ gửi của mẫu đã xóa sẽ bị từ chối (*Máy chưa được gán mẫu này*) →
  xóa nháp đó ở **Nháp chờ gửi**.
- Nhật ký (Quản trị → Nhật ký, nhóm Mẫu checksheet) ghi `template.purge` kèm mã, tên và số dòng đã xóa của từng mẫu.

### Cập nhật (không cần migrateSchema)

1. **THẬT** (`CS_MayChu_THAT`) rồi **THỬ** (`CS_MayChu_THU`): **Sao lưu ngay** → dán `Code.gs` mới → **Lưu** → **Triển khai → Quản lý các bản
   triển khai** → bút chì → **Phiên bản mới** → **Triển khai**.
2. Nói "phát hành Checksheet" để đẩy app lên `main` → mở app → **Tải lại bản mới**.
3. Xóa 9 mẫu hằng ngày chạy thử MS-0001 → MS-0009: đăng nhập owner → **Mẫu checksheet → Xóa hẳn mẫu…** → tích MS-0001 … MS-0009 →
   **Tiếp** → xem số đếm → gõ **XÓA** → **Xóa hẳn 9 mẫu** → PIN.

## Phần N — Bản 1.0.0-d1.6: rà soát lỗi (lưu nhanh khi dữ liệu nhiều, bỏ sót đúng hơn)

Không thêm màn mới; sửa các lỗi tìm được khi rà soát cả app:

| Lỗi | Trước | Sau |
| --- | --- | --- |
| Lưu phiếu chậm dần | Mỗi lần lưu, máy chủ đọc lại **từng lượt kiểm cũ** của máy đó (mẫu theo ca: thêm ~1 000 lần đọc mỗi năm) — vài tháng là lưu mất hàng chục giây, người khác bị *Máy chủ đang bận* | Chỉ đọc đúng lượt cùng kỳ; không tăng theo số lượt cũ. Lý do bỏ sót cũng vậy |
| Đồng bộ, Bảng tháng, PDF chậm dần | Mỗi lần đồng bộ đọc **cả bảng lượt kiểm** (khoảng 200 lượt là bộ nhớ đệm hết tác dụng); Bảng tháng/PDF tháng cũ đọc mọi lượt của máy | Chỉ đọc lượt mới đổi / lượt trong 40 ngày / lượt của đúng tháng |
| Nhật ký chậm | *Nhật ký của tôi* đọc từng dòng nhật ký; Quản trị → Nhật ký đọc cả bảng | Chỉ đọc các dòng gần nhất |
| Bỏ sót sai khi **ngừng mẫu** hoặc **máy ngừng sử dụng** (M&E) | Bảng tháng và PDF tô "–" mọi ngày sau khi ngừng | Không tính bỏ sót (như Chờ xử lý và lịch tuần) |
| Bỏ sót sai khi **gán lại** máy đã ngừng gán, **dùng lại** mẫu đã ngừng | Những ngày đã ngừng thành "bỏ sót" (Chờ xử lý bắt ghi lý do, PDF tô "–") | Tính kỳ từ ngày gán lại / dùng lại. Đổi lại: kỳ bỏ sót *trước lúc ngừng* trong tháng đó không còn tô "–" |
| Bớt ca trong **Giờ ca** (vd 3 ca → 2 kíp 12 giờ) | Mẫu "ca 1, 2, 3" vẫn còn ca 3 ma: mỗi ngày báo bỏ sót ca 3, Bảng tháng/PDF có bảng ca 3 trống | Ca không còn trong Giờ ca thì không tính; lượt kiểm cũ của ca đó vẫn hiện |
| Số ngày **ghi bù** | App luôn cho 7 ngày dù Cấu hình `check_backdate_days` khác → phiếu bị từ chối hoặc không ghi bù được | App theo đúng Cấu hình |
| **Đổi kỳ** | Chọn được kỳ chưa bắt đầu (vd ca 3 lúc đang ca 1) và lưu trước | Kỳ chưa bắt đầu chỉ xem (cho sớm tối đa 15 phút) |
| `runs_sync_days` < 31 | Đầu tháng hiện "bỏ sót" sai vì máy không còn lượt kiểm cũ | Hỏi máy chủ; ngày xem lại bỏ sót không vượt số ngày giữ trên máy |
| **Khu vực phụ trách** chỉ do app ẩn đi | Quét tem máy khu vực khác vẫn mở và kiểm được; điện thoại tải về dữ liệu mọi khu vực | Máy chủ chặn: lượt kiểm, ảnh, xử lý Không đạt, lý do bỏ sót, gán mẫu, Bảng tháng, PDF của máy ngoài khu vực (*Máy này không thuộc khu vực bạn phụ trách*). Điện thoại chỉ nhận máy, lượt kiểm… của khu vực mình |
| Bảng phiên đăng nhập, nhật ký đăng nhập, thao tác tăng mãi | Không bao giờ dọn | Tự dọn mỗi ngày (trong trigger `runBackgroundJobs`): phiên hết hạn/thu hồi quá 30 ngày, nhật ký đăng nhập quá `auth_attempts_retention_days` (90 ngày), thao tác đã ghi xong quá 90 ngày. **Nhật ký thao tác (AuditLogs) giữ nguyên** |

**Lưu ý về khu vực:** người được gán khu vực (Tài khoản → Quản trị → Người dùng → *Khu vực phụ trách*) từ bản này **không kiểm được máy
khu vực khác, kể cả khi quét tem**. Ai đi kiểm thay ở khu vực khác thì thêm khu vực đó cho họ, hoặc để trống (= mọi khu vực).
Người không gán khu vực (owner, quản trị) không đổi gì. Khi M&E chuyển máy sang khu vực khác, điện thoại tự tải lại dữ liệu một lần.

### Cập nhật (không cần migrateSchema)

1. **THẬT** (`CS_MayChu_THAT`) rồi **THỬ** (`CS_MayChu_THU`): **Sao lưu ngay** → dán `Code.gs` mới → **Lưu** → **Triển khai → Quản lý các bản
   triển khai** → bút chì → **Phiên bản mới** → **Triển khai**.
2. Nói "phát hành Checksheet" để đẩy app lên `main` → mở app → **Tải lại bản mới**.
3. Không phải làm gì thêm. Máy đang gán từ trước giữ nguyên ngày bắt đầu; chỉ lần gán lại / dùng lại mẫu sau bản này mới đặt lại ngày bắt đầu.
   Việc dọn dữ liệu cũ tự chạy ở lần `runBackgroundJobs` kế tiếp (trong vòng 3 giờ); muốn chạy ngay: chọn hàm **`adminCleanupNow`** → **Chạy**
   (nhật ký in số dòng đã xóa mỗi bảng).
4. Kiểm lại **Khu vực phụ trách** của từng người (xem lưu ý trên).

## Lưu ý an toàn

- **Mã kết nối M&E** giống mật khẩu: chỉ dán ở màn Kết nối M&E. Lộ mã: bên M&E xóa thuộc tính `FEED_KEY_CS` → chạy lại `adminCreateFeedKey` → nhập mã mới bên Checksheet.
- Không chia sẻ, không sửa tay hai bảng tính `CS_NghiepVu` / `CS_BaoMat` trong thư mục `CS_HeThong`.
- **Owner quên PIN**: Thuộc tính tập lệnh thêm `OWNER_RESET_TEMP_PIN` = 6 số → chạy **`adminResetOwnerPin`** → đăng nhập bằng PIN tạm và đổi ngay.
- **Sao lưu** tự động hằng tuần (Chủ nhật 1 giờ, giữ 8 bản trong `CS_Backups`); **Quản trị → Sao lưu → Sao lưu ngay** trước khi sửa lớn.
- **Bảo trì** (tạm dừng ghi): chạy `adminMaintenanceOn` / `adminMaintenanceOff`.
- **Kiểm tra sức khỏe**: chạy `healthCheck` hoặc Quản trị → **Trạng thái hệ thống** (kết nối M&E, trigger, sao lưu, số ô bảng tính).
- Lượt kiểm giữ trên điện thoại 40 ngày gần nhất; tháng cũ hơn xem ở Bảng tháng/Báo cáo khi có mạng.
