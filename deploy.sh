#!/bin/bash
# ============================================
# Oracle — Deploy crm-integration to Vercel
# ============================================
# Usage: ./deploy.sh
#
# Steps:
# 1. Check we're on crm-integration
# 2. Build locally to catch errors
# 3. Push to GitHub (crm-integration)
# 4. Deploy to Vercel production (alias oracle-truth-forge.vercel.app)
# ============================================

set -e  # Exit on error

BRANCH="crm-integration"
STABLE_URL="https://oracle-truth-forge.vercel.app"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$(dirname "$0")"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE} Oracle — Deploy to Vercel${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# 1. Check branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo -e "${RED}✗ Wrong branch: $CURRENT_BRANCH (expected: $BRANCH)${NC}"
  echo -e "  Run: ${YELLOW}git checkout $BRANCH${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC} On branch $BRANCH"

# 2. Check for uncommitted changes
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "${YELLOW}⚠${NC}  Uncommitted changes detected:"
  git status --short
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 3. Build locally
echo -e "${BLUE}→${NC} Building..."
if ! npm run build > /tmp/oracle-build.log 2>&1; then
  echo -e "${RED}✗ Build failed${NC}"
  tail -20 /tmp/oracle-build.log
  exit 1
fi
echo -e "${GREEN}✓${NC} Build OK"

# 4. Push to GitHub (if there are unpushed commits)
UNPUSHED=$(git log origin/$BRANCH..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNPUSHED" -gt 0 ]; then
  echo -e "${BLUE}→${NC} Pushing $UNPUSHED commit(s) to GitHub..."
  git push origin $BRANCH
  echo -e "${GREEN}✓${NC} Pushed to origin/$BRANCH"
else
  echo -e "${GREEN}✓${NC} GitHub already up-to-date"
fi

# 5. Deploy to Vercel
echo -e "${BLUE}→${NC} Deploying to Vercel..."
DEPLOY_OUTPUT=$(npx vercel --prod --yes 2>&1)
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -o 'https://oracle-truth-forge-[^ ]*\.vercel\.app' | head -1)

if [ -z "$DEPLOY_URL" ]; then
  echo -e "${RED}✗ Deploy failed${NC}"
  echo "$DEPLOY_OUTPUT" | tail -20
  exit 1
fi

echo -e "${GREEN}✓${NC} Deployed"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN} ✓ LIVE${NC}"
echo -e "   Stable:  ${YELLOW}$STABLE_URL${NC}"
echo -e "   Deploy:  $DEPLOY_URL"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
