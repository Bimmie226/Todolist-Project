from django.urls import path
from .views import BoardAnalyticsView

urlpatterns = [
    # Đường dẫn sẽ là: /api/charts/boards/<id>/
    path('boards/<uuid:pk>/', BoardAnalyticsView.as_view(), name='board-analytics'),
]