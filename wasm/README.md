# wasm/

This directory holds the container2wasm-generated WebAssembly files.

They are NOT committed to git (too large; see `.gitignore`).

## Generating the files

```bash
# Install container2wasm CLI first:
#   https://github.com/ktock/container2wasm/releases
#   or:  go install github.com/ktock/container2wasm/cmd/c2w@latest

cd ../build
bash build.sh
```

This produces:
| File | Source image | Expected size |
|---|---|---|
| `debian.wasm` | `debian:12` | ~247 MB |
| `fedora.wasm` | `fedora:41` | ~312 MB |

## Hosting for GitHub Pages

GitHub Pages has a 100 MB soft limit per file.  Options:

1. **Git LFS** — `git lfs track "wasm/*.wasm"` then push (free up to 1 GB)
2. **Cloudflare R2** — set `WASM_DEBIAN_URL` / `WASM_FEDORA_URL` in `js/config.js`
3. **Self-host** — any static file server with COOP/COEP headers

## Without the WASM files

The site runs in **simulation mode** automatically when the files are absent —
all metrics are realistically animated so the demo is fully functional for
presentations without pre-building the containers.
