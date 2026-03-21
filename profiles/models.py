from django.db import models
from django.contrib.auth.models import User


class Profile(models.Model):
    THEME_CHOICES = (
        ('light', 'Light'),
        ('dark', 'Dark'),
    )
    theme         = models.CharField(max_length=10, choices=THEME_CHOICES, default='light')

    user          = models.OneToOneField( User, on_delete=models.CASCADE, related_name='profile')
    name          = models.CharField(max_length=200, verbose_name='Tên user')
    avatar        = models.ImageField(upload_to='avatars/', default='avatars/default.png', blank=True)
    phone         = models.CharField(max_length=15, blank=True, null=True)
    address       = models.CharField(max_length=255, blank=True)
    birth_date    = models.DateField(blank=True, null=True)
    bio          = models.TextField(blank=True, default='')
    
    last_login_ip = models.GenericIPAddressField(blank=True, null=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)
 
    def __str__(self):
        return f"{self.user.username} Profile"