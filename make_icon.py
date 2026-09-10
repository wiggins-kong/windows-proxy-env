"""生成 ProxyEnv 应用图标（1024x1024 PNG）：
Win11 圆角蓝底 + 双向代理路径，强调流量经过代理后继续转发。
"""
import math
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
SCALE = 2
S = SIZE * SCALE
ROOT = Path(__file__).resolve().parent


def gradient_tile():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    top = (11, 87, 208)      # #0B57D0
    bottom = (60, 145, 255)  # #3C91FF

    for y in range(16 * SCALE, S - 16 * SCALE):
        t = (y - 16 * SCALE) / (S - 32 * SCALE)
        color = tuple(
            int(top[i] + (bottom[i] - top[i]) * t)
            for i in range(3)
        )
        draw.line([(16 * SCALE, y), (S - 16 * SCALE, y)], fill=(*color, 255))

    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [16 * SCALE, 16 * SCALE, S - 16 * SCALE, S - 16 * SCALE],
        radius=220 * SCALE,
        fill=255,
    )
    img.putalpha(mask)
    return img


def draw_arrow_arc(draw, start, end, color, width):
    cx = cy = S // 2
    radius = 288 * SCALE
    line_width = width * SCALE
    bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
    draw.arc(bbox, start=start, end=end, fill=color, width=line_width)

    end_rad = math.radians(end)
    ex = cx + radius * math.cos(end_rad)
    ey = cy + radius * math.sin(end_rad)
    tangent = (-math.sin(end_rad), math.cos(end_rad))
    normal = (-tangent[1], tangent[0])

    cap_radius = line_width / 2
    draw.ellipse(
        [ex - cap_radius, ey - cap_radius, ex + cap_radius, ey + cap_radius],
        fill=color,
    )

    tip_len = 52 * SCALE
    wing = 42 * SCALE
    tip = (ex + tangent[0] * tip_len, ey + tangent[1] * tip_len)
    wing_a = (ex + normal[0] * wing, ey + normal[1] * wing)
    wing_b = (ex - normal[0] * wing, ey - normal[1] * wing)
    draw.line([wing_a, tip, wing_b], fill=color, width=line_width, joint="curve")
    for point in (wing_a, wing_b):
        draw.ellipse(
            [
                point[0] - cap_radius,
                point[1] - cap_radius,
                point[0] + cap_radius,
                point[1] + cap_radius,
            ],
            fill=color,
        )


img = gradient_tile()
draw = ImageDraw.Draw(img)

# 上半路径：向左上流入，经顶部转发至右上。
draw_arrow_arc(draw, 200, 340, (255, 255, 255, 255), 64)
# 下半路径：向右下流入，经底部转发至左下。
draw_arrow_arc(draw, 20, 160, (184, 226, 255, 255), 64)

# 中心节点保持留白，让两条流线在 16px 下仍各自清晰。
cx = cy = S // 2
draw.ellipse(
    [cx - 55 * SCALE, cy - 55 * SCALE, cx + 55 * SCALE, cy + 55 * SCALE],
    fill=(255, 255, 255, 255),
)
draw.ellipse(
    [cx - 25 * SCALE, cy - 25 * SCALE, cx + 25 * SCALE, cy + 25 * SCALE],
    fill=(31, 111, 220, 255),
)

img = img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
output = ROOT / "app-icon.png"
img.save(output)


def save_png(relative_path, size):
    path = ROOT / "src-tauri" / "icons" / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    img.resize((size, size), Image.Resampling.LANCZOS).save(path)


# Tauri / Windows / Store
for filename, size in {
    "32x32.png": 32,
    "64x64.png": 64,
    "128x128.png": 128,
    "128x128@2x.png": 256,
    "icon.png": 512,
    "Square30x30Logo.png": 30,
    "Square44x44Logo.png": 44,
    "Square71x71Logo.png": 71,
    "Square89x89Logo.png": 89,
    "Square107x107Logo.png": 107,
    "Square142x142Logo.png": 142,
    "Square150x150Logo.png": 150,
    "Square284x284Logo.png": 284,
    "Square310x310Logo.png": 310,
    "StoreLogo.png": 50,
}.items():
    save_png(filename, size)

img.save(
    ROOT / "src-tauri" / "icons" / "icon.ico",
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
img.save(ROOT / "src-tauri" / "icons" / "icon.icns", format="ICNS")

# Android
for density, size in {
    "mdpi": 48,
    "hdpi": 49,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}.items():
    for filename in ("ic_launcher.png", "ic_launcher_round.png"):
        save_png(f"android/mipmap-{density}/{filename}", size)
    save_png(f"android/mipmap-{density}/ic_launcher_foreground.png", int(size * 2.25))

# iOS
for filename, size in {
    "AppIcon-20x20@1x.png": 20,
    "AppIcon-20x20@2x.png": 40,
    "AppIcon-20x20@2x-1.png": 40,
    "AppIcon-20x20@3x.png": 60,
    "AppIcon-29x29@1x.png": 29,
    "AppIcon-29x29@2x.png": 58,
    "AppIcon-29x29@2x-1.png": 58,
    "AppIcon-29x29@3x.png": 87,
    "AppIcon-40x40@1x.png": 40,
    "AppIcon-40x40@2x.png": 80,
    "AppIcon-40x40@2x-1.png": 80,
    "AppIcon-40x40@3x.png": 120,
    "AppIcon-60x60@2x.png": 120,
    "AppIcon-60x60@3x.png": 180,
    "AppIcon-76x76@1x.png": 76,
    "AppIcon-76x76@2x.png": 152,
    "AppIcon-83.5x83.5@2x.png": 167,
    "AppIcon-512@2x.png": 1024,
}.items():
    save_png(f"ios/{filename}", size)

print("icons saved", output, "and src-tauri/icons")
