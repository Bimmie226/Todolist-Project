from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import Category, Priority, Status, Task, Board
from django.db.models import Q
from django.db.models import F
from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import api_view, action
from .serializers import BoardSerializer, TaskSerializer, CategorySerializer
from rest_framework import viewsets, permissions
import os
import json
import google.generativeai as genai
from django.http import JsonResponse
from django.utils import timezone
from .models import Task, Board

# Trang chủ
def home(request):
    return render(request, 'tasks/home.html')

@login_required
def board_list(request):
    boards = Board.objects.filter(
        Q(owner=request.user) | Q(members=request.user)
    ).distinct()
    
    return render(request, 'tasks/board_list.html', {
        'boards': boards,
        'is_owner': True # Trang danh sách board ai cũng có quyền 'tạo' board mới của riêng họ
    })

class IsOwnerOrReadOnly(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        return obj.owner == request.user

# API View xử lý dữ liệu cho Javascript
class BoardViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = BoardSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = Board.objects.filter(
            Q(owner=user) | Q(members=user)
        ).distinct() # Dùng distinct() để tránh bị duplicate data
        
        search = self.request.query_params.get('search')
        b_type = self.request.query_params.get('type')
        favorite = self.request.query_params.get('favorite')
        archived = self.request.query_params.get('archived')

        if search:
            queryset = queryset.filter(name__icontains=search)
        if b_type:
            queryset = queryset.filter(board_type=b_type)
        if favorite == 'true':
            queryset = queryset.filter(is_favorite=True)
            
        if archived == 'true':
            queryset = queryset.filter(is_archived=True)
        elif archived == 'false':
            queryset = queryset.filter(is_archived=False)

        return queryset

    # Ghi đè hàm create để tự động gán owner là user hiện tại
    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    # API tùy chỉnh cho Sidebar Stats (/api/boards/stats/)
    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = self.get_queryset()
        data = {
            'total': qs.count(),
            'active': qs.filter(is_archived=False).count(),
            'favorites': qs.filter(is_favorite=True).count(),
            'archived': qs.filter(is_archived=True).count(),
            'personal': qs.filter(board_type='personal').count(),
            'team': qs.filter(board_type='team').count(),
        }
        return Response(data)

    # API tùy chỉnh cho toggle favorite (/api/boards/{id}/toggle_favorite/)
    @action(detail=True, methods=['patch'])
    def toggle_favorite(self, request, pk=None):
        board = self.get_object()
        board.is_favorite = not board.is_favorite
        board.save()
        return Response({'message': 'Cập nhật yêu thích thành công'})

    # API tùy chỉnh cho toggle archive (/api/boards/{id}/toggle_archive/)    
    @action(detail=True, methods=['patch'])
    def toggle_archive(self, request, pk=None):
        board = self.get_object()
        # Chặn thành viên lưu trữ bảng chung của người khác
        if board.owner != request.user:
            return Response({"detail": "Chỉ chủ sở hữu mới có thể lưu trữ bảng."}, 
                            status=status.HTTP_403_FORBIDDEN)
        
        board.is_archived = not board.is_archived
        board.save()
        return Response({'message': 'Cập nhật lưu trữ thành công'})

#--------------------------------------------------------------------------------------------------------------------

class CategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CategorySerializer
    
    def get_queryset(self):
        # Bạn có thể trả về tất cả danh mục hoặc lọc theo user nếu cần
        return Category.objects.all()
    
@login_required
def task_list(request, board_id):
    # 1. Lấy Board và kiểm tra quyền truy cập (Owner hoặc Member)
    board = get_object_or_404(
        Board.objects.prefetch_related('members'), 
        id=board_id
    )
    
    # Kiểm tra quyền truy cập thủ công để chính xác hơn
    if board.owner != request.user and request.user not in board.members.all():
        from django.core.exceptions import PermissionDenied
        raise PermissionDenied # Trả về lỗi 403 nếu không có quyền

    is_owner = (board.owner == request.user)

    # 2. Logic hiển thị Task
    if is_owner:
        tasks = Task.objects.filter(board=board)
    else:
        tasks = Task.objects.filter(board=board)

    return render(request, 'tasks/task_list.html', {
        'board': board,
        'tasks': tasks,
        'is_owner': is_owner
    })
    
class IsBoardOwnerForTask(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        
        return obj.board.owner == request.user

class TaskViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TaskSerializer

    def get_queryset(self):
        user = self.request.user
        board_id = self.request.query_params.get('board')

        queryset = Task.objects.filter(
            Q(board__owner=user) | 
            Q(board__members=user, assignee=user.username)
        ).distinct()

        if board_id:
            queryset = queryset.filter(board_id=board_id)

        return queryset

    def perform_create(self, serializer):
        board_id = self.request.data.get('board')
        board = get_object_or_404(Board, id=board_id, owner=self.request.user)

        serializer.save(board=board)

API_KEY = os.getenv("GEMINI_API_KEY")
# API_KEY = "AIzaSyDgnE-Zh3W3gF9rXEtbsEkYEmY21hnd6m8"
genai.configure(api_key=API_KEY)

def get_ai_dashboard_advice(request):
    if request.method == "POST":
        try:
            # 1. Lấy dữ liệu từ Request
            data = json.loads(request.body)
            user_message = data.get("message", "")

            # 2. Ngữ cảnh dữ liệu (Sửa lỗi board__owner)
            todo_count = Task.objects.filter(board__owner=request.user, status__name__icontains='todo').count()
            done_count = Task.objects.filter(board__owner=request.user, status__name__icontains='done').count()
            overdue_tasks = Task.objects.filter(
                board__owner=request.user, 
                status__name__icontains='todo', 
                due_date__lt=timezone.now()
            ).count()

            # 3. CHỌN MÔ HÌNH AN TOÀN
            available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]

            selected_model = 'models/gemini-1.5-flash'
            if selected_model not in available_models:
                selected_model = available_models[0] if available_models else 'gemini-pro'
            
            print(f"--- Đang dùng mô hình: {selected_model} ---")

            # 4. Gửi Prompt tới AI
            model = genai.GenerativeModel(selected_model)
            prompt = f"""
            Bạn là Taskly AI. Ngữ cảnh: {todo_count} việc cần làm, {done_count} xong, {overdue_tasks} QUÁ HẠN.
            Người dùng hỏi: "{user_message}"
            Hãy trả lời ngắn gọn (dưới 30 từ) bằng Tiếng Việt.
            """

            response = model.generate_content(prompt)
            return JsonResponse({'status': 'success', 'reply': response.text})

        except Exception as e:
            print(f"LỖI CHAT AI: {str(e)}")
            return JsonResponse({'status': 'error', 'message': str(e)}, status=500)
            
    return JsonResponse({'status': 'error', 'message': 'Chỉ chấp nhận POST'}, status=400)
    

