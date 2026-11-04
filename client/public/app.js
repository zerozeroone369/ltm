// UniLife DAU Client Application Logic
// Dành riêng cho Trường Đại học Kiến trúc Đà Nẵng (DAU)

const API_BASE = '/api';
let currentUser = null;
let authToken = localStorage.getItem('unilife_dau_token') || null;
let socket = null;
let currentTab = 'feed';
let activeCategory = 'ALL';
let activeScope = 'ALL';
let activeQAStatus = 'ALL';
let activeGroupStatus = 'ALL';
let activeCampusType = 'ALL';
let academicTree = null;

// Khởi chạy ứng dụng
document.addEventListener('DOMContentLoaded', async () => {
  await loadAcademicTree();

  if (authToken) {
    await fetchCurrentUser();
  } else {
    // Chưa đăng nhập -> Hiện popup Đăng ký / Đăng nhập
    openAuthModal('register');
  }
});

// ----------------------------------------------------
// DỮ LIỆU ĐÀO TẠO TRƯỜNG ĐH KIẾN TRÚC ĐÀ NẴNG (DAU)
// ----------------------------------------------------
async function loadAcademicTree() {
  try {
    const res = await fetch(`${API_BASE}/academic/tree`);
    const result = await res.json();
    if (result.success) {
      academicTree = result.data;
      populateRegistrationFaculties();
      populateSubjectDropdowns();
    }
  } catch (err) {
    console.error('Lỗi tải dữ liệu trường DAU:', err);
  }
}

function populateRegistrationFaculties() {
  const facSelect = document.getElementById('regFaculty');
  if (!facSelect || !academicTree) return;
  facSelect.innerHTML = `<option value="">-- Chọn Khoa của bạn --</option>` +
    academicTree.faculties.map(f => `<option value="${f.faculty_id}">${f.name} (${f.code})</option>`).join('');
}

function onRegisterFacultyChange() {
  const facultyId = parseInt(document.getElementById('regFaculty').value);
  const majorSelect = document.getElementById('regMajor');
  const courseSelect = document.getElementById('regCourse');
  const classSelect = document.getElementById('regClass');

  courseSelect.innerHTML = `<option value="">-- Chọn Khóa --</option>`;
  classSelect.innerHTML = `<option value="">-- Chọn Lớp --</option>`;

  if (!facultyId || !academicTree) {
    majorSelect.innerHTML = `<option value="">-- Chọn Ngành học --</option>`;
    return;
  }

  const majors = academicTree.majors.filter(m => m.faculty_id === facultyId);
  majorSelect.innerHTML = `<option value="">-- Chọn Ngành học --</option>` +
    majors.map(m => `<option value="${m.major_id}">${m.name} (${m.code})</option>`).join('');
}

function onRegisterMajorChange() {
  const majorId = parseInt(document.getElementById('regMajor').value);
  const courseSelect = document.getElementById('regCourse');
  const classSelect = document.getElementById('regClass');

  classSelect.innerHTML = `<option value="">-- Chọn Lớp --</option>`;

  if (!majorId || !academicTree) {
    courseSelect.innerHTML = `<option value="">-- Chọn Khóa --</option>`;
    return;
  }

  const courses = academicTree.courses.filter(c => c.major_id === majorId);
  courseSelect.innerHTML = `<option value="">-- Chọn Khóa (K06 - K26) --</option>` +
    courses.map(c => `<option value="${c.course_id}">${c.name}</option>`).join('');
}

function onRegisterCourseChange() {
  const courseId = parseInt(document.getElementById('regCourse').value);
  const classSelect = document.getElementById('regClass');

  if (!courseId || !academicTree) {
    classSelect.innerHTML = `<option value="">-- Chọn Lớp --</option>`;
    return;
  }

  const classes = academicTree.classes.filter(cl => cl.course_id === courseId);
  classSelect.innerHTML = `<option value="">-- Chọn Lớp sinh hoạt --</option>` +
    classes.map(cl => `<option value="${cl.class_id}">Lớp ${cl.name}</option>`).join('');
}

function populateSubjectDropdowns() {
  if (!academicTree) return;
  const subjects = academicTree.subjects;
  const options = subjects.map(s => `<option value="${s.subject_id}">${s.name} (${s.code})</option>`).join('');

  const docSubject = document.getElementById('docSubjectSelect');
  const uploadSub = document.getElementById('uploadSubject');
  const askSub = document.getElementById('askSubject');
  const grpSub = document.getElementById('grpSubject');
  // Filter dropdowns cho QA và Groups
  const qaSubFilter = document.getElementById('qaSubjectFilter');
  const grpSubFilter = document.getElementById('grpSubjectFilter');

  if (docSubject) docSubject.innerHTML = `<option value="">Tất cả môn học</option>${options}`;
  if (uploadSub) uploadSub.innerHTML = options;
  if (askSub) askSub.innerHTML = options;
  if (grpSub) grpSub.innerHTML = options;
  if (qaSubFilter) qaSubFilter.innerHTML = `<option value="">Tất cả môn</option>${options}`;
  if (grpSubFilter) grpSubFilter.innerHTML = `<option value="">Tất cả môn</option>${options}`;
}

// ----------------------------------------------------
// AUTHENTICATION: ĐĂNG KÝ / ĐĂNG NHẬP SINH VIÊN
// ----------------------------------------------------
function openAuthModal(mode = 'register') {
  document.getElementById('authModal').classList.remove('hidden');
  toggleAuthTab(mode);
}

function closeAuthModal() {
  if (!currentUser) {
    showToast('Yêu cầu đăng nhập', 'Bạn cần đăng ký hoặc đăng nhập tài khoản sinh viên để sử dụng app', 'info');
    return;
  }
  document.getElementById('authModal').classList.add('hidden');
}

function toggleAuthTab(mode) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const title = document.getElementById('authModalTitle');
  const loginBtn = document.getElementById('authTabLoginBtn');
  const regBtn = document.getElementById('authTabRegisterBtn');

  if (mode === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    title.textContent = 'Đăng Nhập Sinh Viên DAU';
    loginBtn.className = 'flex-1 py-2 rounded-lg bg-white text-orange-600 shadow-sm transition';
    regBtn.className = 'flex-1 py-2 rounded-lg text-slate-600 transition';
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    title.textContent = 'Đăng Ký Tài Khoản Sinh Viên DAU';
    regBtn.className = 'flex-1 py-2 rounded-lg bg-white text-orange-600 shadow-sm transition';
    loginBtn.className = 'flex-1 py-2 rounded-lg text-slate-600 transition';
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const full_name = document.getElementById('regFullName').value.trim();
  const student_code = document.getElementById('regStudentCode').value.trim().toUpperCase();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const class_id = parseInt(document.getElementById('regClass').value);

  if (!class_id) {
    showToast('Thiếu thông tin', 'Vui lòng chọn đầy đủ Khoa, Ngành, Khóa và Lớp học', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, student_code, email, password, class_id })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Đăng ký thành công', 'Đang tự động đăng nhập vào ứng dụng...', 'success');
      // Tự động đăng nhập
      await performLogin(student_code, password);
    } else {
      showToast('Đăng ký thất bại', result.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi kết nối', err.message, 'error');
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const account = document.getElementById('loginAccount').value.trim();
  const password = document.getElementById('loginPassword').value;
  await performLogin(account, password);
}

async function performLogin(account, password) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, password })
    });
    const result = await res.json();
    if (result.success) {
      authToken = result.data.access_token;
      currentUser = result.data.user;
      localStorage.setItem('unilife_dau_token', authToken);
      document.getElementById('authModal').classList.add('hidden');
      updateUserHeader();
      initSocket();
      switchTab(currentTab);
      showToast('Đăng nhập thành công', `Chào mừng bạn: ${currentUser.full_name}`, 'success');
    } else {
      showToast('Đăng nhập thất bại', result.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi', err.message, 'error');
  }
}

