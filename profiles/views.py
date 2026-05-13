from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from .models import Profile
from django.contrib.auth import logout
from django.shortcuts import redirect

@login_required
def profile_view(request):
    profile, created = Profile.objects.get_or_create(user=request.user)
    return render(request, 'profiles/profile.html', {'profile': profile})

# 1. API LẤY DỮ LIỆU
@login_required
def get_profile_api(request):
    profile, created = Profile.objects.get_or_create(user=request.user)
    
    data = {
        "status": "success",
        "profile": {
            # DÙNG profile.name CHO KHỚP VỚI MODEL
            "full_name": profile.name if profile.name else request.user.username,
            "email": request.user.email,
            "phone": getattr(profile, 'phone', ''),
            "address": getattr(profile, 'address', ''),
            "bio": getattr(profile, 'bio', ''),
            "birth_date": profile.birth_date.strftime('%Y-%m-%d') if profile.birth_date else "",
            "avatar_url": profile.avatar.url if profile.avatar else ""
        }
    }
    return JsonResponse(data)

# 2. API CẬP NHẬT DỮ LIỆU
@login_required
def update_profile_api(request):
    if request.method == "POST":
        profile, created = Profile.objects.get_or_create(user=request.user)
        
        # Lấy "full_name" từ JS gửi lên và gán vào "name" của Database
        profile.name = request.POST.get("full_name", "")
        profile.phone = request.POST.get("phone", "")
        profile.address = request.POST.get("address", "")
        profile.bio = request.POST.get("bio", "")
        
        birth_date = request.POST.get("birth_date")
        if birth_date:
            profile.birth_date = birth_date
        else:
            profile.birth_date = None
            
        if 'avatar' in request.FILES:
            profile.avatar = request.FILES['avatar']
            
        profile.save()

        return JsonResponse({
            "status": "success",
            "profile": {
                "full_name": profile.name, # Trả về biến full_name để JS hiểu
                "email": request.user.email,
                "phone": profile.phone,
                "address": profile.address,
                "bio": profile.bio,
                "birth_date": birth_date if birth_date else "",
                "avatar_url": profile.avatar.url if profile.avatar else ""
            }
        })
        
    return JsonResponse({"status": "error", "message": "Chỉ nhận phương thức POST"}, status=400)

def user_logout(request):
    logout(request) # Xóa SessionID trong Database/Cookie
    return redirect('home') # Chuyển hướng về trang chủ