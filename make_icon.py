"""生成 ProxyEnv 图标。

概念 C「轨道路由」：靛蓝对角渐变圆角底 + 顶部白色泛光 + 右下紫色补光，
两条交叉轨道穿过中央玻璃代理核心，轨道端点光点示意双通道上流动的请求。
几何与 ui/assets/proxyenv-logo.svg 一一对应（SVG viewBox 0 0 128 128）。

两套画法：
- 细节版（>= 64px）：完整的轨道/光点/玻璃球，用于 app-icon、大图标、商店与 iOS/Android 大尺寸。
- 简化版（< 64px 与托盘）：同一造型去掉细碎元素——加粗的交叉轨道 + 实心白核心，避免小尺寸糊成一块。
"""
import io
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

SIZE = 1024
SCALE = 2
S = SIZE * SCALE
ROOT = Path(__file__).resolve().parent
UNIT = S / 128.0            # SVG 单位 → 画布像素
BLUR = 6 * UNIT             # SVG stdDeviation=6
CENTER = S / 2.0
DETAIL_MIN = 64             # 小于该尺寸用简化版
TRAY_SIZE = 64

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


def glow_layer(box, color, opacity, blur, size=S):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(box, fill=(*color, int(round(255 * opacity))))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def rounded_mask(size, radius):
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [size * 4 / 128, size * 4 / 128, size * 121 / 128, size * 121 / 128],
        radius=radius,
        fill=255,
    )
    return mask


# ---------------------------------------------------------------- 细节版


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


def render_detail():
    img = diagonal_gradient(S).convert("RGBA")
    img.putalpha(rounded_mask(S, u(34)))

    img = Image.alpha_composite(img, glow_layer(
        [CENTER - u(82), -u(6) - u(42), CENTER + u(82), -u(6) + u(42)],
        (255, 255, 255), 0.16, BLUR))
    img = Image.alpha_composite(img, glow_layer(
        [u(118) - u(56), u(120) - u(40), u(118) + u(56), u(120) + u(40)],
        (0x8B, 0x5C, 0xF6), 0.40, BLUR))

    img = Image.alpha_composite(img, orbit_layer(38, 15, 5, (255, 255, 255), 0.85, 30))
    img = Image.alpha_composite(img, orbit_layer(38, 15, 5, (0xA5, 0xF3, 0xFC), 0.85, -30))

    draw = ImageDraw.Draw(img)

    def dot(svg_x, svg_y, radius, color, opacity=1.0):
        cx, cy, r = u(svg_x), u(svg_y), u(radius)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*color, int(round(255 * opacity))))

    dot(96.9, 45.0, 5.0, (255, 255, 255))
    dot(31.1, 83.0, 5.0, (0xA5, 0xF3, 0xFC))
    dot(31.1, 45.0, 3.4, (255, 255, 255), 0.65)
    dot(96.9, 83.0, 3.4, (0xA5, 0xF3, 0xFC), 0.65)

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

    img.putalpha(Image.composite(img.getchannel("A"), Image.new("L", (S, S), 0), rounded_mask(S, u(34))))
    return img.resize((SIZE, SIZE), Image.Resampling.LANCZOS)


# ---------------------------------------------------------------- 简化版


def render_small(size, supersample=4):
    """小尺寸专用：同一造型，加粗轨道 + 实心白核心，去掉光点与玻璃渐变"""
    s = size * supersample
    unit = s / 128.0
    center = s / 2.0
    img = diagonal_gradient(s).convert("RGBA")
    img.putalpha(rounded_mask(s, 34 * unit))

    img = Image.alpha_composite(img, glow_layer(
        [center - 82 * unit, -6 * unit - 42 * unit, center + 82 * unit, -6 * unit + 42 * unit],
        (255, 255, 255), 0.16, 6 * unit, size=s))

    draw = ImageDraw.Draw(img)
    bar_half = 38 * unit
    bar_width = int(round(13 * unit))
    for svg_angle, color in ((30, (255, 255, 255)), (-30, (0xA5, 0xF3, 0xFC))):
        a = math.radians(svg_angle)
        dx, dy = bar_half * math.cos(a), bar_half * math.sin(a)
        p1 = (center - dx, center - dy)
        p2 = (center + dx, center + dy)
        draw.line([p1, p2], fill=(*color, 255), width=bar_width)
        for p in (p1, p2):
            draw.ellipse(
                [p[0] - bar_width / 2, p[1] - bar_width / 2, p[0] + bar_width / 2, p[1] + bar_width / 2],
                fill=(*color, 255),
            )

    core_r = 13 * unit
    draw.ellipse(
        [center - core_r, center - core_r, center + core_r, center + core_r],
        fill=(255, 255, 255, 255),
    )
    return img.resize((size, size), Image.Resampling.LANCZOS)


# ---------------------------------------------------------------- 输出

detail = render_detail()
small = render_small(SIZE // 4)
output = ROOT / "app-icon.png"
detail.save(output)
small_output = ROOT / "app-icon-small.png"
small.save(small_output)

detail_256 = detail.resize((256, 256), Image.Resampling.LANCZOS)


def variant_for(size):
    """小尺寸用简化版，大尺寸用细节版"""
    if size < DETAIL_MIN:
        return render_small(size)
    return detail.resize((size, size), Image.Resampling.LANCZOS)


def save_png(relative_path, size):
    path = ROOT / "src-tauri" / "icons" / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    variant_for(size).save(path)


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

# .ico：自己按顺序写目录项——Windows 的 shell 按尺寸挑层，而 Tauri 取 entries()[0]
# 当作窗口图标（任务栏/悬停预览/Alt-Tab 都用它），所以第一项放大的简化版，
# 避免 16px 被放大成模糊的窗口图标（PIL 保存会按尺寸升序排列，第一项必然是 16px）。
ICO_LAYOUT = [128, 256, 64, 48, 32, 24, 16]


def write_ico(path, layout):
    images = [(size, variant_for(size)) for size in layout]

    header = bytearray()
    header += (0).to_bytes(2, "little")      # reserved
    header += (1).to_bytes(2, "little")      # type: icon
    header += len(images).to_bytes(2, "little")

    payloads = []
    for size, im in images:
        buf = io.BytesIO()
        im.resize((size, size), Image.Resampling.LANCZOS).save(buf, format="PNG")
        payloads.append(buf.getvalue())

    offset = len(header) + 16 * len(images)
    directory = bytearray()
    for (size, _), payload in zip(images, payloads):
        directory += bytes([size if size < 256 else 0, size if size < 256 else 0, 0, 0])
        directory += (1).to_bytes(2, "little")     # planes
        directory += (32).to_bytes(2, "little")    # bit count
        directory += len(payload).to_bytes(4, "little")
        directory += offset.to_bytes(4, "little")
        offset += len(payload)

    with open(path, "wb") as fp:
        fp.write(bytes(header) + bytes(directory) + b"".join(payloads))


write_ico(ROOT / "src-tauri" / "icons" / "icon.ico", ICO_LAYOUT)
detail.save(ROOT / "src-tauri" / "icons" / "icon.icns", format="ICNS")

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

print("detail:", output)
print("small :", small_output)
print("ico   :", ICO_LAYOUT, "(", DETAIL_MIN, "px 以下用简化版 )")
