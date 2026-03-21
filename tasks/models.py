from django.db import models
import uuid
from django.contrib.auth.models import User

# Bảng công việc chứa các công việc của người dùng
class Board(models.Model):
    TYPE_CHOICES = [
        ('personal', 'Cá nhân'),
        ('team',     'Nhóm'),
    ]

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner      = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='owned_boards',
        verbose_name='Chủ sở hữu'
    )
    members    = models.ManyToManyField(
        User, blank=True,
        related_name='member_boards',
        verbose_name='Thành viên'
    )

    name       = models.CharField(max_length=50,  verbose_name='Tên board')
    desc       = models.TextField(blank=True, default='', verbose_name='Mô tả')
    color      = models.CharField(max_length=20, default='#5b67f7', verbose_name='Màu nhận biết')
    board_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='personal', verbose_name='Loại')

    is_favorite = models.BooleanField(default=False, verbose_name='Yêu thích')
    is_archived = models.BooleanField(default=False, verbose_name='Lưu trữ')

    created_at  = models.DateTimeField(auto_now_add=True, verbose_name='Ngày tạo')
    updated_at  = models.DateTimeField(auto_now=True,     verbose_name='Cập nhật lúc')

    class Meta:
        ordering = ['-updated_at']
        verbose_name        = 'Board'
        verbose_name_plural = 'Boards'
 
    def __str__(self):
        return f'{self.name} ({self.owner.username})'

# Loại công việc
class Category(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

# Độ ưu tiên
class Priority(models.Model):
    name = models.CharField(max_length=50)

    def __str__(self):
        return self.name

# Trạng thái công việc
class Status(models.Model):
    name = models.CharField(max_length=50)

    def __str__(self):
        return self.name

# Công việc
class Task(models.Model):

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board      = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='tasks')
    
    title      = models.CharField(max_length=200, verbose_name='Tiêu đề')
    desc       = models.TextField(blank=True, default='')

    category   = models.ManyToManyField(Category)  # Một công việc có thể thuộc nhiều loại
    status     = models.ForeignKey(Status, on_delete=models.CASCADE)
    priority   = models.ForeignKey(Priority, on_delete=models.CASCADE)

    due_date   = models.DateField(null=True, blank=True, verbose_name='Deadline')
    assignee   = models.CharField(max_length=50, blank=True, null=True) # Tạm lưu dạng chuỗi để khớp với JS

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        verbose_name        = 'Task'
        verbose_name_plural = 'Tasks'
 
    def __str__(self):
        return f'{self.title} [{self.status}]'

# Nhắc nhở
class Reminder(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    reminder_time = models.DateTimeField()

    def __str__(self):
        return f"Reminder for {self.task.title} at {self.reminder_time}"