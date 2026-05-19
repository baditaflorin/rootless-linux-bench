#!/usr/bin/env bash
# Master build script: converts container images to WASM using container2wasm.
# Prerequisites:
#   • Docker (or Podman) running
#   • container2wasm CLI installed: https://github.com/ktock/container2wasm/releases
#     e.g.:  brew install ktock/tap/container2wasm
#              OR  go install github.com/ktock/container2wasm/cmd/c2w@latest
# Output: wasm/debian.wasm and wasm/fedora.wasm
# These files are large (200–350 MB); commit them via Git LFS or host externally.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../wasm"
mkdir -p "$OUT_DIR"

echo "==> Building Debian 12 WASM"
c2w --target-arch=wasm4wasi debian:12 "$OUT_DIR/debian.wasm"
echo "    done: $(du -sh "$OUT_DIR/debian.wasm" | cut -f1)"

echo "==> Building Fedora 41 WASM"
c2w --target-arch=wasm4wasi fedora:41 "$OUT_DIR/fedora.wasm"
echo "    done: $(du -sh "$OUT_DIR/fedora.wasm" | cut -f1)"

echo ""
echo "Build complete.  Files are in $OUT_DIR"
echo "To serve locally: python3 -m http.server 8080 --directory $SCRIPT_DIR/.."
