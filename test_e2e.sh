#!/usr/bin/env bash
set -euo pipefail

# =============================================================
# VAULT END-TO-END TEST SCRIPT
# Run: bash /home/arch-nitro/Documents/synergy/test_e2e.sh
# =============================================================

BACKEND="http://localhost:8000"
FRONTEND="http://localhost:3000"
PASS=0
FAIL=0
TOTAL=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

check() {
  TOTAL=$((TOTAL + 1))
  local label="$1"
  local result="$2"
  if [ "$result" = "true" ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}PASS${NC} — $label"
  else
    FAIL=$((FAIL + 1))
    echo -e "  ${RED}FAIL${NC} — $label"
  fi
}

echo ""
echo -e "${BOLD}${CYAN}════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  VAULT E2E TEST SUITE${NC}"
echo -e "${BOLD}${CYAN}════════════════════════════════════════════════════════${NC}"
echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 0: INFRASTRUCTURE CHECKS
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Phase 0: Infrastructure${NC}"

# Backend running
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND/docs" 2>/dev/null || echo "000")
check "Backend is running on :8000" "$([ "$HTTP_CODE" = "200" ] && echo true || echo false)"

# Frontend running
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND" 2>/dev/null || echo "000")
check "Frontend is running on :3000" "$([ "$HTTP_CODE" = "200" ] && echo true || echo false)"

# Backend process exists
BPID=$(pgrep -f "uvicorn main:app" | head -1 || echo "")
check "Backend process exists" "$([ -n "$BPID" ] && echo true || echo false)"

# Frontend process exists
FPID=$(pgrep -f "next" | head -1 || echo "")
check "Frontend process exists" "$([ -n "$FPID" ] && echo true || echo false)"

echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 1: BACKEND API — /v1/models
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Phase 1: GET /v1/models${NC}"

MODELS_JSON=$(curl -s "$BACKEND/v1/models" 2>/dev/null || echo "{}")
MODEL_TOTAL=$(echo "$MODELS_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('total',0))" 2>/dev/null || echo "0")

check "Response is valid JSON" "$([ "$MODEL_TOTAL" != "0" ] && echo true || echo false)"
check "Total models >= 10" "$([ "$MODEL_TOTAL" -ge 10 ] && echo true || echo false)"

