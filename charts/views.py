from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta
from django.shortcuts import get_object_or_404
from django.shortcuts import render
from django.db.models import Sum, Count
from tasks.models import Task, Board # Import thêm Task

# Mượn Model Board từ app tasks
from tasks.models import Board 

def dashboard_view(request):
    return render(request, 'charts/dashboard.html')

class BoardAnalyticsView(APIView):
    def get(self, request, pk=None):
        today = timezone.now().date()
        
        # Đồng bộ tên biến là base_queryset để dùng thống nhất ở dưới
        if not pk:
            base_queryset = Task.objects.all()
            board_name = "Tổng quan tất cả các dự án"
        else:
            base_queryset = Task.objects.filter(board_id=pk)
            board_name = f"Dự án: {get_object_or_404(Board, pk=pk).name}"

        # ==========================================
        # 1. BIỂU ĐỒ NĂNG SUẤT (7 NGÀY QUA)
        # ==========================================
        seven_days_ago = today - timedelta(days=6)
        
        # Dùng base_queryset đã lọc ở trên
        completed_tasks = base_queryset.filter(
            status=7, 
            updated_at__date__gte=seven_days_ago
        ).annotate(
            date=TruncDate('updated_at')
        ).values('date').annotate(
            count=Count('id')
        )

        weekly_data = { (seven_days_ago + timedelta(days=i)).strftime('%a'): 0 for i in range(7) }
        for item in completed_tasks:
            day_str = item['date'].strftime('%a')
            if day_str in weekly_data:
                weekly_data[day_str] = item['count']

        weekly_chart = [{"day": k, "completed": v} for k, v in weekly_data.items()]

        # ==========================================
        # 2. THỐNG KÊ TỔNG QUAN (SỐ LIỆU CARD)
        # ==========================================
        stats = {
            "total_boards": Board.objects.count() if not pk else 1,
            "total_tasks": base_queryset.count(),
            "completed_tasks": base_queryset.filter(status=7).count(),
            "pending_tasks": base_queryset.exclude(status=7).count(),
        }

        return Response({
            "board_name": board_name,
            "stats": stats,
            "weekly_productivity": weekly_chart,
        })