const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

// Bật kiểm tra khóa ngoại (Foreign Keys)
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    -- 1. Trường học (Đại học Kiến trúc Đà Nẵng)
    CREATE TABLE IF NOT EXISTS schools (
      school_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Khoa đào tạo
    CREATE TABLE IF NOT EXISTS faculties (
      faculty_id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL REFERENCES schools(school_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (school_id, code)
    );

    -- 3. Ngành học
    CREATE TABLE IF NOT EXISTS majors (
      major_id INTEGER PRIMARY KEY AUTOINCREMENT,
      faculty_id INTEGER NOT NULL REFERENCES faculties(faculty_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (faculty_id, code)
    );

    -- 4. Khóa học (Từ K06 đến K26)
    CREATE TABLE IF NOT EXISTS courses (
      course_id INTEGER PRIMARY KEY AUTOINCREMENT,
      major_id INTEGER NOT NULL REFERENCES majors(major_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      start_year INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Lớp học
    CREATE TABLE IF NOT EXISTS classes (
      class_id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (course_id, name)
    );

    -- 6. Môn học
    CREATE TABLE IF NOT EXISTS subjects (
      subject_id INTEGER PRIMARY KEY AUTOINCREMENT,
      faculty_id INTEGER NOT NULL REFERENCES faculties(faculty_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      credits INTEGER DEFAULT 3,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (faculty_id, code)
    );

    -- 7. Người dùng (Sinh viên & Admin)
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      student_code TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      avatar_url TEXT,
      phone TEXT,
      bio TEXT,
      role TEXT CHECK(role IN ('STUDENT', 'ADMIN')) DEFAULT 'STUDENT',
      status TEXT CHECK(status IN ('ACTIVE', 'LOCKED')) DEFAULT 'ACTIVE',
      class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 8. Bài viết
    CREATE TABLE IF NOT EXISTS posts (
      post_id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      scope_type TEXT CHECK(scope_type IN ('SCHOOL', 'FACULTY', 'MAJOR', 'COURSE', 'CLASS')) NOT NULL,
      scope_id INTEGER NOT NULL,
      category TEXT CHECK(category IN ('STUDY', 'COMMUNITY', 'ACTIVITY', 'OPPORTUNITY')) NOT NULL,
      content TEXT NOT NULL,
      media_urls TEXT DEFAULT '[]',
      status TEXT CHECK(status IN ('VISIBLE', 'HIDDEN', 'DELETED')) DEFAULT 'VISIBLE',
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. Bình luận
    CREATE TABLE IF NOT EXISTS comments (
      comment_id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      parent_comment_id TEXT REFERENCES comments(comment_id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      status TEXT CHECK(status IN ('VISIBLE', 'HIDDEN', 'DELETED')) DEFAULT 'VISIBLE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 10. Tương tác (Reactions)
    CREATE TABLE IF NOT EXISTS reactions (
      reaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      type TEXT CHECK(type IN ('LIKE', 'HEART', 'INSIGHTFUL')) DEFAULT 'LIKE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (post_id, user_id)
    );

    -- 11. Báo cáo vi phạm (Reports)
    CREATE TABLE IF NOT EXISTS reports (
      report_id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      target_type TEXT CHECK(target_type IN ('POST', 'COMMENT', 'DOCUMENT', 'QUESTION', 'ANSWER')) NOT NULL,
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      description TEXT,
      status TEXT CHECK(status IN ('PENDING', 'RESOLVED', 'DISMISSED')) DEFAULT 'PENDING',
      resolved_by TEXT REFERENCES users(user_id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 12. Tài liệu học tập
    CREATE TABLE IF NOT EXISTS documents (
      document_id TEXT PRIMARY KEY,
      uploader_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
      class_id INTEGER REFERENCES classes(class_id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      download_count INTEGER DEFAULT 0,
      avg_rating REAL DEFAULT 0.0,
      status TEXT CHECK(status IN ('VISIBLE', 'HIDDEN', 'DELETED')) DEFAULT 'VISIBLE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 13. Đánh giá tài liệu
    CREATE TABLE IF NOT EXISTS document_ratings (
      rating_id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      score INTEGER CHECK(score >= 1 AND score <= 5) NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (document_id, user_id)
    );

    -- 14. Câu hỏi Q&A
    CREATE TABLE IF NOT EXISTS questions (
      question_id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      accepted_answer_id TEXT,
      upvote_count INTEGER DEFAULT 0,
      status TEXT CHECK(status IN ('VISIBLE', 'HIDDEN', 'DELETED')) DEFAULT 'VISIBLE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 15. Câu trả lời Q&A
    CREATE TABLE IF NOT EXISTS answers (
      answer_id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(question_id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      is_accepted INTEGER DEFAULT 0,
      upvote_count INTEGER DEFAULT 0,
      status TEXT CHECK(status IN ('VISIBLE', 'HIDDEN', 'DELETED')) DEFAULT 'VISIBLE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 16. Bình chọn câu trả lời (Votes)
    CREATE TABLE IF NOT EXISTS votes (
      vote_id INTEGER PRIMARY KEY AUTOINCREMENT,
      answer_id TEXT NOT NULL REFERENCES answers(answer_id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      vote_type INTEGER CHECK(vote_type IN (1, -1)) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (answer_id, user_id)
    );

    -- 17. Nhóm học
    CREATE TABLE IF NOT EXISTS study_groups (
      group_id TEXT PRIMARY KEY,
      leader_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      subject_id INTEGER NOT NULL REFERENCES subjects(subject_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      goal TEXT NOT NULL,
      schedule TEXT NOT NULL,
      location TEXT NOT NULL,
      max_members INTEGER DEFAULT 5,
      current_members INTEGER DEFAULT 1,
      status TEXT CHECK(status IN ('OPEN', 'FULL', 'CLOSED')) DEFAULT 'OPEN',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 18. Thành viên nhóm học
    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL REFERENCES study_groups(group_id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      role TEXT CHECK(role IN ('LEADER', 'MEMBER')) DEFAULT 'MEMBER',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, user_id)
    );

    -- 19. Yêu cầu tham gia nhóm
    CREATE TABLE IF NOT EXISTS join_requests (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id TEXT NOT NULL REFERENCES study_groups(group_id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      message TEXT,
      status TEXT CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED')) DEFAULT 'PENDING',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (group_id, user_id, status)
    );

    -- 20. Bảng tin Campus
    CREATE TABLE IF NOT EXISTS campus_posts (
      campus_id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      type TEXT CHECK(type IN ('ANNOUNCEMENT', 'EVENT', 'SCHOLARSHIP', 'JOB', 'CLUB')) NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      banner_url TEXT,
      start_time DATETIME,
      end_time DATETIME,
      status TEXT CHECK(status IN ('VISIBLE', 'HIDDEN', 'DELETED')) DEFAULT 'VISIBLE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 21. Thông báo (Notifications)
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      actor_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      ref_id TEXT NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Đánh chỉ mục (Indexes)
    CREATE INDEX IF NOT EXISTS idx_posts_scope ON posts(scope_type, scope_id, status);
    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_docs_subject ON documents(subject_id, status);
    CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id, status);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(recipient_id, is_read, created_at DESC);
  `);

  seedDataDAU();
}

function seedDataDAU() {
  const schoolCount = db.prepare('SELECT count(*) as count FROM schools').get().count;
  if (schoolCount > 0) return; // Đã khởi tạo

  console.log('🏛️ Đang thiết lập cấu trúc đào tạo Trường Đại học Kiến trúc Đà Nẵng (DAU)...');

  // 1. Trường Đại học Kiến trúc Đà Nẵng
  const insSchool = db.prepare('INSERT INTO schools (name, code, address) VALUES (?, ?, ?)');
  const schoolResult = insSchool.run('Trường Đại học Kiến trúc Đà Nẵng', 'DAU', '566 Núi Thành, Quận Hải Châu, TP. Đà Nẵng');
  const dauSchoolId = schoolResult.lastInsertRowid;

  // 2. 9 Khoa chính của trường DAU
  const insFaculty = db.prepare('INSERT INTO faculties (school_id, name, code) VALUES (?, ?, ?)');
  const facKT = insFaculty.run(dauSchoolId, 'Khoa Kiến trúc', 'KT').lastInsertRowid;
  const facNT = insFaculty.run(dauSchoolId, 'Khoa Thiết kế Nội thất', 'NT').lastInsertRowid;
  const facXD = insFaculty.run(dauSchoolId, 'Khoa Xây dựng', 'XD').lastInsertRowid;
  const facCD = insFaculty.run(dauSchoolId, 'Khoa Cầu đường', 'CD').lastInsertRowid;
  const facCNTT = insFaculty.run(dauSchoolId, 'Khoa Công nghệ Thông tin', 'CNTT').lastInsertRowid;
  const facDDT = insFaculty.run(dauSchoolId, 'Khoa Kỹ thuật Điện - Điện tử', 'DDT').lastInsertRowid;
  const facKTKT = insFaculty.run(dauSchoolId, 'Khoa Kinh tế', 'KTKT').lastInsertRowid;
  const facNN = insFaculty.run(dauSchoolId, 'Khoa Ngoại ngữ', 'NN').lastInsertRowid;
  const facDL = insFaculty.run(dauSchoolId, 'Khoa Du lịch', 'DL').lastInsertRowid;

  // 3. Các Ngành đào tạo
  const insMajor = db.prepare('INSERT INTO majors (faculty_id, name, code) VALUES (?, ?, ?)');
  // Khoa Kiến trúc
  const mKTS = insMajor.run(facKT, 'Kiến trúc', '7580101').lastInsertRowid;
  const mDH = insMajor.run(facKT, 'Thiết kế Đồ họa', '7210403').lastInsertRowid;
  const mQH = insMajor.run(facKT, 'Quy hoạch Vùng và Đô thị', '7580105').lastInsertRowid;
  // Khoa Nội thất
  const mNT = insMajor.run(facNT, 'Thiết kế Nội thất', '7580108').lastInsertRowid;
  // Khoa Xây dựng
  const mKTXD = insMajor.run(facXD, 'Kỹ thuật Xây dựng', '7580201').lastInsertRowid;
  const mQLXD = insMajor.run(facXD, 'Quản lý Xây dựng', '7580302').lastInsertRowid;
  // Khoa Cầu đường
  const mCD = insMajor.run(facCD, 'Kỹ thuật Xây dựng Công trình Giao thông', '7580205').lastInsertRowid;
  // Khoa CNTT
  const mCNTT = insMajor.run(facCNTT, 'Công nghệ Thông tin', '7480201').lastInsertRowid;
  // Khoa Điện Điện tử
  const mDDT = insMajor.run(facDDT, 'Công nghệ Kỹ thuật Điện, Điện tử', '7510301').lastInsertRowid;
  // Khoa Kinh tế
  const mQTKD = insMajor.run(facKTKT, 'Quản trị Kinh doanh', '7340101').lastInsertRowid;
  const mKT = insMajor.run(facKTKT, 'Kế toán', '7340301').lastInsertRowid;
  const mLOG = insMajor.run(facKTKT, 'Logistics và Quản lý Chuỗi cung ứng', '7510605').lastInsertRowid;
  // Khoa Ngoại ngữ
  const mNNA = insMajor.run(facNN, 'Ngôn ngữ Anh', '7220201').lastInsertRowid;
  const mNNT = insMajor.run(facNN, 'Ngôn ngữ Trung Quốc', '7220204').lastInsertRowid;
  // Khoa Du lịch
  const mDL = insMajor.run(facDL, 'Quản trị Dịch vụ Du lịch và Lữ hành', '7810103').lastInsertRowid;

  // 4. TOÀN BỘ CÁC KHÓA ĐÀO TẠO (Từ thành lập 2006 đến 2026 = 21 Khóa học)
  // Thành lập 2006, tuyển sinh K06 -> K26
  console.log('📅 Đang thiết lập 21 Khóa học từ Khóa 2006 (K06) đến Khóa 2026 (K26)...');
  const insCourse = db.prepare('INSERT INTO courses (major_id, name, start_year) VALUES (?, ?, ?)');
  const insClass = db.prepare('INSERT INTO classes (course_id, name) VALUES (?, ?)');

  const allMajors = [
    { id: mKTS, short: 'KT' },
    { id: mDH, short: 'DH' },
    { id: mNT, short: 'NT' },
    { id: mKTXD, short: 'XD' },
    { id: mCD, short: 'CD' },
    { id: mCNTT, short: 'CNTT' },
    { id: mDDT, short: 'DDT' },
    { id: mQTKD, short: 'QT' },
    { id: mKT, short: 'KT' },
    { id: mLOG, short: 'LOG' },
    { id: mNNA, short: 'NA' },
    { id: mDL, short: 'DL' }
  ];

  // Duyệt qua tất cả 21 năm từ 2006 đến 2026
  for (let year = 2006; year <= 2026; year++) {
    const kNum = (year - 2000).toString().padStart(2, '0'); // '06' -> '26'
    const courseName = `Khóa K${kNum} (${year})`;

    for (const maj of allMajors) {
      const courseId = insCourse.run(maj.id, courseName, year).lastInsertRowid;

      // Sinh sẵn 2 lớp tiêu chuẩn cho mỗi khóa/ngành
      // Ví dụ: 22CNTT1, 22CNTT2, 23KT1, 24XD1...
      insClass.run(courseId, `${kNum}${maj.short}1`);
      insClass.run(courseId, `${kNum}${maj.short}2`);
    }
  }

  // 5. Môn học chuẩn hóa cho các khoa
  const insSub = db.prepare('INSERT INTO subjects (faculty_id, name, code, credits) VALUES (?, ?, ?, ?)');
  // CNTT
  insSub.run(facCNTT, 'Lập trình mạng', 'IT308', 3);
  insSub.run(facCNTT, 'Hệ quản trị Cơ sở Dữ liệu', 'IT203', 3);
  insSub.run(facCNTT, 'Cấu trúc Dữ liệu & Giải thuật', 'IT201', 3);
  insSub.run(facCNTT, 'Lập trình Ứng dụng Web', 'IT305', 3);
  insSub.run(facCNTT, 'An toàn & Bảo mật Thông tin', 'IT402', 3);
  // Kiến trúc
  insSub.run(facKT, 'Đồ án Kiến trúc Dân dụng', 'KT201', 4);
  insSub.run(facKT, 'Hình họa - Vẽ Mỹ thuật', 'KT102', 3);
  insSub.run(facKT, 'Lịch sử Kiến trúc Thế giới & Việt Nam', 'KT105', 2);
  insSub.run(facKT, 'Cấu tạo Kiến trúc', 'KT204', 3);
  // Xây dựng
  insSub.run(facXD, 'Cơ học Kết cấu', 'XD201', 3);
  insSub.run(facXD, 'Sức bền Vật liệu', 'XD105', 3);
  insSub.run(facXD, 'Kết cấu Bê tông Cốt thép', 'XD301', 3);
  // Nội thất
  insSub.run(facNT, 'Thiết kế Nội thất Không gian Sống', 'NT202', 4);
  insSub.run(facNT, 'Vật liệu Trang trí Nội thất', 'NT205', 3);
  // Kinh tế & Logistics
  insSub.run(facKTKT, 'Quản trị Logistics & Vận tải', 'LOG301', 3);
  insSub.run(facKTKT, 'Nguyên lý Kế toán', 'KT101', 3);
  insSub.run(facKTKT, 'Kinh tế Vi mô', 'ECO101', 3);
  // Ngoại ngữ
  insSub.run(facNN, 'Tiếng Anh Giao tiếp & Chuyên ngành', 'ENG201', 3);

  // 6. TÀI KHOẢN ADMIN DUY NHẤT (QUẢN TRỊ TRƯỜNG ĐH KIẾN TRÚC ĐÀ NẴNG)
  // TUYỆT ĐỐI KHÔNG TẠO NGƯỜI DÙNG ẢO
  console.log('👤 Khởi tạo tài khoản Quản Trị Hệ Thống (Không tạo sinh viên ảo)...');
  const defaultAdminPw = bcrypt.hashSync('123456', 10);
  const insUser = db.prepare(`
    INSERT INTO users (user_id, student_code, email, password_hash, full_name, avatar_url, phone, bio, role, status, class_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insUser.run(
    'admin-dau-system-uuid',
    'ADMIN_DAU',
    'admin@dau.edu.vn',
    defaultAdminPw,
    'Ban Quản Trị ĐH Kiến Trúc Đà Nẵng',
    'https://api.dicebear.com/7.x/bottts/svg?seed=AdminDAU',
    '02363522108',
    'Hệ thống mạng xã hội sinh viên Trường Đại học Kiến trúc Đà Nẵng (DAU)',
    'ADMIN',
    'ACTIVE',
    null
  );

  // 7. Thông báo chính thức của Trường DAU trên Campus
  const insCampus = db.prepare(`
    INSERT INTO campus_posts (admin_id, type, title, content, banner_url)
    VALUES (?, ?, ?, ?, ?)
  `);

  insCampus.run(
    'admin-dau-system-uuid',
    'ANNOUNCEMENT',
    'Chào mừng sinh viên Đại học Kiến trúc Đà Nẵng (DAU) tham gia UniLife',
    'Hệ thống mạng xã hội phục vụ đời sống và học tập sinh viên Trường Đại học Kiến trúc Đà Nẵng chính thức vận hành. Sinh viên tải app hoặc truy cập hệ thống để đăng ký tài khoản theo đúng Khoa, Khóa và Lớp của mình để trao đổi học tập và kết nối cộng đồng.',
    'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?w=800'
  );

  insCampus.run(
    'admin-dau-system-uuid',
    'EVENT',
    'Cuộc thi Ý tưởng Thiết kế Kiến trúc Xanh & Sáng tạo Công nghệ DAU 2026',
    'Phòng Công tác sinh viên và Đoàn trường phát động cuộc thi thường niên dành cho sinh viên tất cả các khoa. Chi tiết thể lệ và giải thưởng xem tại Văn phòng Đoàn trường 566 Núi Thành.',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800'
  );

  console.log('🎉 CSDL TRƯỜNG ĐH KIẾN TRÚC ĐÀ NẴNG (DAU) ĐÃ SẴN SÀNG 100%!');
}

module.exports = {
  db,
  initDatabase
};