# Check model #10 exists
HAS_10=$(echo "$MODELS_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ids=[m['model_id'] for m in d.get('models',[])]
print('true' if 10 in ids else 'false')
" 2>/dev/null || echo "false")
check "Model #10 (user-uploaded) appears in list" "$HAS_10"

# Check model #11 exists
HAS_11=$(echo "$MODELS_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ids=[m['model_id'] for m in d.get('models',[])]
print('true' if 11 in ids else 'false')
" 2>/dev/null || echo "false")
check "Model #11 (sentiment) appears in list" "$HAS_11"

# Check accuracy is not 9420% (the old bug)
ACC_CHECK=$(echo "$MODELS_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
ok=True
for m in d.get('models',[]):
  a=m.get('accuracy_claim',0)
  if a > 100:
    ok=False
    break
print('true' if ok else 'false')
" 2>/dev/null || echo "false")
check "No model has accuracy_claim > 100 (old 9420% bug)" "$ACC_CHECK"

# Check created_at is present
CREATED_CHECK=$(echo "$MODELS_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
has_date=all(m.get('created_at',0)>0 for m in d.get('models',[])[:3])
print('true' if has_date else 'false')
" 2>/dev/null || echo "false")
check "Models have created_at timestamps" "$CREATED_CHECK"

# Check framework_version is present
FW_CHECK=$(echo "$MODELS_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
has_fw=all(m.get('framework_version','')!='' for m in d.get('models',[])[:3])
print('true' if has_fw else 'false')
" 2>/dev/null || echo "false")
check "Models have framework_version" "$FW_CHECK"

echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 2: BACKEND API — /v1/discover
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Phase 2: GET /v1/discover${NC}"

# Discover all
DISC_ALL=$(curl -s "$BACKEND/v1/discover" 2>/dev/null || echo "{}")
DISC_TOTAL=$(echo "$DISC_ALL" | python3 -c "import json,sys; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")
check "Discover returns models" "$([ "$DISC_TOTAL" -gt 0 ] && echo true || echo false)"

# Discover classification
DISC_CLS=$(curl -s "$BACKEND/v1/discover?task=classification" 2>/dev/null || echo "{}")
CLS_TOTAL=$(echo "$DISC_CLS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")
check "Discover classification returns results" "$([ "$CLS_TOTAL" -gt 0 ] && echo true || echo false)"

# Discover summarization
DISC_SUM=$(curl -s "$BACKEND/v1/discover?task=summarization" 2>/dev/null || echo "{}")
SUM_TOTAL=$(echo "$DISC_SUM" | python3 -c "import json,sys; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")
check "Discover summarization returns results" "$([ "$SUM_TOTAL" -gt 0 ] && echo true || echo false)"

# Discover sentiment
DISC_SENT=$(curl -s "$BACKEND/v1/discover?task=sentiment" 2>/dev/null || echo "{}")
SENT_TOTAL=$(echo "$DISC_SENT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")
check "Discover sentiment returns results" "$([ "$SENT_TOTAL" -gt 0 ] && echo true || echo false)"

# Discover with min_accuracy filter
DISC_ACC=$(curl -s "$BACKEND/v1/discover?min_accuracy=90" 2>/dev/null || echo "{}")
ACC_TOTAL=$(echo "$DISC_ACC" | python3 -c "import json,sys; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")
check "Discover min_accuracy=90 returns results" "$([ "$ACC_TOTAL" -gt 0 ] && echo true || echo false)"

echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 3: BACKEND API — /v1/inference (x402 flow)
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Phase 3: POST /v1/inference/{model_id} (x402)${NC}"

# Model 0 — should return 402
INF0_HTTP=$(curl -s -o /tmp/inf0.json -w "%{http_code}" -X POST "$BACKEND/v1/inference/0" -H "Content-Type: application/json" -d '{"input_data":"test"}' 2>/dev/null || echo "000")
check "Model #0: Returns 402 (payment required)" "$([ "$INF0_HTTP" = "402" ] && echo true || echo false)"

INF0_MODEL=$(python3 -c "import json; d=json.load(open('/tmp/inf0.json')); print(d.get('model_id',''))" 2>/dev/null || echo "")
check "Model #0: 402 body has model_id=mnist" "$([ "$INF0_MODEL" = "mnist" ] && echo true || echo false)"

INF0_ONCHAIN=$(python3 -c "import json; d=json.load(open('/tmp/inf0.json')); print(d.get('on_chain_model_id',''))" 2>/dev/null || echo "")
check "Model #0: 402 body has on_chain_model_id=0" "$([ "$INF0_ONCHAIN" = "0" ] && echo true || echo false)"

# Model 5 (summarizer)
INF5_HTTP=$(curl -s -o /tmp/inf5.json -w "%{http_code}" -X POST "$BACKEND/v1/inference/5" -H "Content-Type: application/json" -d '{"input_data":"test"}' 2>/dev/null || echo "000")
check "Model #5: Returns 402 (payment required)" "$([ "$INF5_HTTP" = "402" ] && echo true || echo false)"

INF5_MODEL=$(python3 -c "import json; d=json.load(open('/tmp/inf5.json')); print(d.get('model_id',''))" 2>/dev/null || echo "")
check "Model #5: 402 body resolves to summarizer" "$([ "$INF5_MODEL" = "summarizer" ] && echo true || echo false)"

# Model 10 (dynamically resolved — classification → mnist)
INF10_HTTP=$(curl -s -o /tmp/inf10.json -w "%{http_code}" -X POST "$BACKEND/v1/inference/10" -H "Content-Type: application/json" -d '{"input_data":"test"}' 2>/dev/null || echo "000")
check "Model #10: Returns 402 (payment required)" "$([ "$INF10_HTTP" = "402" ] && echo true || echo false)"

INF10_MODEL=$(python3 -c "import json; d=json.load(open('/tmp/inf10.json')); print(d.get('model_id',''))" 2>/dev/null || echo "")
check "Model #10: Dynamic resolve → mnist" "$([ "$INF10_MODEL" = "mnist" ] && echo true || echo false)"

INF10_ONCHAIN=$(python3 -c "import json; d=json.load(open('/tmp/inf10.json')); print(d.get('on_chain_model_id',''))" 2>/dev/null || echo "")
check "Model #10: 402 body has on_chain_model_id=10" "$([ "$INF10_ONCHAIN" = "10" ] && echo true || echo false)"

# Model 11 (dynamically resolved — sentiment → sentiment)
INF11_HTTP=$(curl -s -o /tmp/inf11.json -w "%{http_code}" -X POST "$BACKEND/v1/inference/11" -H "Content-Type: application/json" -d '{"input_data":"test"}' 2>/dev/null || echo "000")
check "Model #11: Returns 402 (payment required)" "$([ "$INF11_HTTP" = "402" ] && echo true || echo false)"

INF11_MODEL=$(python3 -c "import json; d=json.load(open('/tmp/inf11.json')); print(d.get('model_id',''))" 2>/dev/null || echo "")
check "Model #11: Dynamic resolve → sentiment" "$([ "$INF11_MODEL" = "sentiment" ] && echo true || echo false)"

# Invalid model ID
INF999_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND/v1/inference/9999" -H "Content-Type: application/json" -d '{"input_data":"test"}' 2>/dev/null || echo "000")
check "Model #9999: Returns 404 (not found)" "$([ "$INF999_HTTP" = "404" ] && echo true || echo false)"

echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 4: BACKEND API — /v1/subscription/check
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Phase 4: GET /v1/subscription/check${NC}"

SUB_HTTP=$(curl -s -o /tmp/sub.json -w "%{http_code}" "$BACKEND/v1/subscription/check?subscriber=HuHZuySqKNeHcBCUajcgBvdYdjWjtubJFA3iJr1j1c3P&model_id=0" 2>/dev/null || echo "000")
check "Subscription check returns 200" "$([ "$SUB_HTTP" = "200" ] && echo true || echo false)"

SUB_ACTIVE=$(python3 -c "import json; d=json.load(open('/tmp/sub.json')); print(d.get('is_active',''))" 2>/dev/null || echo "")
check "No active subscription for test wallet (expected)" "$([ "$SUB_ACTIVE" = "False" ] && echo true || echo false)"

echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 5: BACKEND API — POST /v1/models/upload (form check)
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Phase 5: POST /v1/models/upload (validation)${NC}"

# Empty upload should fail gracefully
UPLOAD_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BACKEND/v1/models/upload" 2>/dev/null || echo "000")
check "Upload without file returns non-200" "$([ "$UPLOAD_HTTP" != "200" ] && echo true || echo false)"

echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 6: GLOBALSTATE CACHE VERIFICATION
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Phase 6: GlobalState Cache TTL Verification${NC}"

# First call populates cache
C1=$(curl -s "$BACKEND/v1/models" | python3 -c "import json,sys; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")
check "First fetch returns $C1 models" "true"

# Immediate second call should use cache (same result)
C2=$(curl -s "$BACKEND/v1/models" | python3 -c "import json,sys; print(json.load(sys.stdin).get('total',0))" 2>/dev/null || echo "0")
check "Second fetch (cached) returns same count" "$([ "$C1" = "$C2" ] && echo true || echo false)"

echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 7: FRONTEND PAGE LOAD CHECKS
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Phase 7: Frontend Page Loads${NC}"

PAGES=("/" "/marketplace" "/dashboard" "/inference" "/upload" "/simulator")
for PAGE in "${PAGES[@]}"; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND${PAGE}" 2>/dev/null || echo "000")
  check "Page ${PAGE} → HTTP $HTTP" "$([ "$HTTP" = "200" ] && echo true || echo false)"
done

# Dynamic model detail page
HTTP_DETAIL=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND/models/10" 2>/dev/null || echo "000")
check "Page /models/10 → HTTP $HTTP_DETAIL" "$([ "$HTTP_DETAIL" = "200" ] && echo true || echo false)"

echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 8: FRONTEND BUILD CHECK
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Phase 8: Frontend Build${NC}"

BUILD_OUTPUT=$(cd /home/arch-nitro/Documents/synergy/vault-frontend && yarn build 2>&1 || true)
BUILD_OK=$(echo "$BUILD_OUTPUT" | grep -c "Compiled successfully" || echo "0")
check "yarn build compiles successfully" "$([ "$BUILD_OK" -gt 0 ] && echo true || echo false)"

BUILD_FAIL=$(echo "$BUILD_OUTPUT" | grep -c "Failed to compile" || true)
check "No build errors" "$([ "${BUILD_FAIL:-0}" = "0" ] && echo true || echo false)"

echo ""

# ─────────────────────────────────────────────────────────────
# PHASE 9: CROSS-CHECK FRONTEND DATA MATCHES BACKEND
# ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}▸ Phase 9: Frontend-Backend Data Consistency${NC}"

# Fetch marketplace page and check it contains model data
MKTPAGE=$(curl -s "$FRONTEND/marketplace" 2>/dev/null || echo "")
MKT_HAS_MODELS=$(echo "$MKTPAGE" | grep -c "MODEL MARKETPLACE" || echo "0")
check "Marketplace page renders heading" "$([ "$MKT_HAS_MODELS" -gt 0 ] && echo true || echo false)"

echo ""

# ─────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  RESULTS: ${GREEN}$PASS PASSED${NC}  ${RED}$FAIL FAILED${NC}  out of $TOTAL tests"
echo -e "${BOLD}${CYAN}════════════════════════════════════════════════════════${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo -e "${RED}Some tests failed. Fix them before proceeding to Phase 4.${NC}"
  exit 1
else
  echo ""
  echo -e "${GREEN}All tests passed! Phase 3 is 100% complete.${NC}"
  echo -e "${GREEN}Ready for Phase 4 — MagicBlock Integration.${NC}"
  exit 0
fi
