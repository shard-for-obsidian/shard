#!/bin/bash
set -euo pipefail

# Configuration
ORG="shard-for-obsidian"
REPO="shard"
PACKAGE_TYPE="container"
NAMESPACE="community"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI${NC}"
    echo "Run: gh auth login"
    exit 1
fi

echo -e "${BLUE}Fetching packages from ${ORG}/${REPO}...${NC}"
echo ""

# Get all packages for the organization
# Note: gh api doesn't directly support filtering by namespace, so we'll filter manually
PACKAGES=$(gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "/orgs/${ORG}/packages?package_type=${PACKAGE_TYPE}&per_page=100" \
  --paginate \
  --jq '.[] | select(.name | startswith("shard/community/")) | {name: .name, visibility: .visibility}')

if [ -z "$PACKAGES" ]; then
    echo -e "${YELLOW}No packages found under ${ORG}/${REPO}/${NAMESPACE}${NC}"
    exit 0
fi

# Count total packages
TOTAL_PACKAGES=$(echo "$PACKAGES" | jq -s length)
echo -e "${GREEN}Found ${TOTAL_PACKAGES} package(s) under ${NAMESPACE}/${NC}"
echo ""

# Initialize counters
SUCCESS_COUNT=0
SKIP_COUNT=0
FAIL_COUNT=0

# Function to make a package public
make_public() {
    local package_name="$1"
    local current_visibility="$2"
    local index="$3"
    local total="$4"

    echo -e "${YELLOW}[${index}/${total}]${NC} Processing: ${package_name}"
    echo "  Current visibility: ${current_visibility}"

    # Skip if already public
    if [ "$current_visibility" = "public" ]; then
        echo -e "  ${BLUE}ℹ Already public, skipping${NC}"
        ((SKIP_COUNT++))
        echo ""
        return 0
    fi

    # Change visibility to public
    # URL-encode the package name (replace / with %2F)
    local encoded_name="${package_name//\//%2F}"

    if gh api \
      --method PATCH \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "/orgs/${ORG}/packages/${PACKAGE_TYPE}/${encoded_name}" \
      -f visibility='public' &> /dev/null; then
        echo -e "  ${GREEN}✓ Changed to public${NC}"
        ((SUCCESS_COUNT++))
    else
        echo -e "  ${RED}✗ Failed to change visibility${NC}"
        ((FAIL_COUNT++))
    fi

    echo ""
    return 0
}

# Main loop
echo "Processing packages..."
echo "===================="
echo ""

INDEX=0
while IFS= read -r pkg; do
    ((INDEX++))

    PACKAGE_NAME=$(echo "$pkg" | jq -r '.name')
    VISIBILITY=$(echo "$pkg" | jq -r '.visibility')

    make_public "$PACKAGE_NAME" "$VISIBILITY" "$INDEX" "$TOTAL_PACKAGES" || true

    # Small delay to avoid rate limiting
    sleep 0.5

done < <(echo "$PACKAGES" | jq -c '.')

# Print summary
echo ""
echo "===================="
echo "Processing Complete"
echo "===================="
echo -e "${GREEN}Changed to public: ${SUCCESS_COUNT}${NC}"
echo -e "${BLUE}Already public:    ${SKIP_COUNT}${NC}"
echo -e "${RED}Failed:            ${FAIL_COUNT}${NC}"
echo ""

# Exit with error code if any failed
if [ $FAIL_COUNT -gt 0 ]; then
    exit 1
fi