async function fetchCurrentUser() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) {
      currentUser = result.data;
      updateUserHeader();
      initSocket();
      switchTab(currentTab);
    } else {
      logout();
    }
  } catch (err) {
    logout();
  }
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('unilife_dau_token');
  if (socket) socket.disconnect();

  document.getElementById('authActionsLoggedOut').classList.remove('hidden');
  document.getElementById('authActionsLoggedIn').classList.add('hidden');
  openAuthModal('login');
}

function updateUserHeader() {
  if (!currentUser) return;

  document.getElementById('authActionsLoggedOut').classList.add('hidden');
  document.getElementById('authActionsLoggedIn').classList.remove('hidden');

  document.getElementById('userName').textContent = currentUser.full_name;
  document.getElementById('userClass').textContent = currentUser.class_name ? `Lớp: ${currentUser.class_name}` : 'Quản trị viên';
  document.getElementById('userAvatar').src = currentUser.avatar_url;
  document.getElementById('composerAvatar').src = currentUser.avatar_url;

  document.getElementById('sidebarFacultyInfo').textContent = `Khoa: ${currentUser.faculty_name || 'Hệ thống'}`;
  document.getElementById('sidebarClassInfo').textContent = `Lớp: ${currentUser.class_name || 'Admin'}`;

  const adminNav = document.getElementById('adminNavSection');
  const adminCampusBtn = document.getElementById('adminAddCampusBtn');
  if (currentUser.role === 'ADMIN') {
    adminNav.classList.remove('hidden');
    if (adminCampusBtn) adminCampusBtn.classList.remove('hidden');
  } else {
    adminNav.classList.add('hidden');
    if (adminCampusBtn) adminCampusBtn.classList.add('hidden');
  }
}

// ----------------------------------------------------
// HỒ SƠ SINH VIÊN & ĐỔI MẬT KHẨU
// ----------------------------------------------------
function openProfileModal() {
  if (!currentUser) return openAuthModal('login');
  
  document.getElementById('profFaculty').textContent = currentUser.faculty_name || 'ĐH Kiến Trúc Đà Nẵng';
  document.getElementById('profCourse').textContent = currentUser.course_name || 'Khóa DAU';
  document.getElementById('profClass').textContent = currentUser.class_name ? `Lớp ${currentUser.class_name}` : 'Quản trị viên';
  document.getElementById('profCode').textContent = currentUser.student_code || 'ADMIN';
  document.getElementById('profFullName').value = currentUser.full_name || '';
  document.getElementById('profPhone').value = currentUser.phone || '';
  document.getElementById('profBio').value = currentUser.bio || '';

  toggleProfileTab('info');
  document.getElementById('profileModal').classList.remove('hidden');
}

function closeProfileModal() {
  document.getElementById('profileModal').classList.add('hidden');
}

function toggleProfileTab(tab) {
  const isInfo = tab === 'info';
  document.getElementById('profileInfoForm').classList.toggle('hidden', !isInfo);
  document.getElementById('profilePasswordForm').classList.toggle('hidden', isInfo);

  document.getElementById('profileTabInfoBtn').className = isInfo 
    ? 'flex-1 py-2 rounded-lg bg-white text-orange-600 shadow-sm transition' 
    : 'flex-1 py-2 rounded-lg text-slate-600 transition';
  document.getElementById('profileTabPasswordBtn').className = !isInfo 
    ? 'flex-1 py-2 rounded-lg bg-white text-orange-600 shadow-sm transition' 
    : 'flex-1 py-2 rounded-lg text-slate-600 transition';
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  const fullName = document.getElementById('profFullName').value.trim();
  const phone = document.getElementById('profPhone').value.trim();
  const bio = document.getElementById('profBio').value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ full_name: fullName, phone, bio })
    });
    const result = await res.json();
    if (result.success) {
      currentUser = result.data;
      updateUserHeader();
      showToast('Thành công', result.message, 'success');
      closeProfileModal();
    } else {
      showToast('Lỗi', result.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi', 'Không thể kết nối đến máy chủ', 'error');
  }
}

async function handleChangePassword(e) {
  e.preventDefault();
  const oldPassword = document.getElementById('profOldPassword').value;
  const newPassword = document.getElementById('profNewPassword').value;
  const confirmPassword = document.getElementById('profConfirmPassword').value;

  if (newPassword !== confirmPassword) {
    showToast('Lỗi', 'Xác nhận mật khẩu mới không khớp!', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword
      })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Thành công', result.message, 'success');
      document.getElementById('profilePasswordForm').reset();
      closeProfileModal();
    } else {
      showToast('Lỗi', result.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi', 'Không thể đổi mật khẩu', 'error');
  }
}

// ----------------------------------------------------
// WEBSOCKET (SOCKET.IO) CLIENT
// ----------------------------------------------------
function initSocket() {
  if (socket) socket.disconnect();
  if (!authToken) return;

  socket = io({
    auth: { token: `Bearer ${authToken}` }
  });

  socket.on('connect', () => {
    console.log('✅ Realtime WebSocket Connected! Socket ID:', socket.id);
  });

  socket.on('notification_received', (data) => {
    showToast(data.title || 'Thông báo mới', data.content, 'info');
    loadNotificationsCount();
  });

  socket.on('post_updated', () => {
    if (currentTab === 'feed') loadFeed();
  });
}

// ----------------------------------------------------
// TAB SWITCHING & ROUTING
// ----------------------------------------------------
function switchTab(tab) {
  currentTab = tab;
  ['feed', 'documents', 'qa', 'groups', 'campus', 'admin'].forEach(t => {
    const section = document.getElementById(`tab-${t}`);
    const navBtn = document.getElementById(`nav-${t}`);
    if (section) section.classList.toggle('hidden', t !== tab);
    if (navBtn) {
      if (t === tab) navBtn.classList.add('active');
      else navBtn.classList.remove('active');
    }
  });

  if (tab === 'feed') loadFeed();
  else if (tab === 'documents') loadDocuments();
  else if (tab === 'qa') loadQA();
  else if (tab === 'groups') loadGroups();
  else if (tab === 'campus') loadCampus();
  else if (tab === 'admin') loadAdminDashboard();
}

// ----------------------------------------------------
// TAB 1: BẢNG TIN THÔNG MINH
// ----------------------------------------------------
function filterFeedScope(scope) {
  activeScope = scope;
  document.querySelectorAll('#feedScopeTabs .scope-pill').forEach(btn => {
    btn.className = 'scope-pill px-2.5 py-1 rounded-md font-medium text-slate-600 hover:bg-slate-100';
  });
  if (event && event.target) {
    event.target.className = 'scope-pill px-2.5 py-1 rounded-md font-bold bg-slate-800 text-white';
  }
  loadFeed();
}

