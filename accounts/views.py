import random
from django.core.mail import send_mail
from django.contrib.auth.hashers import make_password
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib import messages
from profiles.models import Profile

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
        login(request, user)

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