"""生成 ProxyEnv 应用图标（1024x1024 PNG）：Win11 风格渐变 + 转发链路符号"""
from PIL import Image, ImageDraw

SIZE = 1024
img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 圆角方形遮罩
mask = Image.new("L", (SIZE, SIZE), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([16, 16, SIZE - 16, SIZE - 16], radius=220, fill=255)

# 垂直渐变背景
top = (11, 87, 208)    # #0B57D0
bottom = (60, 145, 255)  # #3C91FF
for y in range(16, SIZE - 16):
    t = (y - 16) / (SIZE - 32)
    r = int(top[0] + (bottom[0] - top[0]) * t)
    g = int(top[1] + (bottom[1] - top[1]) * t)
    b = int(top[2] + (bottom[2] - top[2]) * t)
    draw.line([(16, y), (SIZE - 16, y)], fill=(r, g, b, 255))

img.putalpha(mask)

# 白色「转发链路」符号：大圆环 + 两端节点 + 弧线
cx, cy = SIZE // 2, SIZE // 2
white = (255, 255, 255, 255)

# 外圈圆环
draw.ellipse([cx - 300, cy - 300, cx + 300, cy + 300], outline=white, width=56)

# 两端节点（左下、右上）
r_node = 86
draw.ellipse([cx - 195 - r_node, cy + 195 - r_node, cx - 195 + r_node, cy + 195 + r_node], fill=white)
draw.ellipse([cx + 195 - r_node, cy - 195 - r_node, cx + 195 + r_node, cy - 195 + r_node], fill=white)

# 连接下方节点的弧线（右半圈内收）——用粗弧模拟"转发"
bbox = [cx - 90, cy - 90, cx + 90, cy + 90]
draw.arc(bbox, start=-20, end=200, fill=white, width=40)

img.save(r"E:\WorkBuddy\Proxy_Env\app-icon.png")
print("icon saved", img.size)