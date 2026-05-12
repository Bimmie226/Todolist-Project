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

# Trang chủ
def home(request):
    return render(request, 'tasks/home.html')

@login_required
# Hiển thị danh sách bảng công việc
def board_list(request):
    boards = Board.objects.filter(owner=request.user)
    return render(request, 'tasks/board_list.html', {'boards': boards})

# API View xử lý dữ liệu cho Javascript
class BoardViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
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

class CategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CategorySerializer
    
    def get_queryset(self):
        # Bạn có thể trả về tất cả danh mục hoặc lọc theo user nếu cần
        return Category.objects.all()
    
@login_required
# Hiển thị danh sách công việc theo bảng
def task_list(request, board_id):
    # Sử dụng filter + distinct trước khi gọi get_object_or_404
    # Điều này đảm bảo dù có JOIN Many-to-Many thì cũng chỉ trả về 1 Board duy nhất
    board_queryset = Board.objects.filter(id=board_id).filter(
        Q(owner=request.user) | Q(members=request.user)
    ).distinct()

    board = get_object_or_404(board_queryset)

    # Phân quyền hiển thị Task
    if board.owner_id == request.user.id:
        # Nếu là chủ Board: Thấy TẤT CẢ task
        tasks = Task.objects.filter(board=board)
    else:
        # Nếu chỉ là thành viên: Chỉ thấy task được giao cho mình
        tasks = Task.objects.filter(board=board, assignee=request.user.username)

    return render(request, 'tasks/task_list.html', {
        'board': board,
        'tasks': tasks
    })

class TaskViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TaskSerializer

    def get_queryset(self):
        user = self.request.user
        board_id = self.request.query_params.get('board')

        # Logic gộp: Thấy task nếu là chủ sở hữu board HOẶC là người được giao task
        # Cách này an toàn tuyệt đối với ID dạng số vì Django tự thực hiện phép JOIN SQL
        queryset = Task.objects.filter(
            Q(board__owner=user) | 
            Q(board__members=user, assignee=user.username)
        ).distinct()

        # Nếu đang ở trong một Board cụ thể (khi load danh sách ở Frontend)
        if board_id:
            queryset = queryset.filter(board_id=board_id)

        return queryset

    def perform_create(self, serializer):
        board_id = self.request.data.get('board')
        
        # Tạo QuerySet và dùng distinct để tránh lỗi MultipleObjectsReturned
        board_qs = Board.objects.filter(id=board_id).filter(
            Q(owner=self.request.user) | Q(members=self.request.user)
        ).distinct()
        
        board = get_object_or_404(board_qs)
        serializer.save(board=board)


