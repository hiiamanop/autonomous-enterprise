#!/bin/sh
# Injects environment-specific configuration into the static SPA bundle at
# container start, so a single immutable image can be promoted across
# environments without rebuilding.
set -eu

TARGET=/usr/share/nginx/html/runtime-config.js
API_BASE_URL="${PUBLIC_API_BASE_URL:-/api/v1}"

cat > "$TARGET" <<EOF
window.__AE_RUNTIME_CONFIG__ = {
  apiBaseUrl: '${API_BASE_URL}'
};
EOF

echo "runtime-config: apiBaseUrl=${API_BASE_URL}"
