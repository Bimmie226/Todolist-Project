from django.urls import path
from .views import BoardAnalyticsView
from . import views

urlpatterns = [
    path('analytics/', views.dashboard_view, name='dashboard_gui'),
    path('api/dashboard/', views.BoardAnalyticsView.as_view(), name='general_dashboard'),
    path('api/boards/<uuid:pk>/', BoardAnalyticsView.as_view(), name='board-analytics'),
]