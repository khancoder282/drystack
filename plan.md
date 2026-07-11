# tính năng visual dom - xử lý field.text
- có thể đánh dấu 1 thẻ với data-dry="{type}::{name}::{property}"
vd: <h1 data-dry="singleton::home::heading">

hàm helper trong astro dạng

```
---
 import config from './drystack.config.ts'

 const d = dry(config).singleton.home
---

<h1 {...d.item('heading')}>

<h1>{d.heading}</h1>
```

xuất ra html dạng 

```
<h1 data-dry="singleton::home::heading">Hello from Drystack</h1>

<h1><span data-dry="singleton::home::heading" style="display: contents">Hello from Drystack</span></h1>
```

Lưu ý khi xuất ra html kể cả production 
- phải kèm thêm 1 scrip nhỏ trong mỗi trang html
- tạo 1 thẻ shadow root để chạy react app
- nhận json base64 từ header hoặc trong indexDB
- thay đổi child bằng data-dry

# cách hoạt động 
- có 1 menu bar floating ở bottom screen
- có 1 nút edit (khi bật thêm class="editing" vào body) - thêm css vào
- các thẻ data-dry sẽ outline màu xanh opacity: 0.5, hover chuyển qua 0.8 và chuyển qua dạng contentEditer="only-text"
- khi edit sẽ lưu vào IndexDB theo cấu trúc json tương đồng với scheme config
- khi nhấn lưu gửi data json đó về server thông qua api có sẵn lưu vào file, thành công xoá dataDB
- khi chưa lưu thì khi reload phải lấy thông tin db ghi đề lên các thẻ hiện tại

### Lưu ý: giúp tôi hoàn thiện kế hoạch ở mvp 1 chỉ handle trước singletone và field.text yêu cầu chạy được trên dev và production khi build thành html