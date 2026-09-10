#!/usr/bin/env bash
# ProxyEnv 便携构建脚本
# 用法: bash scripts/build.sh
# 说明: Tauri 仅在前端目录文件变化时不会自动重编 Rust crate → 内嵌资源不更新。
#       必须 touch src/main.rs 强制重编译，才会重新压缩并嵌入 ui/ 资源。
set -e
cd "$(dirname "$0")/../src-tauri"
TARGET_DIR="${CARGO_TARGET_DIR:-target}"

echo "== 强制重编译（touch main.rs 以重新嵌入前端资源） =="
touch src/main.rs
cargo build --release --target-dir "$TARGET_DIR"

echo "== 校验嵌入资源 =="
ASSET_DIR=$(find "$TARGET_DIR/release/build" -path "*out/tauri-codegen-assets" -type d -newer Cargo.toml 2>/dev/null | head -1 || true)
if [ -n "$ASSET_DIR" ]; then
  PYTHON=""
  for CANDIDATE in "${PYTHON:-}" python3 python; do
    [ -n "$CANDIDATE" ] || continue
    if command -v "$CANDIDATE" >/dev/null 2>&1 && "$CANDIDATE" -c "import brotli" 2>/dev/null; then
      PYTHON="$CANDIDATE"
      break
    fi
  done
  if [ -n "$PYTHON" ]; then
    "$PYTHON" - "$ASSET_DIR" <<'PY'
import brotli, glob, os, sys
d = sys.argv[1]
for fp in glob.glob(os.path.join(d, "*")):
    try:
        out = brotli.decompress(open(fp, "rb").read())
    except Exception:
        continue
    if b"flexDirection" in out or b"modal-settings" in out or b"apply-banner" in out:
        print("OK 前端资源为最新版:", fp)
        sys.exit(0)
print("WARN 未能从资源中定位最新特征（build 可能未含最新前端）")
PY
  else
    echo "WARN 无可用 brotli 校验环境，跳过资源校验"
  fi
else
  echo "WARN 未找到资源目录"
fi

echo "== 分发到 dist =="
mkdir -p ../dist
cp "$TARGET_DIR/release/ProxyEnv.exe" ../dist/ProxyEnv.exe
echo "完成: ../dist/ProxyEnv.exe ($(du -h ../dist/ProxyEnv.exe | cut -f1))"
