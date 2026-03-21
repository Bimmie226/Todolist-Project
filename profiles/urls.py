from django.urls import path
from . import views

urlpatterns = [
    # Đây là đường dẫn trả về file HTML của bạn
    path('profile/', views.profile_view, name='profile'), 
    
    # THÊM 2 ĐƯỜNG DẪN API NÀY VÀO:
    path('profile/api/me/', views.get_profile_api, name='get_profile_api'),
    path('profile/api/update/', views.update_profile_api, name='update_profile_api'),
]