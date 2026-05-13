from rest_framework import serializers
from .models import Task, Board, Status, Priority, Category
from django.contrib.auth import get_user_model

# Lấy chuẩn Model User
User = get_user_model() 

class BoardSerializer(serializers.ModelSerializer):
    total_tasks = serializers.SerializerMethodField()
    done_tasks = serializers.SerializerMethodField()
    completion_pct = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()
    
    # Trường nhận mảng username từ giao diện
    members = serializers.ListField(
        child=serializers.CharField(), 
        required=False, 
        write_only=True
    )

    class Meta:
        model = Board
        fields = [
            'id', 'name', 'desc', 'color', 'board_type', 
            'is_favorite', 'is_archived', 'updated_at', 'created_at',
            'total_tasks', 'done_tasks', 'completion_pct',
            'owner', 'members', 'is_owner'
        ]
        read_only_fields = ['owner'] 

    def get_is_owner(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.owner == request.user
        return False

    def get_total_tasks(self, obj):
        return obj.tasks.count() 

    def get_done_tasks(self, obj):
        # Tối ưu: Lọc theo tên trạng thái thay vì ID số 7
        return obj.tasks.filter(status__name__icontains='done').count()

    def get_completion_pct(self, obj):
        total = self.get_total_tasks(obj)
        if total == 0:
            return 0  
        done = self.get_done_tasks(obj)
        return int((done / total) * 100)

    def create(self, validated_data):
        usernames = validated_data.pop('members', [])
        board = super().create(validated_data)
        
        if usernames:
            users = User.objects.filter(username__in=usernames)
            board.members.set(users)
            board.board_type = 'team' 
            board.save()
        return board

    def update(self, instance, validated_data):
        usernames = validated_data.pop('members', None)
        board = super().update(instance, validated_data)
        
        if usernames is not None:
            users = User.objects.filter(username__in=usernames)
            board.members.set(users)
            board.board_type = 'team' if users.exists() else 'personal'
            board.save()
        return board

    def to_representation(self, instance):
        representation = super().to_representation(instance)

        representation['members'] = [
            {
                "id": user.id,
                "username": user.username,
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

    # ĐÃ ĐƯA VÀO TRONG CLASS:
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Trả về mảng ID để khớp với logic xử lý của Javascript
        representation['categories'] = [cat.id for cat in instance.category.all()]
        return representation