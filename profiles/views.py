from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from .models import Profile

@login_required
def profile_view(request):
    # Lấy profile của user đang đăng nhập, nếu chưa có thì tạo mới (get_or_create)
    profile, created = Profile.objects.get_or_create(user=request.user)
    
    return render(request, 'profiles/profile.html', {
        'profile': profile
    })