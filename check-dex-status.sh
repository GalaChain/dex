#!/bin/bash
# GalaSwap DEX Status Check Script
# Usage: ./check-dex-status.sh

echo "🔍 GALASWAP DEX STATUS CHECK"
echo "============================"
echo "Timestamp: $(date)"
echo ""

# TODO: Replace these with your actual GalaChain connection details
CHANNEL_NAME="product-channel"
CHAINCODE_NAME="basic-product"
PEER_ADDRESS="peer0.your-org.com:7051"

# Method 1: Using gala-cli (if available)
if command -v gala-cli &> /dev/null; then
    echo "📡 Checking DEX status via gala-cli..."
    
    # Try to call checkPaused - if it throws an error, DEX is paused
    if gala-cli chaincode query \
        --channel-name "$CHANNEL_NAME" \
        --chaincode-name "$CHAINCODE_NAME" \
        --function-name "checkPaused" \
        --args "" \
        --peer-addresses "$PEER_ADDRESS" 2>/dev/null; then
        
        echo "✅ DEX STATUS: OPERATIONAL"
        echo "🟢 All trading functions are active"
    else
        echo "🔴 DEX STATUS: PAUSED"
        echo "🚫 All trading functions are blocked"
    fi

# Method 2: Using peer CLI (fallback)
elif command -v peer &> /dev/null; then
    echo "📡 Checking DEX status via peer CLI..."
    
    if peer chaincode query \
        -C "$CHANNEL_NAME" \
        -n "$CHAINCODE_NAME" \
        -c "{\"function\":\"checkPaused\",\"Args\":[]}" 2>/dev/null; then
        
        echo "✅ DEX STATUS: OPERATIONAL"
        echo "🟢 All trading functions are active"
    else
        echo "🔴 DEX STATUS: PAUSED"
        echo "🚫 All trading functions are blocked"
    fi

# Method 3: API call (if CLI tools not available)
else
    echo "📡 Checking DEX status via API..."
    
    # TODO: Replace with your actual API endpoint and auth
    API_ENDPOINT="https://your-galachain-api.com/api/chaincode/query"
    AUTH_TOKEN="your-admin-token"
    
    if curl -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{
            \"chaincodeName\": \"$CHAINCODE_NAME\",
            \"functionName\": \"checkPaused\",
            \"args\": []
        }" \
        --fail \
        --silent \
        --show-error 2>/dev/null; then
        
        echo "✅ DEX STATUS: OPERATIONAL"
        echo "🟢 All trading functions are active"
    else
        echo "🔴 DEX STATUS: PAUSED"
        echo "🚫 All trading functions are blocked"
    fi
fi

echo ""
echo "📋 AVAILABLE COMMANDS:"
echo "  🛑 Emergency pause: ./emergency-stop.sh"
echo "  ▶️  Emergency resume: ./emergency-resume.sh"
echo "  📊 Check status: ./check-dex-status.sh"
echo ""

# Show recent emergency log entries
if [ -f "emergency.log" ]; then
    echo "📜 RECENT EMERGENCY ACTIONS:"
    tail -5 emergency.log
fi
