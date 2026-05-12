from rest_framework import serializers
from .models import Task, Board, Status, Priority, Category
from django.contrib.auth import get_user_model
from .models import Board

# Lấy chuẩn Model User của bạn (để phòng trường hợp bạn dùng CustomUser)
User = get_user_model() 

class BoardSerializer(serializers.ModelSerializer):
    # 1. Khai báo 3 trường tính toán động
    total_tasks = serializers.SerializerMethodField()
    done_tasks = serializers.SerializerMethodField()
    completion_pct = serializers.SerializerMethodField()
    
    # 2. Trường nhận mảng username từ giao diện gửi lên
    members = serializers.ListField(
        child=serializers.CharField(), 
        required=False, 
        write_only=True
    )

    class Meta:
        model = Board
        # Hợp nhất lại thành 1 mảng fields duy nhất
        fields = [
            'id', 'name', 'desc', 'color', 'board_type', 
            'is_favorite', 'is_archived', 'updated_at', 'created_at',
            'total_tasks', 'done_tasks', 'completion_pct',
            'owner', 'members' # <-- Thêm owner và members vào đây
        ]
        read_only_fields = ['owner'] # Không cho user tự sửa owner

    # ==========================================
    # CÁC HÀM TÍNH TOÁN (Phải nằm ngang hàng với class Meta)
    # ==========================================
    def get_total_tasks(self, obj):
        return obj.tasks.count() 

    def get_done_tasks(self, obj):
        # status hoàn thành của bạn lưu là 7
        return obj.tasks.filter(status=7).count()

    def get_completion_pct(self, obj):
        total = self.get_total_tasks(obj)
        if total == 0:
            return 0  
        done = self.get_done_tasks(obj)
        return int((done / total) * 100)

    # ==========================================
    # XỬ LÝ LOGIC LƯU THÀNH VIÊN KHI TẠO / SỬA
    # ==========================================
    def create(self, validated_data):
        # 1. Rút danh sách username ra khỏi data (nếu không có thì trả về mảng rỗng [])
        usernames = validated_data.pop('members', [])
        
        # 2. Lưu Board như bình thường (lúc này data đã không còn trường members nên không báo lỗi)
        board = super().create(validated_data)
        
        # 3. Tìm user và lưu vào bảng trung gian
        if usernames:
            # Tìm tất cả các user có username nằm trong danh sách gửi lên
            users = User.objects.filter(username__in=usernames)
            board.members.set(users) # Lưu vào database
            
            # Có thành viên -> Tự ép kiểu thành Board Nhóm
            board.board_type = 'team' 
            board.save()
            
        return board

    def update(self, instance, validated_data):
        # Dùng None để phân biệt: Không gửi `members` lên khác với gửi mảng rỗng `[]`
        usernames = validated_data.pop('members', None)
        
        # Cập nhật thông tin cơ bản của Board (Tên, màu, mô tả...)
        board = super().update(instance, validated_data)
        
        # Nếu giao diện có gửi mảng `members` lên
        if usernames is not None:
            users = User.objects.filter(username__in=usernames)
            
            # .set() rất thông minh: Tự xóa người cũ, thêm người mới sao cho khớp mảng
            board.members.set(users)
            
            # Cập nhật lại board_type cho chuẩn
            if users.exists():
                board.board_type = 'team'
            else:
                board.board_type = 'personal'
            board.save()
            
        return board
    def to_representation(self, instance):
        # Lấy dữ liệu mặc định mà Django chuẩn bị gửi đi
        representation = super().to_representation(instance)
        
        # Đóng gói thêm danh sách thành viên (lấy từ Database) vào dữ liệu trả về
        representation['members'] = [
            {
                "id": user.id,
                "username": user.username,
                # Nếu model User của bạn có trường avatar thì để user.avatar.url, 
                # không thì cứ để rỗng, frontend sẽ tự render chữ cái đầu (như code JS của bạn đã xử lý)
                "avatar": getattr(user, 'avatar', None) 
            }
            for user in instance.members.all()
        ]
        
        return representation
    
class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'color']

class TaskSerializer(serializers.ModelSerializer):
    # Đổi slug_field thành 'name' để khớp với Model của bạn
    status = serializers.SlugRelatedField(slug_field='name', queryset=Status.objects.all())
    priority = serializers.SlugRelatedField(slug_field='name', queryset=Priority.objects.all())
    dueDate = serializers.DateField(source='due_date', required=False, allow_null=True)
    
    category = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), 
        many=True, 
        required=False
    )

    class Meta:
        model = Task
        fields = [
            'id', 'board', 'title', 'desc', 'status', 
            'priority', 'dueDate', 'assignee', 'category',
            'created_at', 'updated_at'
        ]

def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Chuyển đổi dữ liệu trả về từ "category" (trong DB) thành "categories" (số nhiều) để khớp với JS
        representation['categories'] = [cat.id for cat in instance.category.all()]
        return representation