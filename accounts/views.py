import random
from django.core.mail import send_mail
from django.contrib.auth.hashers import make_password
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib import messages
from profiles.models import Profile
from django.http import JsonResponse
import json

# Đăng ký
def register(request):

    if request.method == "POST":

        username = request.POST['username']
        password = request.POST['password']
        email = request.POST['email']
        confirm = request.POST['confirm']

        if password != confirm:
            messages.error(request, "Mật khẩu không khớp")
            return redirect('register')

        if User.objects.filter(username=username).exists():
            messages.error(request, "Tài khoản đã tồn tại")
            return redirect('register')

        if User.objects.filter(email=email).exists():
            messages.error(request, "Email đã được sử dụng")
            return redirect('register')
        
        # tạo user
        user = User.objects.create_user(username=username, password=password, email=email)

        # tạo profile
        Profile.objects.create(user=user)

        # login tự động
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')

        return redirect('board_list')

    return render(request, "accounts/register.html")


# Đăng nhập
def user_login(request):

    if request.method == "POST":

        username = request.POST['username']
        password = request.POST['password']

        user = authenticate(request, username=username, password=password)

        if user:
            login(request, user)
            return redirect('board_list')
        else:
            messages.error(request, "Sai tài khoản hoặc mật khẩu")

    return render(request, "accounts/login.html")


# Đăng xuất
def user_logout(request):
    logout(request)
    return redirect('home')

# Quên mật khẩu
def forgot_password(request):
    if request.method == "POST":
        user_name = request.POST['username']
        email = request.POST['email']

        if User.objects.filter(username=user_name, email=email).exists():

            otp = random.randint(100000,999999)
            request.session['reset_otp'] = otp
            request.session['reset_email'] = email
            # Đảm bảo reset lại trạng thái xác thực cũ
            request.session['otp_verified_success'] = False

            send_mail(
                "Password Reset OTP",
                f"Mã xác nhận của bạn là: {otp}",
                "yourgmail@gmail.com",
                [email],
                fail_silently=False
            )
            # Nếu là yêu cầu từ JavaScript (AJAX)
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return redirect('verify_otp') # Fetch sẽ nhận được response.redirected
            
            return redirect('verify_otp')
        else:
            # Nếu dùng AJAX, trả về lỗi 400 để JS xử lý showFieldError
            if request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({'success': False}, status=400)
            
            messages.error(request, "Thông tin không chính xác.")

    return render(request,'accounts/forgot_password.html')

# Gửi otp
def verify_otp(request):
    # 1. Giao diện (GET): Hiển thị trang nhập mã
    if request.method == "GET":
        # Kiểm tra nếu chưa có email trong session thì bắt quay lại từ đầu
        if not request.session.get('reset_email'):
            return redirect('forgot_password')
        return render(request, 'accounts/verify_otp.html')

    # 2. Xử lý logic (POST): Chỉ nhận yêu cầu từ Fetch API (otp.js)
    if request.method == "POST":
        try:
            # Đọc dữ liệu JSON từ JavaScript gửi lên
            data = json.loads(request.body)
            user_otp = data.get('otp')
            session_otp = request.session.get('reset_otp')

            # Kiểm tra session còn hiệu lực không
            if not session_otp:
                return JsonResponse({
                    'success': False, 
                    'message': 'Mã OTP đã hết hạn. Vui lòng nhấn gửi lại mã.'
                }, status=400)

            # So sánh mã
            if str(user_otp) == str(session_otp):
                # Xác thực thành công
                request.session.pop('reset_otp', None) # Xóa mã cũ
                request.session['otp_verified_success'] = True # Đánh dấu để được phép đổi mật khẩu
                return JsonResponse({'success': True})
            else:
                return JsonResponse({
                    'success': False, 
                    'message': 'Mã OTP không chính xác.'
                })

        except json.JSONDecodeError:
            return JsonResponse({'success': False, 'message': 'Dữ liệu không hợp lệ.'}, status=400)

    return JsonResponse({'success': False, 'message': 'Không được phép.'}, status=405)

# Gửi lại otp
def resend_otp(request):
    if request.method == "POST":
        email = request.session.get('reset_email')
        
        if not email:
            return JsonResponse({
                'success': False, 
                'message': 'Phiên làm việc đã hết hạn. Vui lòng quay lại bước đầu.'
            }, status=400)

        # Tạo mã mới
        otp = random.randint(100000, 999999)
        request.session['reset_otp'] = otp
        
        try:
            send_mail(
                "Mã OTP mới của bạn",
                f"Mã xác nhận mới là: {otp}",
                "yourgmail@gmail.com", # Thay bằng email của bạn
                [email],
                fail_silently=False
            )
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'message': 'Gửi email thất bại.'}, status=500)
            
    return JsonResponse({'success': False}, status=405)

# Đặt lại mật khẩu
def reset_password(request):
    # 1. Bảo vệ: Nếu chưa xác thực OTP thành công thì không cho đổi
    if not request.session.get('otp_verified_success'):
        return redirect('forgot_password')

    if request.method == "POST":
        try:
            data = json.loads(request.body)
            new_password = data.get('password')
            email = request.session.get('reset_email')

            if not new_password:
                return JsonResponse({'success': False, 'message': 'Mật khẩu không được để trống.'})

            # 2. Thực hiện đổi mật khẩu
            user = User.objects.get(email=email)
            user.set_password(new_password)
            user.save()

            # 3. Xóa các dấu vết session sau khi thành công
            request.session.pop('otp_verified_success', None)
            request.session.pop('reset_email', None)

            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'message': 'Có lỗi hệ thống xảy ra.'})

    return render(request, 'accounts/reset_password.html')

# Login by gg
def login_by_google_account(request):
    # ... code ... 
    return 