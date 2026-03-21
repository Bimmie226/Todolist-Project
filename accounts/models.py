from django.db import models

# Create your models here.
class SomeModel(models.Model):
    # Dùng 'profiles.Profile' thay vì import trực tiếp
    profile = models.ForeignKey('profiles.Profile', on_delete=models.CASCADE)