"""从 app-icon.png 生成 ProxyEnv 两态托盘图标（64x64 PNG）：
启用态保留品牌蓝并叠加绿色圆点，停用态去饱和并改用灰色空心点。
修改 logo 后先运行 make_icon.py，再运行本脚本。
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parent
ICONS = ROOT / "src-tauri" / "icons"
SOURCE = ROOT / "app-icon.png"


def tray_icon(enabled):
    base = Image.open(SOURCE).convert("RGBA")
    if not enabled:
        gray = ImageOps.grayscale(base)
        base = Image.merge("RGBA", (*gray.convert("RGB").split(), base.getchannel("A")))
        base = ImageEnhance.Contrast(base).enhance(0.75)

    size = 256
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(base.resize((size, size), Image.Resampling.LANCZOS))
    draw = ImageDraw.Draw(canvas)
    cx = cy = 216

    if enabled:
        draw.ellipse([cx - 33, cy - 33, cx + 33, cy + 33], fill=(255, 255, 255, 255))
        draw.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=(46, 204, 113, 255))
    else:
        draw.ellipse([cx - 33, cy - 33, cx + 33, cy + 33], fill=(255, 255, 255, 255))
        draw.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=(112, 116, 122, 255))
        draw.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(238, 240, 243, 255))

    return canvas.resize((64, 64), Image.Resampling.LANCZOS)


tray_icon(True).save(ICONS / "tray-on.png")
tray_icon(False).save(ICONS / "tray-off.png")
print("saved:", ICONS / "tray-on.png", "\n      ", ICONS / "tray-off.png")
