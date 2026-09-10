"""生成 ProxyEnv 两态托盘图标（64x64 PNG）：
- tray-on.png   启用态：彩色渐变方块 + 白转发环 + 右下角绿色实心点
- tray-off.png  停用态：灰度方块 + 白转发环 + 右下角灰色空心点
16px 托盘显示时绿色/灰色角标清晰可辨，整体颜色差异一眼区分启停。
图形整体较 1024 版 logo 放大 ~20%（环 38→46px），小尺寸下更醒目。
"""
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 64
ROOT = Path(__file__).resolve().parent
ICONS = ROOT / "src-tauri" / "icons"
ON_PNG = ICONS / "tray-on.png"
OFF_PNG = ICONS / "tray-off.png"


def make(bg_top, bg_bottom, status):
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 圆角方形遮罩（内边距 4→3，撑满画布）
    pad = 3
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([pad, pad, SIZE - pad, SIZE - pad], radius=14, fill=255)

    # 垂直渐变背景
    for y in range(pad, SIZE - pad):
        t = (y - pad) / (SIZE - pad * 2)
        r = int(bg_top[0] + (bg_bottom[0] - bg_top[0]) * t)
        g = int(bg_top[1] + (bg_bottom[1] - bg_top[1]) * t)
        b = int(bg_top[2] + (bg_bottom[2] - bg_top[2]) * t)
        draw.line([(pad, y), (SIZE - pad, y)], fill=(r, g, b, 255))
    img.putalpha(mask)

    # 白色「转发链路」符号（按 1024 版 logo 放大 ~20% 到 64）
    cx, cy = SIZE // 2, SIZE // 2
    white = (255, 255, 255, 255)
    draw.ellipse([cx - 23, cy - 23, cx + 23, cy + 23], outline=white, width=4)
    for dx, dy in [(-14, 14), (14, -14)]:
        draw.ellipse([cx + dx - 6, cy + dy - 6, cx + dx + 6, cy + dy + 6], fill=white)
    draw.arc([cx - 7, cy - 7, cx + 7, cy + 7], start=-20, end=200, fill=white, width=4)

    # 右下角状态点（同步放大 20%）
    px, py = SIZE - 9, SIZE - 9
    if status == "on":
        draw.ellipse([px - 6, py - 6, px + 6, py + 6], fill=(46, 204, 113, 255))  # 绿实心
    else:
        draw.ellipse([px - 5, py - 5, px + 5, py + 5], outline=(180, 180, 180, 255), width=2)  # 灰空心
    return img


ON = make((11, 87, 208), (60, 145, 255), "on")
OFF = make((120, 120, 122), (168, 168, 170), "off")
ON.save(ON_PNG)
OFF.save(OFF_PNG)
print("saved:", ON_PNG, "\n      ", OFF_PNG)
