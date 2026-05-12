# Git

1. git commit - Ghi lại thay đổi
   - Dùng để lưu lại các thay đổi đã được staged (đã git add) vào repository cục bộ kèm một thông điệp mô tả.
   - Lệnh: git commit -m "Thông điệp commit"
2. git push - Đẩy code lên server
   - Đẩy các commit từ kho lưu trữ cục bộ (local) lên kho lưu trữ từ xa (remote).
   - Lệnh: git push origin <tên*nhánh>
     *Lưu ý: Thao tác này cập nhật code lên server, cần chú ý tránh ghi đè.\*
3. git branch - Quản lý nhánh
   - Liệt kê, tạo mới hoặc xóa các nhánh (branch) trong dự án để phát triển tính năng riêng biệt.
   - Liệt kê nhánh: git branch
   - Tạo nhánh mới: git branch <tên_nhánh>
   - Xóa nhánh: git branch -d <tên_nhánh>
   - Chuyển nhánh: git checkout <tên_nhánh> hoặc git switch <tên_nhánh>

4. git pull - Cập nhật từ server-
   - Lấy và tích hợp (merge) các thay đổi từ kho lưu trữ từ xa (remote) về nhánh hiện tại ở kho cục bộ.
   - Lệnh: git pull origin <tên_nhánh>
   - Pull kèm rebase: git pull --rebase (để giữ lịch sử commit thẳng hàng).

# Lệnh trên terminal về backend python

- pip install django: tải django
- django-admin startproject name: khởi tạo app mới
- cd name
- python manage.py makemigrations : dùng sau khi tạo các models
- python manage.py migrate: khởi tạo accs file cần dùng
- python manage.py runserver: tạo server ảo (ví dụ cổng 8888)
- python manage.py createsuperuser: tạo tk user
- python manage.py runserver: chạy server
- cd ..(quay về thư mục trước); cd name(quay về thư mục con)
- python manage.py startapp name: tạo module
- Bấm vô settings.py để ghi thêm module vừa đặt tên vào mục install_app
- Bấm views.py để def
- Bấm urls.py để import thư viện module

# Liên kết với DATABASE

- pip install pymysql: cài mysql
- python manage.py migrate: để lưu
  _Chú ý: nếu không chạy được thì thêm lệnh vào file *init.py*_: import pymysql
  pymysql.install_as_MySQLdb()

# App: Tạo và liên kết các app với url

- Bước 1: Tạo app bằng lệnh **python manage.py startapp** name
- Bước 2: Mở phần **views.py** của app và thêm lệnh def
- Bước 3: Mở **urls.py** của Site1 copy đường dẫn là sửa lại
- Bước 4: Vô **settings.py** để thêm vô **INSTALLAPP** là 'app'
- Bước 5: Vô lại **urls.py** của Site1 và thêm đường dẫn của app
