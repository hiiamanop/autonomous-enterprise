#!/usr/bin/env bash
# ------------------------------------------------------------------------------
# Produces a kubeconfig that the API *container* can use to reach the Kind
# cluster.
#
# The kubeconfig on the host points at https://127.0.0.1:<random-port>, which is
# a port published on the host. Inside a container that address resolves to the
# container itself, so the API cannot use it as-is.
#
# The control-plane container is reachable by name on Docker's `kind` network,
# and its API server certificate already lists that name in its SANs (verified:
# DNS:autonomous-enterprise-control-plane), so no TLS workaround is needed.
#
# Output is written to infrastructure/kind/kubeconfig-internal.yaml, which
# docker-compose.kind.yml mounts read-only into the API container.
# ------------------------------------------------------------------------------
set -euo pipefail

CLUSTER_NAME="${KIND_CLUSTER_NAME:-autonomous-enterprise}"
CONTROL_PLANE="${CLUSTER_NAME}-control-plane"
CONTEXT="kind-${CLUSTER_NAME}"
OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_FILE="${OUT_DIR}/kubeconfig-internal.yaml"

if ! docker inspect "${CONTROL_PLANE}" >/dev/null 2>&1; then
  echo "error: container '${CONTROL_PLANE}' not found." >&2
  echo "Create the cluster first:" >&2
  echo "  kind create cluster --config infrastructure/kind/kind-config.yaml" >&2
  exit 1
fi

if ! kubectl config get-contexts "${CONTEXT}" >/dev/null 2>&1; then
  echo "error: kubectl context '${CONTEXT}' not found in your kubeconfig." >&2
  exit 1
fi

# --minify keeps only the active context; --raw keeps the credentials inline so
# the file is self-contained and does not reference paths from the host.
kubectl config view --minify --raw --context "${CONTEXT}" > "${OUT_FILE}"

# Rewrite the host-published address to the control-plane's DNS name on the
# `kind` Docker network. The port is the in-container API server port (6443),
# not the randomised host port.
sed -i -E "s#(\s*server:\s*)https://[^[:space:]]+#\1https://${CONTROL_PLANE}:6443#" "${OUT_FILE}"

chmod 600 "${OUT_FILE}"

echo "Wrote ${OUT_FILE}"
grep -E '^\s*server:' "${OUT_FILE}"
echo
echo "Next: docker compose -f docker-compose.yml -f docker-compose.kind.yml up -d"
