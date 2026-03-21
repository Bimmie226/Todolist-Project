from rest_framework import serializers
from .models import Task, Board, Status, Priority, Category

class BoardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Board
        fields = '__all__'
        read_only_fields = ['owner'] # Không cho phép user tự sửa trường owner

class TaskSerializer(serializers.ModelSerializer):
    # Đổi slug_field thành 'name' để khớp với Model của bạn
    status = serializers.SlugRelatedField(slug_field='name', queryset=Status.objects.all())
    priority = serializers.SlugRelatedField(slug_field='name', queryset=Priority.objects.all())
    
    # Map dueDate (JS) với due_date (DB)
    dueDate = serializers.DateField(source='due_date', required=False, allow_null=True)

    class Meta:
        model = Task
        # Tạm thời bỏ qua 'category' để test tạo task chạy trước đã
        fields = ['id', 'board', 'title', 'desc', 'status', 'priority', 'dueDate', 'assignee', 'created_at', 'updated_at']

    def to_internal_value(self, data):
        # Xử lý dữ liệu từ JS gửi lên
        if data.get('dueDate') == "":
            data['dueDate'] = None
        
        # CHỖ NÀY CỰC QUAN TRỌNG: 
        # JS gửi lên "Cần làm", nhưng trong DB có thể bạn lưu là "Cần làm" (có dấu)
        # Hãy đảm bảo giá trị gửi lên từ JS khớp 100% với cột 'name' trong Database
        return super().to_internal_value(data)