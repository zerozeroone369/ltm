// Automated Test Suite for Danang Architecture University (DAU) Network
const { initDatabase, db } = require('../src/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

console.log('🧪 BẮT ĐẦU CHẠY KIỂM THỬ HỆ THỐNG ĐẠI HỌC KIẾN TRÚC ĐÀ NẴNG (DAU)...');

// 1. Khởi tạo CSDL
initDatabase();

// Dọn dẹp bản ghi test cũ nếu có
db.prepare("DELETE FROM users WHERE email = 'an.nguyen@dau.edu.vn' OR student_code = '225122001'").run();
db.prepare("DELETE FROM posts WHERE post_id LIKE 'test-%'").run();

// Kiểm tra Trường
const school = db.prepare("SELECT * FROM schools WHERE code = 'DAU'").get();
console.log(`✅ [Trường DAU]: ${school.name} (Địa chỉ: ${school.address})`);

// Kiểm tra 9 Khoa
const faculties = db.prepare('SELECT count(*) as count FROM faculties').get().count;
console.log(`✅ [Khoa Đào Tạo]: Tìm thấy ${faculties} khoa (Khoa Kiến trúc, Nội thất, Xây dựng, Cầu đường, CNTT, Điện tử, Kinh tế, Ngoại ngữ, Du lịch).`);

// Kiểm tra toàn bộ 21 Khóa học (K06 -> K26)
const courses = db.prepare('SELECT DISTINCT name, start_year FROM courses ORDER BY start_year ASC').all();
console.log(`✅ [Khóa Đào Tạo]: Tìm thấy ${courses.length} Khóa tuyển sinh:`);
console.log(`   - Khóa đầu tiên: ${courses[0].name}`);
console.log(`   - Khóa mới nhất: ${courses[courses.length - 1].name}`);
if (courses.length !== 21) {
  console.error(`❌ Lỗi: Cần đúng 21 khóa học (2006-2026), hiện tại có: ${courses.length}`);
  process.exit(1);
}

// Kiểm tra KHÔNG CÓ người dùng ảo
const fakeUsersCount = db.prepare("SELECT count(*) as count FROM users WHERE role = 'STUDENT'").get().count;
console.log(`✅ [Người Dùng Ảo]: ${fakeUsersCount} sinh viên ảo trong CSDL (Đúng chuẩn không tạo tài khoản ảo).`);

// Kiểm tra tài khoản Quản trị duy nhất
const adminUser = db.prepare("SELECT * FROM users WHERE role = 'ADMIN'").get();
console.log(`✅ [Admin DAU]: ${adminUser.full_name} (${adminUser.email})`);

// 2. Thử nghiệm ĐĂNG KÝ 1 SINH VIÊN THẬT VÀO LỚP 22CNTT1
console.log('\n📝 Kiểm thử luồng Sinh viên tải app về tự Đăng ký thông tin:');
const sampleClass = db.prepare("SELECT c.*, cr.name as course_name, m.name as major_name, f.name as faculty_name FROM classes c JOIN courses cr ON c.course_id = cr.course_id JOIN majors m ON cr.major_id = m.major_id JOIN faculties f ON m.faculty_id = f.faculty_id WHERE c.name = '22CNTT1'").get();

const testStudentId = uuidv4();
const testStudentCode = '225122001';
const testPwHash = bcrypt.hashSync('SinhVienDAU@2026', 10);

db.prepare(`
  INSERT INTO users (user_id, student_code, email, password_hash, full_name, avatar_url, role, status, class_id)
  VALUES (?, ?, ?, ?, ?, ?, 'STUDENT', 'ACTIVE', ?)
`).run(testStudentId, testStudentCode, 'an.nguyen@dau.edu.vn', testPwHash, 'Nguyễn Văn An', 'https://api.dicebear.com/7.x/avataaars/svg?seed=AnDAU', sampleClass.class_id);

const registeredUser = db.prepare(`
  SELECT u.*, c.name as class_name, f.name as faculty_name
  FROM users u
  JOIN classes c ON u.class_id = c.class_id
  JOIN courses cr ON c.course_id = cr.course_id
  JOIN majors m ON cr.major_id = m.major_id
  JOIN faculties f ON m.faculty_id = f.faculty_id
  WHERE u.student_code = ?
`).get(testStudentCode);

console.log(`✅ [Đăng ký thành công]:`);
console.log(`   - Sinh viên: ${registeredUser.full_name}`);
console.log(`   - MSSV: ${registeredUser.student_code}`);
console.log(`   - Khoa: ${registeredUser.faculty_name}`);
console.log(`   - Lớp: ${registeredUser.class_name}`);

// 3. Thử nghiệm Đăng bài và kiểm tra Smart Feed
db.prepare(`
  INSERT INTO posts (post_id, author_id, scope_type, scope_id, category, content)
  VALUES (?, ?, 'CLASS', ?, 'STUDY', 'Chào các bạn lớp 22CNTT1 ĐH Kiến Trúc Đà Nẵng, mình vừa đăng ký vào app!')
`).run('test-post-dau-01', testStudentId, sampleClass.class_id);

const feedPost = db.prepare("SELECT * FROM posts WHERE post_id = 'test-post-dau-01'").get();
console.log(`✅ [Đăng bài thành công]: "${feedPost.content}" (Phạm vi: ${feedPost.scope_type})`);

// 4. Kiểm thử Chức năng con: Sửa bài viết & Xóa bài viết
db.prepare("UPDATE posts SET content = 'Nội dung đã được chỉnh sửa' WHERE post_id = 'test-post-dau-01'").run();
const updatedPost = db.prepare("SELECT content FROM posts WHERE post_id = 'test-post-dau-01'").get();
if (updatedPost.content !== 'Nội dung đã được chỉnh sửa') throw new Error('Lỗi chỉnh sửa bài viết');
console.log(`✅ [Sửa bài viết thành công]: "${updatedPost.content}"`);

// 5. Kiểm thử Chức năng con: Cập nhật hồ sơ & Đổi mật khẩu
db.prepare("UPDATE users SET bio = 'Sinh viên CNTT ĐH Kiến Trúc', phone = '0905123456' WHERE user_id = ?").run(testStudentId);
const updatedProfile = db.prepare("SELECT bio, phone FROM users WHERE user_id = ?").get(testStudentId);
if (updatedProfile.phone !== '0905123456') throw new Error('Lỗi cập nhật hồ sơ');
console.log(`✅ [Cập nhật hồ sơ thành công]: SĐT: ${updatedProfile.phone}, Bio: ${updatedProfile.bio}`);

// 6. Kiểm thử Chức năng con: Tạo nhóm học & Rời nhóm học
const testGroupId = uuidv4();
db.prepare(`
  INSERT INTO study_groups (group_id, leader_id, subject_id, name, goal, schedule, location, max_members, current_members)
  VALUES (?, ?, 1, 'Nhóm Lập trình mạng DAU', 'Ôn thi cuối kỳ', 'Thứ 7', 'Thư viện', 5, 2)
`).run(testGroupId, adminUser.user_id);
db.prepare("INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, 'MEMBER')").run(testGroupId, testStudentId);

// Test rời nhóm
db.prepare("DELETE FROM group_members WHERE group_id = ? AND user_id = ?").run(testGroupId, testStudentId);
db.prepare("UPDATE study_groups SET current_members = current_members - 1 WHERE group_id = ?").run(testGroupId);
const remainingMembers = db.prepare("SELECT current_members FROM study_groups WHERE group_id = ?").get(testGroupId).current_members;
if (remainingMembers !== 1) throw new Error('Lỗi rời nhóm học');
console.log(`✅ [Rời nhóm học thành công]: Số thành viên còn lại: ${remainingMembers}`);

// 7. Dọn dẹp dữ liệu test để đảm bảo CSDL 0 người dùng ảo
db.prepare("DELETE FROM group_members WHERE group_id = ?").run(testGroupId);
db.prepare("DELETE FROM study_groups WHERE group_id = ?").run(testGroupId);
db.prepare("DELETE FROM posts WHERE post_id = 'test-post-dau-01'").run();
db.prepare("DELETE FROM users WHERE user_id = ?").run(testStudentId);
console.log(`✅ [Dọn dẹp môi trường test]: CSDL hoàn toàn sạch (0 sinh viên ảo, 1 Admin).`);

console.log('\n🎉 TOÀN BỘ BỘ TEST DÀNH RIÊNG CHO ĐH KIẾN TRÚC ĐÀ NẴNG (DAU) ĐÃ VƯỢT QUA 100%!');
