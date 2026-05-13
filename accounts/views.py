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
    # 1. Nếu người dùng đã đăng nhập, chuyển hướng thẳng vào dashboard
    if request.user.is_authenticated:
        return redirect('board_list')

    if request.method == "POST":
        # Sử dụng .get() để tránh lỗi KeyError nếu form thiếu trường
        username = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')
        email = request.POST.get('email', '').strip()
        confirm = request.POST.get('confirm', '')

        # 2. Kiểm tra mật khẩu khớp
        if password != confirm:
            messages.error(request, "Mật khẩu không khớp.")
            return render(request, "accounts/register.html", {'username': username, 'email': email})

        # 3. Kiểm tra Username và Email đã tồn tại chưa
        if User.objects.filter(username=username).exists():
            messages.error(request, "Tên tài khoản đã tồn tại.")
            return render(request, "accounts/register.html", {'email': email})

        if User.objects.filter(email=email).exists():
            messages.error(request, "Email đã được sử dụng.")
            return render(request, "accounts/register.html", {'username': username})

        try:
            # 4. Tạo User (Sử dụng create_user để tự động mã hóa mật khẩu)
            user = User.objects.create_user(username=username, password=password, email=email)

            # 5. Tạo Profile cho User mới
            Profile.objects.create(user=user)

            # 6. ĐĂNG NHẬP TỰ ĐỘNG (Phần quan trọng nhất)
            # Authenticate giúp Django xác định đúng Backend và gán vào User object
            authenticated_user = authenticate(request, username=username, password=password)
            
            if authenticated_user is not None:
                login(request, authenticated_user)
                messages.success(request, f"Chào mừng {username}! Tài khoản đã được tạo thành công.")
                return redirect('board_list')
            else:
                # Nếu không thể auth ngay (hiếm gặp), yêu cầu đăng nhập thủ công
                messages.info(request, "Đăng ký thành công. Vui lòng đăng nhập vào tài khoản mới.")
                return redirect('login')

        except Exception as e:
            messages.error(request, f"Có lỗi xảy ra trong quá trình đăng ký: {str(e)}")
            return redirect('register')

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

            send_mail(
                "Password Reset OTP",
                f"Mã xác nhận của bạn là: {otp}",
                "yourgmail@gmail.com",
                [email],
                fail_silently=False
            )

            return redirect('verify_otp')

    return render(request,'accounts/forgot_password.html')

# Xác thực OTP
def verify_otp(request):
    if request.method == "POST":
        otp = request.POST['otp']

        if int(otp) == request.session.get('reset_otp'):
            return redirect('reset_password')
        else:
            messages.error(request,"OTP không đúng")

    return render(request,'accounts/verify_otp.html')

# Gửi lại mã OTP
def resend_otp(request):
    if request.method == "POST":
        email = request.session.get('reset_email')

        if not email:
            messages.error(request, "Phiên làm việc đã hết hạn, vui lòng thử lại.")
            return redirect('forgot_password')

        otp = random.randint(100000, 999999)
        request.session['reset_otp'] = otp

        send_mail(
            "Password Reset OTP",
            f"Mã xác nhận mới của bạn là: {otp}",
            "yourgmail@gmail.com",
            [email],
            fail_silently=False
        )

        messages.success(request, "Mã OTP mới đã được gửi đến email của bạn.")
        return redirect('verify_otp')

    return redirect('verify_otp')

# Đặt lại mật khẩu
def reset_password(request):
    if request.method == "POST":
        password = request.POST['password']

        email = request.session.get('reset_email')
        user = User.objects.get(email=email)

        user.password = make_password(password)
        user.save()

        return redirect('login')

    return render(request,'accounts/reset_password.html')

# Login by gg
def login_by_google_account(request):
    # ... code ... 
    return 