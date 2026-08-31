"""生成 ProxyEnv 两态托盘图标（64x64 PNG）：
- tray-on.png   启用态：彩色渐变方块 + 白转发环 + 右下角绿色实心点
- tray-off.png  停用态：灰度方块 + 白转发环 + 右下角灰色空心点
16px 托盘显示时绿色/灰色角标清晰可辨，整体颜色差异一眼区分启停。
"""
from PIL import Image, ImageDraw

SIZE = 64
ON_PNG = r"E:\WorkBuddy\Proxy_Env\src-tauri\icons\tray-on.png"
OFF_PNG = r"E:\WorkBuddy\Proxy_Env\src-tauri\icons\tray-off.png"


def make(bg_top, bg_bottom, status):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 圆角方形遮罩
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([4, 4, SIZE - 4, SIZE - 4], radius=14, fill=255)

    # 垂直渐变背景
    for y in range(4, SIZE - 4):
        t = (y - 4) / (SIZE - 8)
        r = int(bg_top[0] + (bg_bottom[0] - bg_top[0]) * t)
        g = int(bg_top[1] + (bg_bottom[1] - bg_top[1]) * t)
        b = int(bg_top[2] + (bg_bottom[2] - bg_top[2]) * t)
        draw.line([(4, y), (SIZE - 4, y)], fill=(r, g, b, 255))
    img.putalpha(mask)

    # 白色「转发链路」符号（按 1024 版 logo 等比例缩到 64）
    cx, cy = SIZE // 2, SIZE // 2
    white = (255, 255, 255, 255)
    draw.ellipse([cx - 19, cy - 19, cx + 19, cy + 19], outline=white, width=4)
    for dx, dy in [(-12, 12), (12, -12)]:
        draw.ellipse([cx + dx - 5, cy + dy - 5, cx + dx + 5, cy + dy + 5], fill=white)
    draw.arc([cx - 6, cy - 6, cx + 6, cy + 6], start=-20, end=200, fill=white, width=3)

    # 右下角状态点
    px, py = SIZE - 9, SIZE - 9
    if status == "on":
        draw.ellipse([px - 5, py - 5, px + 5, py + 5], fill=(46, 204, 113, 255))  # 绿实心
    else:
        draw.ellipse([px - 4, py - 4, px + 4, py + 4], outline=(180, 180, 180, 255), width=2)  # 灰空心
    return img


ON = make((11, 87, 208), (60, 145, 255), "on")
OFF = make((120, 120, 122), (168, 168, 170), "off")
ON.save(ON_PNG)
OFF.save(OFF_PNG)
print("saved:", ON_PNG, "\n      ", OFF_PNG)