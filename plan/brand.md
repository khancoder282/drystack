---
status: loading
---

# Quản lý brand ở chế độ github mode (production)
- có cơ chế quản lý brand riêng xử lý confirm ở các file như .yaml, .html (các file dạng khác sẽ không bao giờ bị confect)

# Cơ chế
- khi vào trang admin (/drystack) dựa tên tên đăng nhập ngày giờ tạo ra brand mới với định dạng ` 2026-07-12 - 20:00:00 - Khan Trần - Editer` lưu vào indexDB
- Tất cả các thay đổi đều diễn ra tại brand này (chưa build ngay)
- Khi thực hiện chức năng `deploy` thì merge vào default brand (hiện tại là main)
- nếu có confict thì xử lý confit ở từng file (tab) ở từng file dạng left - right cho chọn trái hay phải
- xử lý confict ở file mới nhất
- xử lý confict và merge xong thì xoá brand đó

# chức năng deploy/brand
- navbar:
    + dropdown chọn brand bỏ thay bằng current brand và nút copy tên brand đó (brand tự động)
    + loại bỏ nút 3 chấm bên cạnh dropdown bỏ luôn chức nang new brand và github repo
    + thêm nút deploy (ActionButton) thực hiện chức năng deploy - khi click vào thì app bắt đầu deploy
    + sau khi merge xong và tạo brand mới thì nút đó sẽ hiện thông tin thay cho toast.process (nút bị disabel chỉ enabled khi deploy xong)
- dashboard
    + bỏ nút new brand
    + current brand kết hợp nút copy ở bên phải