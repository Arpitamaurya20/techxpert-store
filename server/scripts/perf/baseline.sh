#!/usr/bin/env bash
# Before/after numbers for the product list and home calls: time to first byte, total time, KB on the wire.
# Usage: BASE=https://store.jiotechxpert.com scripts/perf/baseline.sh [runs]
# Run once before the change and once after, keep both outputs. Customer view (no token).
set -euo pipefail
BASE="${BASE:-https://store.jiotechxpert.com}"
RUNS="${1:-10}"

urls=(
  "/catalog/products?limit=50"
  "/catalog/products?view=card&total=false&limit=20"
  "/catalog/products?featured=true&limit=10"
  "/catalog/products?view=card&total=false&featured=true&limit=10"
  "/catalog/products?search=fan&limit=20"
  "/catalog/products?view=card&total=false&search=fan&limit=20"
  "/catalog/products?page=500&limit=50"
  "/catalog/categories"
  "/catalog/brands"
  "/cms/sections"
  "/cms/banners"
  "/catalog/products/5"
)

median() { sort -n | awk '{a[NR]=$1} END{print a[int((NR+1)/2)]}'; }

printf '%-62s %8s %8s %8s %8s\n' "request (gzip off | on)" "TTFB ms" "total ms" "KB raw" "KB gzip"
for path in "${urls[@]}"; do
  ttfb=(); total=()
  for _ in $(seq "$RUNS"); do
    read -r t1 t2 < <(curl -s -o /dev/null -w '%{time_starttransfer} %{time_total}\n' "$BASE$path")
    ttfb+=("$(awk "BEGIN{printf \"%.0f\", $t1*1000}")")
    total+=("$(awk "BEGIN{printf \"%.0f\", $t2*1000}")")
  done
  raw=$(curl -s "$BASE$path" | wc -c)
  gz=$(curl -s -H 'Accept-Encoding: gzip' --compressed -o /dev/null -w '%{size_download}' "$BASE$path")
  printf '%-62s %8s %8s %8s %8s\n' "$path" \
    "$(printf '%s\n' "${ttfb[@]}" | median)" "$(printf '%s\n' "${total[@]}" | median)" \
    "$(awk "BEGIN{printf \"%.1f\", $raw/1024}")" "$(awk "BEGIN{printf \"%.1f\", $gz/1024}")"
done
