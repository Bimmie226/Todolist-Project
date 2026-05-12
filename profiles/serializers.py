from rest_framework import serializers
from .models import Profile

class ProfileSerializer(serializers.ModelSerializer):
    # Sử dụng 'address' từ @property để lấy dữ liệu đã giải mã AES-256
    address = serializers.CharField(source='address', allow_blank=True)

    class Meta:
        model = Profile
        fields = [
            'name', 
            'phone', 
            'address', 
            'birth_date', 
            'bio', 
            'theme', 
            'avatar'
        ]
        read_only_fields = ['user'] # User thường không cho phép đổi qua API này