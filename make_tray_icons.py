"""从 app-icon-small.png 生成 ProxyEnv 两态托盘图标（64x64 PNG）。

托盘尺寸很小，用简化版 logo 保证清晰；两态只靠颜色区分：
- 启用：彩色（品牌蓝紫）
- 停用：灰度 + 略降对比
不再叠加绿点/灰点角标（肉眼按颜色区分即可）。
修改 logo 后先运行 make_icon.py，再运行本脚本。
"""
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parent
ICONS = ROOT / "src-tauri" / "icons"
SOURCE = ROOT / "app-icon-small.png"
SIZE = 64


def tray_icon(enabled):
    base = Image.open(SOURCE).convert("RGBA").resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    if enabled:
        return base

    gray = ImageOps.grayscale(base)
    base = Image.merge("RGBA", (*gray.convert("RGB").split(), base.getchannel("A")))
    return ImageEnhance.Contrast(base).enhance(0.78)


tray_icon(True).save(ICONS / "tray-on.png")
tray_icon(False).save(ICONS / "tray-off.png")
print("saved:", ICONS / "tray-on.png", "\n      ", ICONS / "tray-off.png")
