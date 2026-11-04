# 📋 BẢNG ĐIỀU PHỐI DỰ ÁN (KANBAN TASK BOARD)
## Dự án: Mạng Xã Hội Phục Vụ Đời Sống Sinh Viên (UniLife Network)
*Môn học: Lập trình mạng - Phân công đội ngũ Multi-Agent*

---

## 🏗️ 1. KIẾN TRÚC TỔNG THỂ & QUY CHUẨN KỸ THUẬT (Tech Lead)
- [x] **T0.1**: Thiết kế kiến trúc Client-Server, ERD 21 bảng dữ liệu, chuẩn hóa API RESTful và WebSocket Handshake.
- [x] **T0.2**: Khởi tạo cấu trúc thư mục dự án (`server/` + `client/`), cấu hình `.env`, Git và package scripts.

---

## ⚡ 2. BACKEND & CƠ SỞ DỮ LIỆU (Assigned to: backend-dev)
- [x] **BE-1**: Khởi tạo Database Schema với đầy đủ 21 bảng trong báo cáo đặc tả.
- [x] **BE-2**: Xây dựng Module Authentication & Authorization (Bcrypt hash, JWT token phân quyền Sinh viên/Admin).
- [x] **BE-3**: Xây dựng Module Cấu trúc đào tạo (Trường $\rightarrow$ Khoa $\rightarrow$ Ngành $\rightarrow$ Khóa $\rightarrow$ Lớp $\rightarrow$ Môn học).
- [x] **BE-4**: Xây dựng Module Bài viết & Bảng tin thông minh (Smart Feed: ưu tiên Lớp $\rightarrow$ Khóa $\rightarrow$ Khoa $\rightarrow$ Trường).
- [x] **BE-5**: Xây dựng Module Tương tác (Like, Comments, Báo cáo vi phạm).
- [x] **BE-6**: Xây dựng Module Tài liệu học tập (Upload Multer, Stream Download Proxy bảo mật theo lớp, đánh giá sao).
- [x] **BE-7**: Xây dựng Module Hỏi đáp môn học (Đặt câu hỏi, trả lời, Upvote, đánh dấu câu trả lời đúng).
- [x] **BE-8**: Xây dựng Module Nhóm học (Tạo nhóm, tìm kiếm theo môn/thời gian, gửi yêu cầu tham gia, duyệt thành viên).
- [x] **BE-9**: Xây dựng Module Campus (Admin đăng thông báo, sự kiện, học bổng, việc làm).
- [x] **BE-10**: Xây dựng Module Quản trị Admin (Kiểm duyệt bài viết bị báo cáo, khóa/mở khóa tài khoản).

---

## 📡 3. REALTIME & LẬP TRÌNH MẠNG (Assigned to: realtime-engineer)
- [x] **RT-1**: Thiết lập Socket.io Server kèm middleware xác thực JWT Token.
- [x] **RT-2**: Xây dựng Connection Manager: Quản lý active sockets theo `user_id` (hỗ trợ đa tab/thiết bị).
- [x] **RT-3**: Xử lý logic Room: Bắn thông báo cá nhân (`user:{id}`), thông báo lớp (`class:{id}`), trao đổi nhóm học (`group:{id}`).
- [x] **RT-4**: Phát tán sự kiện realtime: Cập nhật lượt like, bình luận mới, thông báo tức thì.

---

## 🎨 4. FRONTEND UI/UX PRO MAX (Assigned to: frontend-dev)
- [x] **FE-1**: Xây dựng Base Layout chuẩn UI/UX Pro Max: Header tìm kiếm, Sidebar điều hướng, Theme sinh viên học thuật, Responsive.
- [x] **FE-2**: Màn hình Đăng nhập và bộ chuyển đổi tài khoản 1-chạm (Quick Account Switcher).
- [x] **FE-3**: Màn hình Bảng tin thông minh (Bộ lọc Tab: Tất cả, Học tập, Cộng đồng, Hoạt động, Cơ hội; Đăng bài; Like/Comment).
- [x] **FE-4**: Màn hình Kho tài liệu (Tìm kiếm theo môn học, upload kéo thả, tải tài liệu bảo mật, đánh giá sao).
- [x] **FE-5**: Màn hình Hỏi đáp Q&A (Danh sách câu hỏi theo môn, chi tiết câu hỏi, upvote realtime, đánh dấu đáp án đúng).
- [x] **FE-6**: Màn hình Nhóm học tập (Danh sách nhóm còn tuyển, tạo nhóm học, gửi yêu cầu gia nhập).
- [x] **FE-7**: Màn hình Campus (Thông báo trường, lịch thi, sự kiện, học bổng).
- [x] **FE-8**: Chuông thông báo Realtime (Badge đếm số chưa đọc, popup toast tức thì).
- [x] **FE-9**: Màn hình Quản trị Admin (Thống kê số lượng, duyệt bài viết vi phạm, quản lý người dùng).

---

## 🧪 5. KIỂM THỬ & CHẤT LƯỢNG (Assigned to: qa-automator & devops-sec)
- [x] **QA-1**: Bộ kiểm thử tự động `npm test` vượt qua 100% các tiêu chí nghiệp vụ và bảo mật.
- [x] **SEC-1**: Kiểm tra bảo mật file, chống tải lậu bằng kiểm tra quyền lớp, mã hóa mật khẩu Bcrypt.
- [x] **DEV-1**: Đóng gói Dockerfile & docker-compose.yml khởi chạy 1 lệnh.
- [x] **DOC-1**: Tạo bộ Seed Data phong phú cho bài giảng, người dùng mẫu, viết README.md hướng dẫn chi tiết.
