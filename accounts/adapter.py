from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.account.models import EmailAddress
from django.contrib.auth.models import User

class MySocialAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        # 1. Nếu tài khoản social đã tồn tại (đã từng liên kết), cho qua
        if sociallogin.is_existing:
            return

        # 2. Nếu chưa liên kết, kiểm tra email trong DB
        email = sociallogin.user.email
        if not email:
            return

        try:
            # Tìm user có email trùng khớp
            user = User.objects.get(email=email)
            
            # 3. Tiến hành kết nối tài khoản Social với User hiện tại
            sociallogin.connect(request, user)
            
            # (Tùy chọn) Đảm bảo email này đã được đánh dấu là verified
            EmailAddress.objects.get_or_create(
                user=user, 
                email=email, 
                defaults={'verified': True, 'primary': True}
            )
        except User.DoesNotExist:
            # Nếu chưa có user thì Allauth sẽ tự động tạo mới (Auto Signup)
            pass