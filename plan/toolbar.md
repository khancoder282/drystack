# Toolbar vistual editing inline

## Yêu cầu
- ngôn ngữ tiếng anh chuẩn
- tận dụng ui của @keystar/ui
- icon edit duy nhất (kích thước tương đồng menu) bên trái dưới dùng, khi click vào thì icon đổi thành x (hiệu ứng xoay, mờ thu nhỏ phóng to để chuyển dổi - không đổi màu dùng màu background) - menu xuất hiện có hiệu ứng collapse
- khi bật chế độ edit bên phải nút xuất hiện menu riêng có nút
    + thêm chức năng ref đi đến trang drystack tương ứng, ref này khi hover có dropdown hiện đến chỗ này thiết thì trong 1 trang có thể có nhiều chỗ chính sửa
    + review dialog diff (số lượng diff nằm ở đây dưới dạng bagde) (icon eye)
    + save enabled khi có ít nhất 1 chỗ sửa
- ui chưa tương ứng dark, light