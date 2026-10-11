document.addEventListener('DOMContentLoaded', () => {
    // Đã cập nhật chính xác id="login-form" theo giao diện của anh
    const loginForm = document.getElementById('login-form');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Ngăn trình duyệt tải lại trang

            // Lấy dữ liệu từ ô nhập liệu
            const emailInput = document.getElementById('email').value;
            const passwordInput = document.getElementById('passwordInput').value;

            // Đổi giao diện nút bấm báo hiệu đang load
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerText;
            submitBtn.innerText = 'Đang xử lý...';
            submitBtn.disabled = true;

            try {
                // Gọi API vào máy chủ Python 
                const response = await fetch('http://localhost:8000/api/login', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({
                        email: emailInput,
                        password: passwordInput
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('accessToken', data.access_token);
                    localStorage.setItem('user_id', data.id == null ? '' : String(data.id));
                    localStorage.setItem('user_name', data.full_name || '');
                    localStorage.setItem('user_phone', data.phone || '');
                    var accountRole = String(data.role || 'user').trim().toLowerCase();
                    var accountTitle = String(data.chuc_vu || '').trim().toLowerCase();
                    localStorage.setItem('user_role', (accountRole === 'admin' || accountTitle === 'admin') ? 'Admin' : (data.chuc_vu || 'nhân viên'));
                    localStorage.setItem('user', JSON.stringify({
                        id: data.id,
                        full_name: data.full_name || '',
                        phone: data.phone || '',
                        role: data.role || 'user',
                        nhom: data.nhom || '',
                        chuc_vu: data.chuc_vu || 'nhân viên'
                    }));
                    window.location.href = 'dashboard.html';
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Đăng nhập không thành công',
                        text: (typeof data.detail === 'string' && data.detail) || 'Sai email hoặc mật khẩu. Vui lòng thử lại!',
                        confirmButtonColor: '#3085d6',
                        confirmButtonText: 'Đồng ý'
                    });
                }
            } catch (error) {
                console.error('Lỗi kết nối API:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Không kết nối được',
                    text: 'Không thể kết nối đến máy chủ Backend. Đảm bảo XAMPP và Python đang chạy.',
                    confirmButtonColor: '#3085d6',
                    confirmButtonText: 'Đồng ý'
                });
            } finally {
                // Khôi phục nút bấm
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }
});