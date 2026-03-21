from django.contrib import admin

# Register your models here.

from django.contrib import admin
from .models import Board, Priority, Status, Task, Category

admin.site.register(Board)
admin.site.register(Task)
admin.site.register(Status)
admin.site.register(Priority)
admin.site.register(Category)