#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
CMD="${2:-deploy}"

if [[ "$MODE" != "dev" && "$MODE" != "prod" ]]; then
  echo "Usage: $0 <dev|prod> [deploy|test]" >&2
  exit 1
fi
if [[ "$CMD" != "deploy" && "$CMD" != "test" ]]; then
  echo "Usage: $0 <dev|prod> [deploy|test]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

source "$SCRIPT_DIR/.env" 2>/dev/null || { echo "✗ .env file not found. Create it with JAHIA_URL, JAHIA_USER, JAHIA_PASS." >&2; exit 1; }

# Build
MVN_ARGS=(clean install -q)
[[ "$MODE" == "dev" ]] && MVN_ARGS+=(-P dev)

echo "==> Building module ($MODE)..."
t0=$(date +%s)
mvn "${MVN_ARGS[@]}"

# Pick the most recently modified deployable JAR from target/, regardless of project name.
# Excludes sources/javadoc and Maven's original-* backup artifacts.
JAR="$(ls -t "$SCRIPT_DIR"/target/*.jar 2>/dev/null | grep -Ev '(-sources|-javadoc)\.jar$|/original-.*\.jar$' | head -1)"
[[ -z "$JAR" ]] && {
  echo "✗ No deployable JAR found in target/ after build." >&2
  exit 1
}
echo "==> Build done ($(du -h "$JAR" | cut -f1))"

# Deploy
echo "==> Deploying to $JAHIA_URL ..."
HTTP_RESPONSE=$(curl --silent --show-error --insecure --max-time 120 --write-out "\nHTTP_STATUS:%{http_code}" \
  -u "$JAHIA_USER:$JAHIA_PASS" -X POST "$JAHIA_URL/modules/api/provisioning" \
  --form "script=[{\"installBundle\":\"$(basename "$JAR")\",\"autoStart\":true,\"forceUpdate\":true,\"uninstallPreviousVersion\":true}]" \
  --form "file=@$JAR")

HTTP_STATUS=$(echo "$HTTP_RESPONSE" | grep "^HTTP_STATUS:" | cut -d: -f2)
elapsed=$(( $(date +%s) - t0 ))

if [[ "$HTTP_STATUS" -ge 200 && "$HTTP_STATUS" -lt 300 ]]; then
  printf "✓ Deployed (%s) in %dm%02ds\n" "$MODE" $(( elapsed / 60 )) $(( elapsed % 60 ))
else
  echo "$HTTP_RESPONSE" | sed '/^HTTP_STATUS:/d'
  echo "✗ Deployment failed (HTTP $HTTP_STATUS)" >&2
  exit 1
fi

# Run tests if requested
if [[ "$CMD" == "test" ]]; then
  TESTS_DIR="$SCRIPT_DIR/tests"
  [[ ! -d "$TESTS_DIR" ]] && { echo "✗ tests/ directory not found." >&2; exit 1; }

  echo "==> Installing test dependencies..."
  (cd "$TESTS_DIR" && yarn install --silent)

  # Source the tests .env (fall back to .env.example), but let the root .env
  # variables already loaded take precedence for JAHIA_URL / credentials.
  TESTS_ENV_FILE="$TESTS_DIR/.env"
  [[ ! -f "$TESTS_ENV_FILE" ]] && TESTS_ENV_FILE="$TESTS_DIR/.env.example"

  # @jahia/cypress env plugin reads JAHIA_URL + SUPER_USER_PASSWORD (no CYPRESS_ prefix)
  export JAHIA_URL="${JAHIA_URL:-http://jahia:8080}"
  export SUPER_USER_PASSWORD="${JAHIA_PASS:-root1234}"
  export CYPRESS_BASE_URL="$JAHIA_URL"

  echo "==> Running Cypress tests against $JAHIA_URL ..."
  (cd "$TESTS_DIR" && yarn e2e:ci)
fi
