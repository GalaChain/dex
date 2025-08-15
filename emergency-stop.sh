#!/bin/bash
# GalaSwap DEX Emergency Stop Script
# Usage: ./emergency-stop.sh [reason]

set -e  # Exit on any error

echo "🚨 GALASWAP DEX EMERGENCY PAUSE INITIATED"
echo "=========================================="
echo "Timestamp: $(date)"
echo "Executed by: $(whoami)"
echo "Host: $(hostname)"

# Get emergency reason
if [ -n "$1" ]; then
    REASON="$1"
else
    echo ""
    echo "Enter emergency reason (or press Enter for default):"
    read REASON
fi

# Set default reason if none provided
if [ -z "$REASON" ]; then
    REASON="EMERGENCY_STOP_$(date +%Y%m%d_%H%M%S)"
fi

echo ""
echo "🔴 PAUSING DEX WITH REASON: $REASON"
echo "⚠️  This will block ALL DEX operations immediately!"
echo ""

# Confirmation prompt
echo "Continue with emergency pause? (y/N)"
read CONFIRMATION

if [ "$CONFIRMATION" != "y" ] && [ "$CONFIRMATION" != "Y" ]; then
    echo "❌ Emergency pause cancelled by user"
    exit 1
fi

echo ""
echo "🔄 Executing emergency pause..."

# TODO: Replace these with your actual GalaChain connection details
CHANNEL_NAME="product-channel"
CHAINCODE_NAME="basic-product"
PEER_ADDRESS="peer0.your-org.com:7051"

# Method 1: Using gala-cli (if available)
if command -v gala-cli &> /dev/null; then
    echo "📡 Using gala-cli to pause DEX..."
    
    gala-cli chaincode invoke \
        --channel-name "$CHANNEL_NAME" \
        --chaincode-name "$CHAINCODE_NAME" \
        --function-name "pauseDex" \
        --args "\"$REASON\"" \
        --peer-addresses "$PEER_ADDRESS"
    
    PAUSE_RESULT=$?
    
# Method 2: Using peer CLI (fallback)
elif command -v peer &> /dev/null; then
    echo "📡 Using peer CLI to pause DEX..."
    
    peer chaincode invoke \
        -o orderer.your-domain.com:7050 \
        -C "$CHANNEL_NAME" \
        -n "$CHAINCODE_NAME" \
        --peerAddresses "$PEER_ADDRESS" \
        -c "{\"function\":\"pauseDex\",\"Args\":[\"$REASON\"]}"
    
    PAUSE_RESULT=$?
    
# Method 3: API call (if CLI tools not available)
else
    echo "📡 Using API call to pause DEX..."
    
    # TODO: Replace with your actual API endpoint and auth
    API_ENDPOINT="https://your-galachain-api.com/api/chaincode/invoke"
    AUTH_TOKEN="your-admin-token"
    
    curl -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{
            \"chaincodeName\": \"$CHAINCODE_NAME\",
            \"functionName\": \"pauseDex\",
            \"args\": [\"$REASON\"]
        }" \
        --fail \
        --silent \
        --show-error
    
    PAUSE_RESULT=$?
fi

# Check if pause was successful
if [ $PAUSE_RESULT -eq 0 ]; then
    echo ""
    echo "✅ DEX SUCCESSFULLY PAUSED!"
    echo "🔴 All trading operations are now blocked"
    echo ""
    echo "📋 NEXT STEPS:"
    echo "  1. 📱 Notify emergency team immediately"
    echo "  2. 📊 Check system status and logs" 
    echo "  3. 🔍 Begin incident investigation"
    echo "  4. 📝 Document incident details"
    echo "  5. 📢 Prepare user communication"
    echo ""
    echo "💡 To resume operations: ./emergency-resume.sh"
    echo ""
    
    # Log the emergency action
    echo "$(date): EMERGENCY PAUSE - Reason: $REASON - By: $(whoami)" >> emergency.log
    
else
    echo ""
    echo "❌ EMERGENCY PAUSE FAILED!"
    echo "🚨 DEX MAY STILL BE OPERATIONAL - CRITICAL ISSUE"
    echo ""
    echo "🔄 IMMEDIATE ACTIONS:"
    echo "  1. 📞 Contact technical team immediately"
    echo "  2. 🔄 Try alternative pause method"
    echo "  3. 🛑 Consider network-level intervention"
    echo ""
    exit 1
fi
