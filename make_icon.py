"""生成 ProxyEnv 应用图标（1024x1024 PNG）。

概念 C「轨道路由」：靛蓝对角渐变圆角底 + 顶部白色泛光 + 右下紫色补光，
两条交叉轨道穿过中央玻璃代理核心，轨道端点光点示意双通道上流动的请求。
几何与 ui/assets/proxyenv-logo.svg 一一对应（SVG viewBox 0 0 128 128）。
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
SCALE = 2
S = SIZE * SCALE
ROOT = Path(__file__).resolve().parent
UNIT = S / 128.0            # SVG 单位 → 画布像素
BLUR = 6 * UNIT             # SVG stdDeviation=6
CENTER = S / 2.0

BG_STOPS = [
    (0.0, (0x4F, 0x8D, 0xFF)),
    (0.55, (0x4F, 0x46, 0xE5)),
    (1.0, (0x6D, 0x28, 0xD9)),
]


def u(value):
    return value * UNIT


def color_at(t):
    """对角渐变取色：t=0 左上 → 1 右下"""
    for i in range(len(BG_STOPS) - 1):
        a, ca = BG_STOPS[i]
        b, cb = BG_STOPS[i + 1]
        if a <= t <= b:
            k = 0.0 if b == a else (t - a) / (b - a)
            return tuple(int(ca[j] + (cb[j] - ca[j]) * k) for j in range(3))
    return BG_STOPS[-1][1]


def diagonal_gradient(size):
    """先画小尺寸再做双三次放大，避免逐像素扫描整个画布"""
    small = Image.new("RGB", (256, 256))
    pixels = small.load()
    for y in range(256):
        for x in range(256):
            pixels[x, y] = color_at((x + y) / 510.0)
    return small.resize((size, size), Image.Resampling.BICUBIC)


def gradient_tile():
    img = diagonal_gradient(S).convert("RGBA")
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [u(4), u(4), u(121), u(121)],
        radius=u(34),
        fill=255,
    )
    img.putalpha(mask)
    return img


def glow_layer(box, color, opacity, blur):
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(box, fill=(*color, int(round(255 * opacity))))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def orbit_layer(rx, ry, width, color, opacity, svg_angle):
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(
        [CENTER - u(rx), CENTER - u(ry), CENTER + u(rx), CENTER + u(ry)],
        outline=(*color, int(round(255 * opacity))),
        width=int(round(u(width))),
    )
    # SVG 正角度为屏幕顺时针，PIL 正角度为逆时针 → 取负号
    return layer.rotate(-svg_angle, resample=Image.Resampling.BICUBIC, center=(CENTER, CENTER))


def glass_core(radius, top_alpha, bottom_alpha):
    """半透明白球体：垂直方向 55% → 10% 的白色渐变，做出玻璃质感"""
    box = [int(CENTER - u(radius)), int(CENTER - u(radius)), int(CENTER + u(radius)), int(CENTER + u(radius))]
    w = box[2] - box[0]
    h = box[3] - box[1]

    alpha = Image.new("L", (1, h))
    for y in range(h):
        k = y / max(1, h - 1)
        alpha.putpixel((0, y), int(round(255 * (top_alpha + (bottom_alpha - top_alpha) * k))))
    alpha = alpha.resize((w, h), Image.Resampling.BICUBIC)

    circle = Image.new("L", (w, h), 0)
    ImageDraw.Draw(circle).ellipse([0, 0, w - 1, h - 1], fill=255)
    alpha = Image.composite(alpha, Image.new("L", (w, h), 0), circle)

    ball = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    ball.putalpha(alpha)

    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(ball, (box[0], box[1]))
    return out


img = gradient_tile()

# 泛光（会被圆角裁掉，模拟玻璃折射）
img = Image.alpha_composite(img, glow_layer(
    [CENTER - u(82), -u(6) - u(42), CENTER + u(82), -u(6) + u(42)],
    (255, 255, 255), 0.16, BLUR))
img = Image.alpha_composite(img, glow_layer(
    [u(118) - u(56), u(120) - u(40), u(118) + u(56), u(120) + u(40)],
    (0x8B, 0x5C, 0xF6), 0.40, BLUR))

# 两条交叉轨道
img = Image.alpha_composite(img, orbit_layer(38, 15, 5, (255, 255, 255), 0.85, 30))
img = Image.alpha_composite(img, orbit_layer(38, 15, 5, (0xA5, 0xF3, 0xFC), 0.85, -30))

draw = ImageDraw.Draw(img)


def dot(svg_x, svg_y, radius, color, opacity=1.0):
    cx, cy, r = u(svg_x), u(svg_y), u(radius)
    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        fill=(*color, int(round(255 * opacity))),
    )


dot(96.9, 45.0, 5.0, (255, 255, 255))
dot(31.1, 83.0, 5.0, (0xA5, 0xF3, 0xFC))
dot(31.1, 45.0, 3.4, (255, 255, 255), 0.65)
dot(96.9, 83.0, 3.4, (0xA5, 0xF3, 0xFC), 0.65)

# 中央代理核心：外泛光 + 玻璃球 + 实心点
img = Image.alpha_composite(img, glow_layer(
    [CENTER - u(19), CENTER - u(19), CENTER + u(19), CENTER + u(19)],
    (255, 255, 255), 0.30, BLUR))
img = Image.alpha_composite(img, glass_core(15, 0.55, 0.10))

draw = ImageDraw.Draw(img)
core = u(15)
draw.ellipse(
    [CENTER - core, CENTER - core, CENTER + core, CENTER + core],
    outline=(255, 255, 255, int(round(255 * 0.6))),
    width=int(round(u(1.5))),
)
dot(64.0, 64.0, 5.0, (255, 255, 255))

# 回到圆角裁切 + 输出
final_mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(final_mask).rounded_rectangle(
    [u(4), u(4), u(121), u(121)],
    radius=u(34),
    fill=255,
)
img.putalpha(Image.composite(img.getchannel("A"), Image.new("L", (S, S), 0), final_mask))

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