async function loadFeed() {
  const container = document.getElementById('postsContainer');
  try {
    let url = `${API_BASE}/posts/feed?category=${activeCategory}`;
    if (activeScope && activeScope !== 'ALL') {
      url += `&scope_type=${activeScope}`;
    }

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.success || !result.data || result.data.length === 0) {
      container.innerHTML = `<div class="bg-white p-8 rounded-2xl border text-center text-slate-400">Chưa có bài viết nào trong phạm vi này. Hãy đăng bài viết đầu tiên để trao đổi cùng các bạn sinh viên DAU!</div>`;
      return;
    }

    container.innerHTML = result.data.map(post => {
      const scopeBadge = post.scope_type === 'CLASS'
        ? `<span class="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-md text-[10px] font-bold"><i class="fa-solid fa-users mr-1"></i>Lớp: ${post.class_name || 'Của tôi'}</span>`
        : (post.scope_type === 'COURSE'
          ? `<span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-bold"><i class="fa-solid fa-graduation-cap mr-1"></i>Khóa DAU</span>`
          : (post.scope_type === 'FACULTY'
            ? `<span class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[10px] font-bold"><i class="fa-solid fa-building-columns mr-1"></i>Toàn Khoa</span>`
            : `<span class="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-[10px] font-bold"><i class="fa-solid fa-school mr-1"></i>ĐH Kiến Trúc ĐN</span>`));

      const catBadge = {
        'STUDY': '<span class="text-orange-600 font-semibold text-xs"><i class="fa-solid fa-compass-drafting mr-1"></i>Học tập & Đồ án</span>',
        'COMMUNITY': '<span class="text-blue-600 font-semibold text-xs"><i class="fa-solid fa-comments mr-1"></i>Cộng đồng</span>',
        'ACTIVITY': '<span class="text-amber-600 font-semibold text-xs"><i class="fa-solid fa-trophy mr-1"></i>Hoạt động</span>',
        'OPPORTUNITY': '<span class="text-emerald-600 font-semibold text-xs"><i class="fa-solid fa-briefcase mr-1"></i>Cơ hội</span>'
      }[post.category] || '';

      const reactedClass = post.user_has_reacted > 0 ? 'text-red-500 font-bold' : 'text-slate-600';
      const heartIcon = post.user_has_reacted > 0 ? 'fa-solid fa-heart text-red-500' : 'fa-regular fa-heart';

      const isAuthorOrAdmin = currentUser && (currentUser.user_id === post.author_id || currentUser.role === 'ADMIN');
      const actionButtons = isAuthorOrAdmin ? `
        <div class="flex items-center gap-1">
          <button onclick="openEditPostModal('${post.post_id}')" title="Sửa bài viết" class="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition">
            <i class="fa-solid fa-pen text-xs"></i>
          </button>
          <button onclick="deletePost('${post.post_id}')" title="Xóa bài viết" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
            <i class="fa-solid fa-trash text-xs"></i>
          </button>
        </div>
      ` : '';

      return `
        <article class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <img src="${post.author_avatar}" class="w-10 h-10 rounded-full border border-slate-200 object-cover">
              <div>
                <div class="font-bold text-sm text-slate-800">${post.author_name}</div>
                <div class="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>${new Date(post.created_at).toLocaleString('vi-VN')}</span>
                  <span>•</span>
                  ${catBadge}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              ${scopeBadge}
              ${actionButtons}
            </div>
          </div>

          <div id="post-content-${post.post_id}" class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(post.content)}</div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div class="flex items-center gap-4">
              <button onclick="toggleReaction('${post.post_id}')" class="flex items-center gap-1.5 ${reactedClass} hover:text-red-600 transition">
                <i class="${heartIcon}"></i>
                <span>${post.like_count || 0} Thích</span>
              </button>
              <button onclick="toggleCommentsView('${post.post_id}')" class="flex items-center gap-1.5 text-slate-600 hover:text-orange-600 transition">
                <i class="fa-regular fa-comment"></i>
                <span>${post.comment_count || 0} Bình luận</span>
              </button>
            </div>
            <button onclick="openReportModal('${post.post_id}', 'POST')" class="text-slate-400 hover:text-red-500 text-[11px]">
              <i class="fa-regular fa-flag mr-1"></i>Báo cáo
            </button>
          </div>

          <div id="comments-${post.post_id}" class="hidden pt-3 border-t border-slate-100 space-y-3">
            <div id="comments-list-${post.post_id}" class="space-y-2 text-xs">Đang tải bình luận...</div>
            <div class="flex gap-2">
              <input type="text" id="comment-input-${post.post_id}" placeholder="Viết bình luận cho sinh viên DAU..." 
                     class="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-orange-500">
              <button onclick="submitComment('${post.post_id}')" class="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs">
                Gửi
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  } catch (err) {
    console.error('Load feed error:', err);
  }
}

function openEditPostModal(postId) {
  const contentEl = document.getElementById(`post-content-${postId}`);
  if (!contentEl) return;
  document.getElementById('editPostId').value = postId;
  document.getElementById('editPostContent').value = contentEl.innerText || contentEl.textContent;
  document.getElementById('editPostModal').classList.remove('hidden');
}

function closeEditPostModal() {
  document.getElementById('editPostModal').classList.add('hidden');
}

async function handleUpdatePostSubmit(e) {
  e.preventDefault();
  const postId = document.getElementById('editPostId').value;
  const content = document.getElementById('editPostContent').value.trim();
  const category = document.getElementById('editPostCategory').value;
  const scope_type = document.getElementById('editPostScope').value;

  try {
    const res = await fetch(`${API_BASE}/posts/${postId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ content, category, scope_type })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Thành công', result.message, 'success');
      closeEditPostModal();
      loadFeed();
    } else {
      showToast('Lỗi', result.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi', 'Không thể cập nhật bài viết', 'error');
  }
}

async function deletePost(postId) {
  if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;
  try {
    const res = await fetch(`${API_BASE}/posts/${postId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) {
      showToast('Đã xóa', result.message, 'success');
      loadFeed();
    } else {
      showToast('Lỗi', result.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi', 'Không thể xóa bài viết', 'error');
  }
}

async function deleteComment(commentId, postId) {
  if (!confirm('Bạn có chắc chắn muốn xóa bình luận này?')) return;
  try {
    const res = await fetch(`${API_BASE}/posts/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) {
      showToast('Đã xóa', 'Đã xóa bình luận', 'success');
      loadComments(postId);
      loadFeed();
    } else {
      showToast('Lỗi', result.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi', 'Không thể xóa bình luận', 'error');
  }
}

function openReportModal(targetId, targetType = 'POST') {
  if (!currentUser) return openAuthModal('login');
  document.getElementById('reportTargetId').value = targetId;
  document.getElementById('reportTargetType').value = targetType;
  document.getElementById('reportModal').classList.remove('hidden');
}

function closeReportModal() {
  document.getElementById('reportModal').classList.add('hidden');
}

async function handleSendReportSubmit(e) {
  e.preventDefault();
  const targetId = document.getElementById('reportTargetId').value;
  const reason = document.getElementById('reportReasonSelect').value;
  const description = document.getElementById('reportDescription').value.trim();

  try {
    const res = await fetch(`${API_BASE}/posts/${targetId}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ reason, description })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Báo cáo đã gửi', result.message, 'info');
      closeReportModal();
    } else {
      showToast('Lỗi', result.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi', 'Không thể gửi báo cáo', 'error');
  }
}

async function submitNewPost() {
  if (!currentUser) return openAuthModal('login');
  const content = document.getElementById('postContentInput').value.trim();
  const scope_type = document.getElementById('postScopeSelect').value;
  const category = document.getElementById('postCategorySelect').value;

  if (!content) {
    showToast('Lỗi', 'Vui lòng nhập nội dung bài viết', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ content, scope_type, category })
    });
    const result = await res.json();
    if (result.success) {
      document.getElementById('postContentInput').value = '';
      loadFeed();
      showToast('Thành công', 'Bài viết đã được đăng lên bảng tin DAU!', 'success');
    }
  } catch (err) {
    console.error('Post error:', err);
  }
}

async function toggleReaction(postId) {
  if (!currentUser) return openAuthModal('login');
  try {
    const res = await fetch(`${API_BASE}/posts/${postId}/reactions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) loadFeed();
  } catch (err) {
    console.error(err);
  }
}

async function toggleCommentsView(postId) {
  const container = document.getElementById(`comments-${postId}`);
  container.classList.toggle('hidden');
  if (!container.classList.contains('hidden')) {
    loadComments(postId);
  }
}

async function loadComments(postId) {
  const listEl = document.getElementById(`comments-list-${postId}`);
  try {
    const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.data || result.data.length === 0) {
      listEl.innerHTML = `<div class="text-slate-400 italic py-1">Chưa có bình luận nào. Hãy là người đầu tiên bình luận!</div>`;
      return;
    }
    listEl.innerHTML = result.data.map(c => {
      const isAuthorOrAdmin = currentUser && (currentUser.user_id === c.author_id || currentUser.role === 'ADMIN');
      const deleteBtn = isAuthorOrAdmin 
        ? `<button onclick="deleteComment('${c.comment_id}', '${postId}')" class="text-slate-300 hover:text-red-500 ml-2" title="Xóa bình luận"><i class="fa-solid fa-xmark"></i></button>`
        : '';

      return `
        <div class="flex gap-2.5 bg-slate-50 p-2.5 rounded-xl">
          <img src="${c.author_avatar}" class="w-6 h-6 rounded-full shrink-0 mt-0.5">
          <div class="flex-1">
            <div class="flex items-center justify-between">
              <span class="font-bold text-slate-800 text-[11px]">${c.author_name}</span>
              <div class="flex items-center">
                <span class="text-[10px] text-slate-400">${new Date(c.created_at).toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}</span>
                ${deleteBtn}
              </div>
            </div>
            <div class="text-slate-700 text-xs mt-0.5">${escapeHtml(c.content)}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    listEl.innerHTML = 'Lỗi tải bình luận';
  }
}

async function submitComment(postId) {
  if (!currentUser) return openAuthModal('login');
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;

  try {
    const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ content })
    });
    const result = await res.json();
    if (result.success) {
      input.value = '';
      loadComments(postId);
      loadFeed();
    }
  } catch (err) {
    console.error(err);
  }
}

function filterFeedCategory(category) {
  activeCategory = category;
  document.querySelectorAll('.cat-pill').forEach(btn => {
    btn.classList.remove('bg-orange-600', 'text-white', 'font-bold');
    btn.classList.add('text-slate-600');
  });
  event.target.classList.add('bg-orange-600', 'text-white', 'font-bold');
  event.target.classList.remove('text-slate-600');
  loadFeed();
}

function reportPost(postId) {
  openReportModal('POST', postId);
}

// ----------------------------------------------------
// TAB 2: KHO TÀI LIỆU & STREAM DOWNLOAD BẢO MẬT
// ----------------------------------------------------
async function loadDocuments() {
  const grid = document.getElementById('documentsGrid');
  const keyword = document.getElementById('docSearchInput')?.value || '';
  const subjectId = document.getElementById('docSubjectSelect')?.value || '';
  const sortBy = document.getElementById('docSortSelect')?.value || 'NEWEST';

  try {
    const res = await fetch(`${API_BASE}/documents?keyword=${encodeURIComponent(keyword)}&subject_id=${subjectId}&sort=${sortBy}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.success || !result.data || result.data.length === 0) {
      grid.innerHTML = `<div class="col-span-full p-8 bg-white rounded-2xl text-center text-slate-400">Chưa có tài liệu nào trong danh mục này. Hãy chia sẻ tài liệu bài học đầu tiên!</div>`;
      return;
    }

    grid.innerHTML = result.data.map(doc => {
      const typeBg = doc.file_type === 'PDF' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-blue-50 text-blue-600 border-blue-200';
      const lockBadge = doc.class_id ? `<span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px]"><i class="fa-solid fa-lock mr-1"></i>Lớp: ${doc.class_name || 'Riêng'}</span>` : '<span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">Công khai DAU</span>';
      const isOwner = currentUser && (doc.uploader_id === currentUser.user_id || currentUser.role === 'ADMIN');
      const deleteBtn = isOwner ? `<button onclick="deleteDocument('${doc.document_id}')" class="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] hover:bg-red-100 font-bold border border-red-200"><i class="fa-solid fa-trash mr-1"></i>Xóa</button>` : '';

      return `
        <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl ${typeBg} border flex items-center justify-center font-bold text-sm">
                  ${doc.file_type}
                </div>
                <div>
                  <h4 class="font-bold text-slate-800 text-sm line-clamp-1">${escapeHtml(doc.title)}</h4>
                  <div class="text-[11px] text-slate-400">${doc.subject_name} (${doc.subject_code})</div>
                </div>
              </div>
              ${lockBadge}
            </div>
            <p class="text-xs text-slate-600 mt-3 line-clamp-2">${escapeHtml(doc.description || 'Tài liệu môn học DAU')}</p>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 text-slate-500 flex-wrap">
              <span><i class="fa-solid fa-download mr-1"></i>${doc.download_count}</span>
              <button onclick="openRateDocModal('${doc.document_id}')" class="text-amber-500 font-semibold hover:text-amber-600">
                <i class="fa-solid fa-star mr-1"></i>${Number(doc.avg_rating || 0).toFixed(1)}★
              </button>
              <button onclick="viewDocRatings('${doc.document_id}')" class="text-slate-400 hover:text-slate-700 text-[10px]">
                <i class="fa-regular fa-eye mr-1"></i>Đánh giá
              </button>
              ${deleteBtn}
            </div>
            <button onclick="downloadDocument('${doc.document_id}', '${escapeHtml(doc.file_name)}')" class="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition">
              <i class="fa-solid fa-arrow-down"></i> Tải về
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Load docs error:', err);
  }
}

async function deleteDocument(docId) {
  if (!confirm('Bạn có chắc muốn xóa tài liệu này?')) return;
  try {
    const res = await fetch(`${API_BASE}/documents/${docId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) {
      showToast('Đã xóa', 'Tài liệu đã được xóa thành công', 'success');
      loadDocuments();
    } else {
      showToast('Lỗi', result.message, 'error');
    }
  } catch (err) { console.error(err); }
}

async function downloadDocument(docId, fileName) {
  if (!currentUser) return openAuthModal('login');
  try {
    showToast('Đang xử lý', 'Đang xác thực quyền tải tệp tin bảo mật DAU...', 'info');
    const res = await fetch(`${API_BASE}/documents/${docId}/download`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (res.status === 403) {
      showToast('Bị từ chối (403)', 'Bạn không thuộc lớp được phép tải tài liệu này!', 'error');
      return;
    }

    if (!res.ok) {
      showToast('Lỗi tải file', 'Không tìm thấy tệp trên máy chủ', 'error');
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Hoàn tất', `Đã tải xuống: ${fileName}`, 'success');
    loadDocuments();
  } catch (err) {
    showToast('Lỗi', err.message, 'error');
  }
}

// Mở modal đánh giá tài liệu
function openRateDocModal(docId) {
  if (!currentUser) return openAuthModal('login');
  document.getElementById('rateTargetDocId').value = docId;
  document.getElementById('rateDocComment').value = '';
  selectStar(5);
  document.getElementById('rateDocModal').classList.remove('hidden');
}
function closeRateDocModal() { document.getElementById('rateDocModal').classList.add('hidden'); }

function selectStar(n) {
  document.getElementById('rateStarScore').value = n;
  document.querySelectorAll('#starRatingSelector .star-btn').forEach((s, i) => {
    s.style.color = i < n ? '#f59e0b' : '#d1d5db';
  });
}

async function handleSendRateSubmit(e) {
  e.preventDefault();
  const docId = document.getElementById('rateTargetDocId').value;
  const score = parseInt(document.getElementById('rateStarScore').value);
  const comment = document.getElementById('rateDocComment').value.trim();
  try {
    const res = await fetch(`${API_BASE}/documents/${docId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ score, comment })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Cảm ơn', 'Đánh giá tài liệu thành công!', 'success');
      closeRateDocModal();
      loadDocuments();
    } else {
      showToast('Lỗi', result.message, 'error');
    }
  } catch (err) { console.error(err); }
}

async function viewDocRatings(docId) {
  document.getElementById('docRatingsModal').classList.remove('hidden');
  const container = document.getElementById('docRatingsContainer');
  container.innerHTML = '<div class="text-center text-slate-400 py-4">Đang tải...</div>';
  try {
    const res = await fetch(`${API_BASE}/documents/${docId}/ratings`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.success || !result.data || result.data.length === 0) {
      container.innerHTML = '<div class="text-slate-400 text-center py-4">Chưa có đánh giá nào</div>';
      return;
    }
    container.innerHTML = result.data.map(r => `
      <div class="flex gap-2 p-2.5 bg-slate-50 rounded-xl">
        <img src="${r.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=anon'}" class="w-7 h-7 rounded-full">
        <div>
          <b class="text-xs text-slate-800">${escapeHtml(r.full_name)}</b>
          <span class="text-amber-500 text-xs ml-2">${'★'.repeat(r.score)}${'☆'.repeat(5 - r.score)}</span>
          ${r.comment ? `<p class="text-[11px] text-slate-600 mt-0.5">${escapeHtml(r.comment)}</p>` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) { console.error(err); }
}
function closeDocRatingsModal() { document.getElementById('docRatingsModal').classList.add('hidden'); }

// Alias backward compat
function rateDoc(docId) { openRateDocModal(docId); }

function openUploadModal() {
  if (!currentUser) return openAuthModal('login');
  document.getElementById('uploadModal').classList.remove('hidden');
}
function closeUploadModal() { document.getElementById('uploadModal').classList.add('hidden'); }

async function handleDocUpload(e) {
  e.preventDefault();
  const title = document.getElementById('uploadTitle').value.trim();
  const subject_id = document.getElementById('uploadSubject').value;
  const description = document.getElementById('uploadDesc').value.trim();
  const fileInput = document.getElementById('uploadFile');
  const isClassRestricted = document.getElementById('uploadClassRestricted').checked;

  if (!fileInput.files[0]) return;

  const formData = new FormData();
  formData.append('title', title);
  formData.append('subject_id', subject_id);
  formData.append('description', description);
  formData.append('file', fileInput.files[0]);
  if (isClassRestricted && currentUser.class_id) {
    formData.append('class_id', currentUser.class_id);
  }

  try {
    showToast('Đang tải lên', 'Máy chủ đang lưu tệp tin...', 'info');
    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` },
      body: formData
    });
    const result = await res.json();
    if (result.success) {
      closeUploadModal();
      loadDocuments();
      showToast('Thành công', 'Tài liệu đã được đăng tải lên kho DAU!', 'success');
    } else {
      showToast('Lỗi', result.message, 'error');
    }
  } catch (err) {
    showToast('Lỗi tải lên', err.message, 'error');
  }
}

// ----------------------------------------------------
// TAB 3: HỎI ĐÁP Q&A
// ----------------------------------------------------
// Lọc Q&A theo trạng thái
function filterQAStatus(status) {
  activeQAStatus = status;
  document.querySelectorAll('#qaFilterTabs button').forEach(btn => {
    const isMatch = btn.getAttribute('onclick')?.includes(`'${status}'`);
    if (isMatch) {
      btn.className = 'qa-pill px-3 py-1.5 rounded-lg font-bold bg-amber-600 text-white';
    } else {
      btn.className = 'qa-pill px-3 py-1.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100';
    }
  });
  loadQA();
}

async function loadQA() {
  const container = document.getElementById('qaListContainer');
  const keyword = document.getElementById('qaSearchInput')?.value?.trim() || '';
  const subjectId = document.getElementById('qaSubjectFilter')?.value || '';
  const filterType = activeQAStatus !== 'ALL' ? activeQAStatus : '';

  try {
    let url = `${API_BASE}/qa/questions?keyword=${encodeURIComponent(keyword)}&subject_id=${subjectId}`;
    if (filterType) url += `&filter_type=${filterType}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.success || !result.data || result.data.length === 0) {
      container.innerHTML = `<div class="bg-white p-8 rounded-2xl text-center text-slate-400">Chưa có câu hỏi nào. Bạn có câu hỏi khó về đồ án hay môn học?</div>`;
      return;
    }

    container.innerHTML = result.data.map(q => {
      const acceptedBadge = q.accepted_answer_id
        ? `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[11px] font-bold"><i class="fa-solid fa-check-circle mr-1"></i>Đã có đáp án đúng</span>`
        : `<span class="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-[11px]">Đang chờ đáp án</span>`;

      const isQOwner = currentUser && (q.author_id === currentUser.user_id || currentUser.role === 'ADMIN');
      const deleteQBtn = isQOwner ? `<button onclick="deleteQuestion('${q.question_id}')" class="text-red-400 hover:text-red-600 text-xs ml-2" title="Xóa câu hỏi"><i class="fa-solid fa-trash"></i></button>` : '';

      return `
        <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <span class="px-2 py-0.5 bg-amber-50 text-amber-800 rounded text-[10px] font-bold">${q.subject_name}</span>
              <h3 class="font-bold text-slate-800 text-base mt-1 cursor-pointer hover:text-orange-600" onclick="viewQuestionDetails('${q.question_id}')">
                ${escapeHtml(q.title)}
              </h3>
            </div>
            <div class="flex items-center gap-1">${acceptedBadge}${deleteQBtn}</div>
          </div>

          <p class="text-xs text-slate-600 line-clamp-3">${escapeHtml(q.content)}</p>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div class="flex items-center gap-3 text-slate-400">
              <span>Đăng bởi: <b>${q.author_name}</b></span>
              <span>•</span>
              <span><i class="fa-regular fa-comment-dots mr-1"></i>${q.answer_count || 0} câu trả lời</span>
            </div>
            <button onclick="viewQuestionDetails('${q.question_id}')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition">
              Xem & Trả lời
            </button>
          </div>
          <div id="qa-detail-${q.question_id}" class="hidden pt-4 border-t border-slate-100 space-y-4"></div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Load QA error:', err);
  }
}

async function deleteQuestion(questionId) {
  if (!confirm('Xóa câu hỏi này?')) return;
  try {
    const res = await fetch(`${API_BASE}/qa/questions/${questionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) { showToast('Đã xóa', result.message, 'success'); loadQA(); }
    else showToast('Lỗi', result.message, 'error');
  } catch (err) { console.error(err); }
}

async function viewQuestionDetails(questionId) {
  const detailEl = document.getElementById(`qa-detail-${questionId}`);
  detailEl.classList.toggle('hidden');
  if (detailEl.classList.contains('hidden')) return;

  try {
    const res = await fetch(`${API_BASE}/qa/questions/${questionId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.success) return;

    const { question, answers } = result.data;
    const isAuthor = currentUser && (question.author_id === currentUser.user_id || currentUser.role === 'ADMIN');

    let answersHtml = answers.map(ans => {
      const isAccepted = ans.is_accepted === 1;
      const isAnsOwner = currentUser && (ans.author_id === currentUser.user_id || currentUser.role === 'ADMIN');
      const acceptBtn = (isAuthor && !isAccepted)
        ? `<button onclick="markAcceptedAnswer('${questionId}', '${ans.answer_id}')" class="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] hover:bg-emerald-100 font-bold">✓ Đánh dấu đúng</button>`
        : (isAccepted ? `<span class="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"><i class="fa-solid fa-check mr-1"></i>Đáp án đúng</span>` : '');
      const deleteAnsBtn = isAnsOwner ? `<button onclick="deleteAnswer('${ans.answer_id}', '${questionId}')" class="text-red-400 hover:text-red-600 text-xs ml-1" title="Xóa câu trả lời"><i class="fa-solid fa-trash"></i></button>` : '';

      return `
        <div class="p-3 rounded-xl ${isAccepted ? 'bg-emerald-50/70 border border-emerald-200' : 'bg-slate-50 border border-slate-100'} space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <img src="${ans.author_avatar}" class="w-6 h-6 rounded-full">
              <span class="font-bold text-xs text-slate-800">${ans.author_name}</span>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="voteAnswer('${ans.answer_id}', '${questionId}')" class="px-2 py-0.5 bg-white border border-slate-200 rounded text-xs text-slate-600 hover:text-orange-600 font-medium">
                ▲ Upvote (${ans.upvote_count || 0})
              </button>
              ${acceptBtn}
              ${deleteAnsBtn}
            </div>
          </div>
          <div class="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(ans.content)}</div>
        </div>
      `;
    }).join('');

    detailEl.innerHTML = `
      <div class="space-y-3">
        <h4 class="font-bold text-xs text-slate-700 uppercase">Các câu trả lời (${answers.length}):</h4>
        <div class="space-y-2">${answers.length > 0 ? answersHtml : '<div class="text-slate-400 italic text-xs">Chưa có ai trả lời câu hỏi này.</div>'}</div>
        <div class="flex gap-2 pt-2">
          <textarea id="ans-input-${questionId}" rows="2" placeholder="Nhập câu trả lời của bạn..." class="flex-1 p-2 bg-slate-50 border rounded-xl text-xs focus:outline-none"></textarea>
          <button onclick="submitAnswer('${questionId}')" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs">Trả lời</button>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
  }
}

async function submitAnswer(questionId) {
  if (!currentUser) return openAuthModal('login');
  const input = document.getElementById(`ans-input-${questionId}`);
  const content = input.value.trim();
  if (!content) return;

  try {
    const res = await fetch(`${API_BASE}/qa/questions/${questionId}/answers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ content })
    });
    const result = await res.json();
    if (result.success) {
      input.value = '';
      viewQuestionDetails(questionId);
      showToast('Đã gửi', 'Câu trả lời của bạn đã được đăng!', 'success');
    }
  } catch (err) {
    console.error(err);
  }
}

async function voteAnswer(answerId, questionId) {
  if (!currentUser) return openAuthModal('login');
  try {
    const res = await fetch(`${API_BASE}/qa/answers/${answerId}/vote`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) viewQuestionDetails(questionId);
  } catch (err) {
    console.error(err);
  }
}

async function deleteAnswer(answerId, questionId) {
  if (!confirm('Xóa câu trả lời này?')) return;
  try {
    const res = await fetch(`${API_BASE}/qa/answers/${answerId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) {
      showToast('Đã xóa', result.message, 'success');
      viewQuestionDetails(questionId);
      loadQA();
    } else showToast('Lỗi', result.message, 'error');
  } catch (err) { console.error(err); }
}

async function markAcceptedAnswer(questionId, answerId) {
  try {
    const res = await fetch(`${API_BASE}/qa/questions/${questionId}/accept-answer`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ answer_id: answerId })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Thành công', result.message, 'success');
      viewQuestionDetails(questionId);
      loadQA();
    }
  } catch (err) {
    console.error(err);
  }
}

function openAskModal() {
  if (!currentUser) return openAuthModal('login');
  document.getElementById('askModal').classList.remove('hidden');
}
function closeAskModal() { document.getElementById('askModal').classList.add('hidden'); }

async function handleAskQuestion(e) {
  e.preventDefault();
  const subject_id = document.getElementById('askSubject').value;
  const title = document.getElementById('askTitle').value.trim();
  const content = document.getElementById('askContent').value.trim();

  try {
    const res = await fetch(`${API_BASE}/qa/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ subject_id, title, content })
    });
    const result = await res.json();
    if (result.success) {
      closeAskModal();
      loadQA();
      showToast('Đã đăng', 'Câu hỏi mới đã được đăng tải!', 'success');
    }
  } catch (err) {
    showToast('Lỗi', err.message, 'error');
  }
}

// ----------------------------------------------------
// TAB 4: TÌM BẠN & NHÓM HỌC TẬP
// ----------------------------------------------------
// Lọc nhóm học theo trạng thái
function filterGroupStatus(status) {
  activeGroupStatus = status;
  document.querySelectorAll('#groupFilterTabs button').forEach(btn => {
    const isMatch = btn.getAttribute('onclick')?.includes(`'${status}'`);
    if (isMatch) {
      btn.className = 'grp-pill px-3 py-1.5 rounded-lg font-bold bg-indigo-600 text-white';
    } else {
      btn.className = 'grp-pill px-3 py-1.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100';
    }
  });
  loadGroups();
}

async function loadGroups() {
  const grid = document.getElementById('groupsGrid');
  const keyword = document.getElementById('grpSearchInput')?.value?.trim() || '';
  const subjectId = document.getElementById('grpSubjectFilter')?.value || '';

  try {
    let url = `${API_BASE}/groups?keyword=${encodeURIComponent(keyword)}&subject_id=${subjectId}`;
    if (activeGroupStatus === 'RECRUITING') url += '&recruiting=1';
    if (activeGroupStatus === 'MINE') url += '&mine=1';

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.success || !result.data || result.data.length === 0) {
      grid.innerHTML = `<div class="col-span-full p-8 bg-white rounded-2xl text-center text-slate-400">Chưa có nhóm học nào. Hãy tự tạo một nhóm làm đồ án nhé!</div>`;
      return;
    }

    grid.innerHTML = result.data.map(grp => {
      const isLeader = currentUser && grp.leader_id === currentUser.user_id;
      const isMember = grp.is_member > 0;
      let actionBtn = '';

      if (isLeader) {
        actionBtn = `<span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold">Trưởng nhóm</span>`;
      } else if (isMember) {
        actionBtn = `<span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">Đã tham gia</span>`;
      } else if (grp.pending_request) {
        actionBtn = `<span class="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-medium">Chờ duyệt</span>`;
      } else {
        actionBtn = `<button onclick="joinGroup('${grp.group_id}', '${escapeHtml(grp.name)}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition">Xin gia nhập</button>`;
      }

      return `
        <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-bold">${grp.subject_name}</span>
                <h4 class="font-bold text-slate-800 text-sm mt-1">${escapeHtml(grp.name)}</h4>
              </div>
              <span class="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-semibold">
                ${grp.current_members}/${grp.max_members} thành viên
              </span>
            </div>

            <p class="text-xs text-slate-600 mt-2"><b>Mục tiêu:</b> ${escapeHtml(grp.goal)}</p>

            <div class="text-[11px] text-slate-400 mt-3 space-y-1">
              <div><i class="fa-regular fa-clock w-4"></i> ${escapeHtml(grp.schedule)}</div>
              <div><i class="fa-solid fa-location-dot w-4"></i> ${escapeHtml(grp.location)}</div>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <img src="${grp.leader_avatar}" class="w-6 h-6 rounded-full">
              <span class="text-slate-600">${grp.leader_name}</span>
            </div>
            <div class="flex items-center gap-2">
              ${actionBtn}
              <button onclick="openGroupDetailModal('${grp.group_id}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold transition">
                <i class="fa-solid fa-users mr-1"></i>Chi tiết
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Load groups error:', err);
  }
}

// Mở modal chi tiết nhóm học
async function openGroupDetailModal(groupId) {
  document.getElementById('groupDetailModal').classList.remove('hidden');
  document.getElementById('grpMembersList').innerHTML = '<div class="text-center text-slate-400 py-2 text-xs">Đang tải...</div>';
  try {
    const res = await fetch(`${API_BASE}/groups/${groupId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.success) return;

    const { group, members, pendingRequests } = result.data;
    document.getElementById('grpModalTitle').textContent = group.name;
    document.getElementById('grpModalSubject').textContent = group.subject_name;
    document.getElementById('grpModalGoal').textContent = group.goal;
    document.getElementById('grpModalSchedule').innerHTML = `<i class="fa-regular fa-clock mr-1"></i>${group.schedule}`;
    document.getElementById('grpModalLocation').innerHTML = `<i class="fa-solid fa-location-dot mr-1"></i>${group.location}`;
    document.getElementById('grpMembersCount').textContent = members.length;

    document.getElementById('grpMembersList').innerHTML = members.map(m => `
      <div class="flex items-center gap-2 py-1">
        <img src="${m.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + m.user_id}" class="w-6 h-6 rounded-full">
        <span class="text-xs font-semibold">${escapeHtml(m.full_name)}</span>
        <span class="text-[10px] text-slate-400 ml-auto">${m.role === 'LEADER' ? '👑 Trưởng' : 'Thành viên'}</span>
      </div>
    `).join('');

    const isLeader = currentUser && group.leader_id === currentUser.user_id;
    const isMember = members.some(m => m.user_id === currentUser?.user_id);

    const reqSection = document.getElementById('grpRequestsSection');
    if (isLeader && pendingRequests && pendingRequests.length > 0) {
      reqSection.classList.remove('hidden');
      document.getElementById('grpRequestsList').innerHTML = pendingRequests.map(r => `
        <div class="flex items-center gap-2 text-xs py-1">
          <span class="font-semibold">${escapeHtml(r.full_name)}</span>
          <span class="text-slate-400 flex-1 truncate">${escapeHtml(r.message || '')}</span>
          <button onclick="approveJoinRequest(${r.request_id}, 'ACCEPTED')" class="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold">Duyệt</button>
          <button onclick="approveJoinRequest(${r.request_id}, 'REJECTED')" class="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-[10px]">Từ chối</button>
        </div>
      `).join('');
    } else {
      reqSection.classList.add('hidden');
    }

    const footer = document.getElementById('grpLeaveOrDeleteBtnContainer');
    if (isLeader) {
      footer.innerHTML = `<button onclick="disbandGroup('${groupId}')" class="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700">Giải tán nhóm</button>`;
    } else if (isMember) {
      footer.innerHTML = `<button onclick="leaveGroup('${groupId}')" class="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-300">Rời nhóm</button>`;
    } else {
      footer.innerHTML = '';
    }
  } catch (err) { console.error(err); }
}

function closeGroupDetailModal() { document.getElementById('groupDetailModal').classList.add('hidden'); }

async function approveJoinRequest(requestId, status) {
  try {
    const res = await fetch(`${API_BASE}/groups/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ status })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Thành công', result.message, 'success');
      closeGroupDetailModal();
      loadGroups();
    } else showToast('Lỗi', result.message, 'error');
  } catch (err) { console.error(err); }
}

async function leaveGroup(groupId) {
  if (!confirm('Bạn có chắc muốn rời nhóm này?')) return;
  try {
    const res = await fetch(`${API_BASE}/groups/${groupId}/leave`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) {
      showToast('Đã rời nhóm', result.message, 'success');
      closeGroupDetailModal();
      loadGroups();
    } else showToast('Lỗi', result.message, 'error');
  } catch (err) { console.error(err); }
}

async function disbandGroup(groupId) {
  if (!confirm('Giải tán nhóm học sẽ xóa tất cả thành viên. Tiếp tục?')) return;
  try {
    const res = await fetch(`${API_BASE}/groups/${groupId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) {
      showToast('Đã giải tán', result.message, 'success');
      closeGroupDetailModal();
      loadGroups();
    } else showToast('Lỗi', result.message, 'error');
  } catch (err) { console.error(err); }
}

async function joinGroup(groupId, groupName) {
  if (!currentUser) return openAuthModal('login');
  const message = prompt(`Gửi lời nhắn đến trưởng nhóm "${groupName}":`, 'Chào bạn, mình là sinh viên DAU muốn tham gia nhóm làm đồ án!');
  if (!message) return;

  try {
    const res = await fetch(`${API_BASE}/groups/${groupId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ message })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Đã gửi yêu cầu', result.message, 'success');
      loadGroups();
    } else {
      showToast('Lỗi', result.message, 'error');
    }
  } catch (err) {
    console.error(err);
  }
}

function openCreateGroupModal() {
  if (!currentUser) return openAuthModal('login');
  document.getElementById('createGroupModal').classList.remove('hidden');
}
function closeCreateGroupModal() { document.getElementById('createGroupModal').classList.add('hidden'); }

async function handleCreateGroup(e) {
  e.preventDefault();
  const name = document.getElementById('grpName').value.trim();
  const subject_id = document.getElementById('grpSubject').value;
  const goal = document.getElementById('grpGoal').value.trim();
  const schedule = document.getElementById('grpSchedule').value.trim();
  const location = document.getElementById('grpLocation').value.trim();

  try {
    const res = await fetch(`${API_BASE}/groups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ name, subject_id, goal, schedule, location })
    });
    const result = await res.json();
    if (result.success) {
      closeCreateGroupModal();
      loadGroups();
      showToast('Thành công', 'Nhóm học tập mới đã được tạo!', 'success');
    }
  } catch (err) {
    showToast('Lỗi', err.message, 'error');
  }
}

// ----------------------------------------------------
// TAB 5: CAMPUS & ĐỜI SỐNG
// ----------------------------------------------------
// Lọc Campus theo loại
function filterCampusType(type) {
  activeCampusType = type;
  document.querySelectorAll('#campusTypeTabs button').forEach(btn => {
    const isMatch = btn.getAttribute('onclick')?.includes(`'${type}'`);
    if (isMatch) {
      btn.className = 'campus-pill px-3 py-1.5 rounded-lg font-bold bg-orange-600 text-white';
    } else {
      btn.className = 'campus-pill px-3 py-1.5 rounded-lg font-medium text-slate-600 hover:bg-slate-100';
    }
  });
  loadCampus();
}

async function loadCampus() {
  const container = document.getElementById('campusListContainer');
  try {
    let url = `${API_BASE}/campus`;
    if (activeCampusType !== 'ALL') url += `?type=${activeCampusType}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.success || !result.data || result.data.length === 0) {
      container.innerHTML = `<div class="bg-white p-8 rounded-2xl text-center text-slate-400">Chưa có thông báo Campus nào.</div>`;
      return;
    }

    const isAdmin = currentUser?.role === 'ADMIN';

    container.innerHTML = result.data.map(item => {
      const typeMap = {
        'ANNOUNCEMENT': '<span class="px-2.5 py-1 bg-red-100 text-red-700 font-bold rounded-lg text-xs">Thông báo trường DAU</span>',
        'SCHOLARSHIP': '<span class="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg text-xs">Học bổng</span>',
        'EVENT': '<span class="px-2.5 py-1 bg-blue-100 text-blue-700 font-bold rounded-lg text-xs">Sự kiện</span>',
        'JOB': '<span class="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-bold rounded-lg text-xs">Cơ hội việc làm</span>',
        'CLUB': '<span class="px-2.5 py-1 bg-purple-100 text-purple-700 font-bold rounded-lg text-xs">CLB & Ngoại khóa</span>'
      };
      const deleteAdminBtn = isAdmin ? `<button onclick="deleteCampusPost('${item.campus_id}')" class="px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] hover:bg-red-100 font-bold border border-red-200"><i class="fa-solid fa-trash mr-1"></i>Xóa</button>` : '';

      return `
        <article class="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm flex flex-col md:flex-row">
          ${item.banner_url ? `<img src="${item.banner_url}" class="w-full md:w-56 h-48 md:h-auto object-cover shrink-0">` : ''}
          <div class="p-5 flex-1 flex flex-col justify-between space-y-3">
            <div>
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  ${typeMap[item.type] || '<span class="px-2 py-0.5 bg-slate-100 rounded text-xs">Tin tức</span>'}
                  ${deleteAdminBtn}
                </div>
                <span class="text-xs text-slate-400">${new Date(item.created_at).toLocaleDateString('vi-VN')}</span>
              </div>
              <h3 class="font-bold text-slate-800 text-base mt-2">${escapeHtml(item.title)}</h3>
              <p class="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">${escapeHtml(item.content)}</p>
            </div>
            <div class="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
              Đăng bởi: <b>${item.admin_name || 'Ban Quản Trị ĐH Kiến Trúc Đà Nẵng'}</b>
            </div>
          </div>
        </article>
      `;
    }).join('');
  } catch (err) {
    console.error('Load campus error:', err);
  }
}

// Modal đăng tin Campus (Admin only)
function openCampusModal() {
  if (!currentUser || currentUser.role !== 'ADMIN') return;
  document.getElementById('campusModal').classList.remove('hidden');
}
function closeCampusModal() { document.getElementById('campusModal').classList.add('hidden'); }

async function handleCreateCampusSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('campusType').value;
  const title = document.getElementById('campusTitle').value.trim();
  const content = document.getElementById('campusContent').value.trim();
  if (!type || !title || !content) return showToast('Lỗi', 'Vui lòng điền đủ thông tin', 'error');
  try {
    const res = await fetch(`${API_BASE}/campus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
      body: JSON.stringify({ type, title, content })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Thành công', result.message, 'success');
      closeCampusModal();
      document.getElementById('campusTitle').value = '';
      document.getElementById('campusContent').value = '';
      loadCampus();
    } else showToast('Lỗi', result.message, 'error');
  } catch (err) { showToast('Lỗi', err.message, 'error'); }
}

async function deleteCampusPost(campusId) {
  if (!confirm('Xóa tin Campus này?')) return;
  try {
    const res = await fetch(`${API_BASE}/campus/${campusId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) { showToast('Đã xóa', result.message, 'success'); loadCampus(); }
    else showToast('Lỗi', result.message, 'error');
  } catch (err) { console.error(err); }
}

// ----------------------------------------------------
// TAB 6: TRUNG TÂM QUẢN TRỊ ADMIN
// ----------------------------------------------------
async function loadAdminDashboard() {
  if (currentUser?.role !== 'ADMIN') {
    switchTab('feed');
    return;
  }

  try {
    const statsRes = await fetch(`${API_BASE}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const stats = await statsRes.json();
    if (stats.success) {
      document.getElementById('adminStatUsers').textContent = stats.data.totalUsers;
      document.getElementById('adminStatPosts').textContent = stats.data.totalPosts;
      document.getElementById('adminStatReports').textContent = stats.data.pendingReports;
      document.getElementById('adminStatSockets').textContent = stats.data.activeSockets;
    }

    const reportsRes = await fetch(`${API_BASE}/admin/reports`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const reports = await reportsRes.json();
    const tbody = document.getElementById('adminReportsTableBody');

    if (!reports.success || reports.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400 italic">Không có nội dung nào bị báo cáo vi phạm.</td></tr>`;
    } else {
      tbody.innerHTML = reports.data.map(r => `
        <tr class="hover:bg-slate-50">
          <td class="py-2.5 px-3 font-semibold">${r.target_type}</td>
          <td class="py-2.5 px-3 text-slate-700">${escapeHtml(r.reason)}</td>
          <td class="py-2.5 px-3 text-slate-500">${r.reporter_name} (${r.reporter_code})</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${r.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
              ${r.status}
            </span>
          </td>
          <td class="py-2.5 px-3 text-right space-x-1">
            ${r.status === 'PENDING' ? `
              <button onclick="handleReportAction(${r.report_id}, 'HIDE_CONTENT')" class="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 font-bold">Ẩn bài</button>
              <button onclick="handleReportAction(${r.report_id}, 'DISMISS')" class="px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300">Bỏ qua</button>
            ` : '<span class="text-slate-400">Đã giải quyết</span>'}
          </td>
        </tr>
      `).join('');
    }

    // Load bảng quản lý người dùng
    await loadAdminUsers();
  } catch (err) {
    console.error('Load admin error:', err);
  }
}

async function loadAdminUsers() {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;
  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (!result.success || result.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-400">Chưa có sinh viên nào đăng ký</td></tr>';
      return;
    }
    tbody.innerHTML = result.data.map(u => `
      <tr class="hover:bg-slate-50 text-xs">
        <td class="py-2.5 px-3 font-semibold">${escapeHtml(u.full_name)}</td>
        <td class="py-2.5 px-3 text-slate-500">${u.student_code || '--'}</td>
        <td class="py-2.5 px-3">${u.class_name || '--'}</td>
        <td class="py-2.5 px-3">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}">${u.role}</span>
        </td>
        <td class="py-2.5 px-3">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold ${u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">${u.status}</span>
        </td>
        <td class="py-2.5 px-3 text-right">
          ${u.role !== 'ADMIN' ? `<button onclick="toggleUserLock('${u.user_id}', '${u.status}')" class="px-2 py-1 ${u.status === 'ACTIVE' ? 'bg-red-600' : 'bg-emerald-600'} text-white rounded text-[10px] font-bold">${u.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}</button>` : '<span class="text-slate-400 text-[10px]">Admin</span>'}
        </td>
      </tr>
    `).join('');
  } catch (err) { console.error('Load admin users error:', err); }
}

async function toggleUserLock(userId, currentStatus) {
  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/toggle-lock`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) {
      showToast('Thành công', result.message, 'success');
      loadAdminDashboard();
    } else showToast('Lỗi', result.message, 'error');
  } catch (err) { console.error(err); }
}

async function handleReportAction(reportId, action) {
  try {
    const res = await fetch(`${API_BASE}/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ action })
    });
    const result = await res.json();
    if (result.success) {
      showToast('Đã xử lý', result.message, 'success');
      loadAdminDashboard();
    }
  } catch (err) {
    console.error(err);
  }
}

// ----------------------------------------------------
// NOTIFICATIONS & TOAST ALERTS
// ----------------------------------------------------
async function loadNotificationsCount() {
  if (!authToken) return;
  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const result = await res.json();
    if (result.success) {
      const badge = document.getElementById('notifBadge');
      const count = result.data.unreadCount;
      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }

      const listEl = document.getElementById('notifList');
      if (result.data.notifications.length === 0) {
        listEl.innerHTML = `<div class="p-4 text-center text-slate-400">Không có thông báo mới</div>`;
      } else {
        listEl.innerHTML = result.data.notifications.map(n => `
          <div class="px-4 py-3 hover:bg-slate-50 transition cursor-pointer ${n.is_read ? 'opacity-70' : 'bg-orange-50/40'}">
            <div class="font-bold text-slate-800">${escapeHtml(n.content)}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">${new Date(n.created_at).toLocaleString('vi-VN')}</div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function toggleNotifications() {
  const drop = document.getElementById('notifDropdown');
  drop.classList.toggle('hidden');
  if (!drop.classList.contains('hidden')) {
    loadNotificationsCount();
  }
}

async function markAllNotifsRead() {
  try {
    await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    loadNotificationsCount();
  } catch (err) {
    console.error(err);
  }
}

function showToast(title, message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const typeStyles = {
    'success': 'bg-emerald-600 text-white',
    'error': 'bg-red-600 text-white',
    'info': 'bg-slate-900 text-white'
  }[type] || 'bg-slate-900 text-white';

  toast.className = `p-4 rounded-2xl shadow-xl ${typeStyles} pointer-events-auto flex items-start gap-3 animate-slide-in text-xs`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-bell')} text-base mt-0.5"></i>
    <div class="flex-1">
      <div class="font-bold">${title}</div>
      <div class="text-white/80 mt-0.5">${message}</div>
    </div>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/<|>/g, "")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
