from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta
from django.shortcuts import get_object_or_404

# Mượn Model Board từ app tasks
from tasks.models import Board 

class BoardAnalyticsView(APIView):
    def get(self, request, pk):
        # Lấy Board ra, nếu không thấy thì báo lỗi 404
        board = get_object_or_404(Board, pk=pk)
        today = timezone.now().date()

        # ==========================================
        # 1. BIỂU ĐỒ NĂNG SUẤT (7 NGÀY QUA)
        # ==========================================
        seven_days_ago = today - timedelta(days=6)
        
        completed_tasks = board.tasks.filter(
            status=7, # Status 7 là hoàn thành
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
        # 2. BURN-DOWN CHART (14 NGÀY QUA)
        # ==========================================
        fourteen_days_ago = today - timedelta(days=13)
        total_tasks = board.tasks.count()
        total_done = board.tasks.filter(status=7).count()
        
        current_remaining = total_tasks - total_done 

        done_14_days = board.tasks.filter(
            status=7,
            updated_at__date__gte=fourteen_days_ago
        ).annotate(
            date=TruncDate('updated_at')
        ).values('date').annotate(
            count=Count('id')
        )
        done_dict = {item['date']: item['count'] for item in done_14_days}

        temp_burndown = []
        for i in range(14):
            day = today - timedelta(days=i)
            temp_burndown.append({
                "date": day.strftime('%d/%m'),
                "remaining": current_remaining
            })
            completed_on_day = done_dict.get(day, 0)
            current_remaining += completed_on_day

        burndown_chart = temp_burndown[::-1] 

        return Response({
            "board_name": board.name,
            "weekly_productivity": weekly_chart,
            "burndown": burndown_chart
        })