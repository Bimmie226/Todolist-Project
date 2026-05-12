from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q, F
from django.db.models.functions import TruncDate
from django.utils import timezone
from datetime import timedelta
from django.shortcuts import get_object_or_404, render
from tasks.models import Task, Board

# ══════════════════════════════════════════════════════════
# 1. VIEW RENDER GIAO DIỆN (HTML)
# ══════════════════════════════════════════════════════════
def dashboard_view(request):
    """Render trang HTML chính của Dashboard (Nơi chứa Chart.js)"""
    return render(request, 'charts/dashboard.html')

# ══════════════════════════════════════════════════════════
# 2. API PHÂN TÍCH DỮ LIỆU (JSON)
# ══════════════════════════════════════════════════════════
class BoardAnalyticsView(APIView):
    # Chỉ cho phép người dùng đã đăng nhập xem dữ liệu của chính họ
    permission_classes = [IsAuthenticated]

    def get(self, request, pk=None):
        user = request.user
        today = timezone.now().date()
        
        # Định nghĩa ID trạng thái dựa trên database thực tế
        STATUS_TODO = 5
        STATUS_IN_PROGRESS = 6
        STATUS_DONE = 7

        # Thiết lập Queryset gốc dựa trên việc chọn Board cụ thể hay xem Tổng quan
        if not pk:
            base_queryset = Task.objects.filter(board__owner=user)
            board_name = "Tổng quan tất cả các dự án"
        else:
            # pk ở đây là chuỗi hex 32 ký tự
            board = get_object_or_404(Board, pk=pk, owner=user)
            base_queryset = Task.objects.filter(board=board)
            board_name = f"Dự án: {board.name}"

        # ── A. THỐNG KÊ TỔNG QUAN (KPI CARDS) ──
        total_tasks = base_queryset.count()
        completed_tasks = base_queryset.filter(status_id=STATUS_DONE).count()
        
        # Task quá hạn: hạn chót < hôm nay VÀ chưa hoàn thành
        overdue_tasks = base_queryset.filter(
            due_date__lt=today
        ).exclude(status_id=STATUS_DONE).count()
        
        # Điểm năng suất tính theo % hoàn thành
        productivity_score = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0

        # ── B. BIỂU ĐỒ NĂNG SUẤT (7 NGÀY QUA) ──
        seven_days_ago = today - timedelta(days=6)
        daily_completed = base_queryset.filter(
            status_id=STATUS_DONE,
            completed_at__date__gte=seven_days_ago
        ).annotate(
            date=TruncDate('completed_at')
        ).values('date').annotate(
            count=Count('id')
        ).order_by('date')

        weekly_stats = []
        for i in range(7):
            day = seven_days_ago + timedelta(days=i)
            day_label = day.strftime('%d/%m')
            count = next((item['count'] for item in daily_completed if item['date'] == day), 0)
            weekly_stats.append({"day": day_label, "completed": count})

        # ── C. BIỂU ĐỒ BURNDOWN (7 NGÀY QUA) ──
        # Tính toán đường Thực tế (Số task còn lại sau mỗi ngày)
        # Và đường Lý tưởng (Giảm dần từ tổng số task về 0)
        burndown_labels = []
        burndown_actual = []
        burndown_ideal = []

        for i in range(7):
            day = seven_days_ago + timedelta(days=i)
            burndown_labels.append(day.strftime('%d/%m'))
            
            # Thực tế: Tổng task - Task đã hoàn thành tính đến cuối ngày này
            completed_up_to_day = base_queryset.filter(
                status_id=STATUS_DONE,
                completed_at__date__lte=day
            ).count()
            remaining = total_tasks - completed_up_to_day
            burndown_actual.append(remaining if remaining >= 0 else 0)

            # Lý tưởng: Giảm dần đều từ tổng số task về 0 trong 7 điểm (index 0 đến 6)
            ideal_val = total_tasks - (total_tasks / 6) * i
            burndown_ideal.append(round(ideal_val, 1) if ideal_val >= 0 else 0)

        # ── D. PHÂN LOẠI TASK THEO DANH MỤC ──
        category_distribution = base_queryset.values(
            label=F('category__name'),
            color=F('category__color')
        ).annotate(
            count=Count('id')
        ).filter(label__isnull=False)

        # ── E. TIẾN ĐỘ TỪNG BOARD ──
        board_progress = []
        if not pk:
            user_boards = Board.objects.filter(owner=user, is_archived=False)
            for b in user_boards:
                b_total = b.tasks.count()
                if b_total == 0: continue
                
                b_done = b.tasks.filter(status_id=STATUS_DONE).count()
                progress = round((b_done / b_total * 100), 1)
                board_progress.append({
                    "name": b.name,
                    "progress": progress,
                    "color": b.color or "#5b67f7"
                })

        # ── F. DỮ LIỆU LỊCH HOẠT ĐỘNG ──
        current_month_tasks = base_queryset.filter(
            status_id=STATUS_DONE,
            completed_at__month=today.month,
            completed_at__year=today.year
        ).annotate(
            day=TruncDate('completed_at')
        ).values('day').annotate(count=Count('id'))
        
        calendar_data = {item['day'].day: item['count'] for item in current_month_tasks}

        # ══════════════════════════════════════════
        # TRẢ VỀ DỮ LIỆU TỔNG HỢP CHO FRONTEND
        # ══════════════════════════════════════════
        return Response({
            "board_name": board_name,
            "stats": {
                "total_boards": Board.objects.filter(owner=user).count() if not pk else 1,
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "overdue_tasks": overdue_tasks,
                "productivity_score": productivity_score,
            },
            "weekly_productivity": weekly_stats,
            "burndown": {
                "labels": burndown_labels,
                "actual": burndown_actual,
                "ideal": burndown_ideal,
            },
            "category_distribution": list(category_distribution),
            "board_progress": board_progress,
            "calendar_data": calendar_data,
        })