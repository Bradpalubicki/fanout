#!/usr/bin/env bash
# Smoke test for fanout.digital deployed instance
# Usage: API_KEY=your_key BASE_URL=https://fanout.digital ./scripts/smoke-test.sh

set -euo pipefail

BASE_URL="${BASE_URL:-https://fanout.digital}"
API_KEY="${API_KEY:-}"
CRON_SECRET="${CRON_SECRET:-}"
PASS=0
FAIL=0

green() { printf "\033[32m✓ %s\033[0m\n" "$1"; PASS=$((PASS + 1)); }
red()   { printf "\033[31m✗ %s\033[0m\n" "$1"; FAIL=$((FAIL + 1)); }
test_status() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then green "$desc"; else red "$desc (expected $expected, got $actual)"; fi
}

echo "=== Fanout Smoke Tests ==="
echo "Target: $BASE_URL"
echo ""

# --- Health ---
echo "--- Health ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
test_status "GET /api/health returns 200" "200" "$STATUS"

# --- Auth enforcement ---
echo ""
echo "--- Auth enforcement ---"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/posts" -X POST \
  -H "Content-Type: application/json" -d '{"content":"test","platforms":["bluesky"],"profile":"test"}')
test_status "POST /api/v1/posts without API key returns 401" "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/posts" -X POST \
  -H "Authorization: Bearer invalid-key" -H "Content-Type: application/json" \
  -d '{"content":"test","platforms":["bluesky"],"profile":"test"}')
test_status "POST /api/v1/posts with bad API key returns 401" "401" "$STATUS"

# --- Cron protection ---
echo ""
echo "--- Cron protection ---"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/cron/process-queue")
test_status "GET /api/cron/process-queue without secret returns 401" "401" "$STATUS"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/cron/process-queue" \
  -H "Authorization: Bearer wrong-secret")
test_status "GET /api/cron/process-queue with wrong secret returns 401" "401" "$STATUS"

# --- Dashboard auth (middleware) ---
echo ""
echo "--- Middleware auth ---"

STATUS=$(curl -s -o /dev/null -w "%{http_code}" -L "$BASE_URL/dashboard")
# Should redirect to sign-in (302/307) or return 401
if [ "$STATUS" = "200" ]; then
  red "GET /dashboard returns 200 without auth (should redirect)"
else
  green "GET /dashboard redirects unauthenticated users (status: $STATUS)"
fi

# --- Biolink rate limiting ---
echo ""
echo "--- Rate limiting ---"

for i in $(seq 1 22); do
  RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/biolink/track" -X POST \
    -H "Content-Type: application/json" \
    -d '{"pageId":"00000000-0000-0000-0000-000000000000","linkIndex":0}')
done
test_status "Biolink track rate limited after 20 requests" "429" "$RESP"

# --- v1/posts API (requires valid API key) ---
if [ -n "$API_KEY" ]; then
  echo ""
  echo "--- v1/posts API ---"

  # Input validation
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/posts" -X POST \
    -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
    -d '{"platforms":["bluesky"]}')
  test_status "POST /api/v1/posts missing content returns 400" "400" "$STATUS"

  # Valid post
  RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/posts" -X POST \
    -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
    -d '{"content":"Smoke test post","platforms":["bluesky"],"profile":"test-profile","metadata":{"test":true}}')
  STATUS=$(echo "$RESP" | tail -1)
  BODY=$(echo "$RESP" | head -1)

  if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
    green "POST /api/v1/posts creates post successfully"
    POST_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$POST_ID" ]; then
      green "Response includes post ID: $POST_ID"

      # Status check
      STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/v1/posts/$POST_ID" \
        -H "Authorization: Bearer $API_KEY")
      test_status "GET /api/v1/posts/:id returns status" "200" "$STATUS"
    fi
  else
    red "POST /api/v1/posts failed (status: $STATUS)"
  fi
else
  echo ""
  echo "--- Skipping v1/posts tests (set API_KEY env var to enable) ---"
fi

# --- Cron with valid secret ---
if [ -n "$CRON_SECRET" ]; then
  echo ""
  echo "--- Cron with valid secret ---"

  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/cron/process-queue" \
    -H "Authorization: Bearer $CRON_SECRET")
  test_status "GET /api/cron/process-queue with valid secret returns 200" "200" "$STATUS"
else
  echo ""
  echo "--- Skipping cron tests (set CRON_SECRET env var to enable) ---"
fi

# --- Summary ---
echo ""
echo "==========================="
echo "Passed: $PASS  Failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
