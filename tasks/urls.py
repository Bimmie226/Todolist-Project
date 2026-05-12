from django.urls import include, path
from rest_framework.routers import DefaultRouter
from . import views

# 1. PHẢI KHAI BÁO BIẾN ROUTER TRƯỚC (Dòng này cực kỳ quan trọng)
router = DefaultRouter()
router.register(r'boards', views.BoardViewSet, basename='board')
router.register(r'tasks', views.TaskViewSet, basename='task')
router.register(r'categories', views.CategoryViewSet, basename='category')

urlpatterns = [
    # Trang chủ và danh sách (HTML Render)
    path('', views.home, name='home'),
    path('boards/', views.board_list, name='board_list'),
    path('boards/<uuid:board_id>/tasks/', views.task_list, name='task_list'),

    # 2. SAU ĐÓ MỚI GỌI ROUTER Ở ĐÂY
    path('api/', include(router.urls)),
    path('api/ai-advice/', views.get_ai_dashboard_advice, name='ai_advice'),
]