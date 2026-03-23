from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from .models import Category, Priority, Status, Task, Board
from django.db.models import Q
from django.db.models import F
from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import api_view, action
from .models import Board
from .serializers import BoardSerializer

# Trang chủ
def home(request):
    return render(request, 'tasks/home.html')

@login_required
# Hiển thị danh sách bảng công việc
def board_list(request):
    boards = Board.objects.filter(owner=request.user)
    return render(request, 'tasks/board_list.html', {'boards': boards})

# # View hiển thị trang HTML gốc
# @login_required
# def board_list(request):
#     return render(request, 'tasks/board_list.html')

# API View xử lý dữ liệu cho Javascript
class BoardViewSet(viewsets.ModelViewSet):
    serializer_class = BoardSerializer

    def get_queryset(self):
        user = self.request.user
        # LẤY BOARD MÀ MÌNH LÀ CHỦ HOẶC LÀ THÀNH VIÊN
        queryset = Board.objects.filter(
            Q(owner=user) | Q(members=user)
        ).distinct() # Dùng distinct() để tránh bị duplicate data
        
        # Xử lý các filter từ Javascript gửi lên (search, type, favorite, archived)
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
        board.is_archived = not board.is_archived
        board.save()
        return Response({'message': 'Cập nhật lưu trữ thành công'})

#--------------------------------------------------------------------------------------------------------------------

@login_required
# Hiển thị danh sách công việc theo bảng
def task_list(request, board_id):
    board = get_object_or_404(Board, id=board_id, owner=request.user)
    tasks = Task.objects.filter(board=board)

    return render(request, 'tasks/task_list.html', {
        'board': board,
        'tasks': tasks
    })

from .models import Task
from .serializers import TaskSerializer

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer

    def get_queryset(self):
        board_id = self.request.query_params.get('board')
        if board_id:
            return Task.objects.filter(board__id=board_id, board__owner=self.request.user)
        # Nếu không có board_id, trả về tất cả task của user này (phòng hờ)
        return Task.objects.filter(board__owner=self.request.user)

    # Để khi lưu Task mới, nó biết gán vào Board nào
    def perform_create(self, serializer):
        # Lấy board_id từ dữ liệu POST gửi lên
        board_id = self.request.data.get('board')
        board = get_object_or_404(Board, id=board_id, owner=self.request.user)
        serializer.save(board=board)