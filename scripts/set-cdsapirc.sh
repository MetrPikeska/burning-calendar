#!/usr/bin/env bash
# Creates ~/.cdsapirc for the Copernicus EWDS API (Git Bash, macOS, Linux).
# The key is typed hidden and written only to that file in your home directory, outside the repository.
#
# Usage: bash scripts/set-cdsapirc.sh
# Key: ewds.climate.copernicus.eu -> your profile -> API token.
set -euo pipefail

target="$HOME/.cdsapirc"

if [ -e "$target" ]; then
  read -r -p "$target exists. Overwrite? (y/N) " answer
  case "$answer" in
    y | Y) ;;
    *) echo "Cancelled, file unchanged."; exit 0 ;;
  esac
fi

read -r -s -p "Paste your EWDS API key (hidden): " key
echo
key="$(printf '%s' "$key" | tr -d '\r')"

if [ -z "$key" ]; then echo "Empty key, nothing written." >&2; exit 1; fi
case "$key" in
  *[[:space:]]*) echo "The key contains whitespace, check what you pasted. Nothing written." >&2; exit 1 ;;
esac

umask 077
printf 'url: https://ewds.climate.copernicus.eu/api\nkey: %s\n' "$key" > "$target"
unset key

echo "Wrote $target (the key is not displayed)."
echo "Accept the licence on https://ewds.climate.copernicus.eu/datasets/cems-fire-historical-v1 (Download tab), then run:"
echo "  uv run python pipeline/download_factors.py fwi"
