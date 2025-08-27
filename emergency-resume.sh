#!/bin/bash
# GalaSwap DEX Emergency Resume Script
# Usage: ./emergency-resume.sh

set -e  # Exit on any error

echo "🔄 GALASWAP DEX EMERGENCY RESUME INITIATED"
echo "=========================================="
echo "Timestamp: $(date)"
echo "Executed by: $(whoami)"
echo "Host: $(hostname)"
echo ""

# Safety warnings
echo "⚠️  CRITICAL SAFETY CHECKS:"
echo "🔍 Have you verified the security issue is resolved?"
echo "🧪 Have you tested the fix thoroughly?"
echo "👥 Has the security team approved resume?"
echo "📋 Have you documented the incident resolution?"
echo ""

# Multiple confirmation prompts for safety
echo "🚨 WARNING: This will resume ALL DEX operations!"
echo "Only proceed if you are absolutely certain it is safe."
echo ""
echo "Type 'RESUME' to confirm you want to resume operations:"
read CONFIRMATION

if [ "$CONFIRMATION" != "RESUME" ]; then
    echo "❌ Resume cancelled - confirmation not received"
    exit 1
fi

echo ""
echo "Final confirmation: Resume DEX operations now? (y/N)"
read FINAL_CONFIRMATION

if [ "$FINAL_CONFIRMATION" != "y" ] && [ "$FINAL_CONFIRMATION" != "Y" ]; then
    echo "❌ Resume cancelled by user"
    exit 1
fi

echo ""
echo "🔄 Executing emergency resume..."

# TODO: Replace these with your actual GalaChain connection details
CHANNEL_NAME="product-channel"
CHAINCODE_NAME="basic-product"
PEER_ADDRESS="peer0.your-org.com:7051"

# Method 1: Using gala-cli (if available)
if command -v gala-cli &> /dev/null; then
    echo "📡 Using gala-cli to resume DEX..."
    
    gala-cli chaincode invoke \
        --channel-name "$CHANNEL_NAME" \
        --chaincode-name "$CHAINCODE_NAME" \
        --function-name "resumeDex" \
        --args "" \
        --peer-addresses "$PEER_ADDRESS"
    
    RESUME_RESULT=$?
    
# Method 2: Using peer CLI (fallback)
elif command -v peer &> /dev/null; then
    echo "📡 Using peer CLI to resume DEX..."
    
    peer chaincode invoke \
        -o orderer.your-domain.com:7050 \
        -C "$CHANNEL_NAME" \
        -n "$CHAINCODE_NAME" \
        --peerAddresses "$PEER_ADDRESS" \
        -c "{\"function\":\"resumeDex\",\"Args\":[]}"
    
    RESUME_RESULT=$?
    
# Method 3: API call (if CLI tools not available)
else
    echo "📡 Using API call to resume DEX..."
    
    # TODO: Replace with your actual API endpoint and auth
    API_ENDPOINT="https://your-galachain-api.com/api/chaincode/invoke"
    AUTH_TOKEN="your-admin-token"
    
    curl -X POST "$API_ENDPOINT" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{
            \"chaincodeName\": \"$CHAINCODE_NAME\",
            \"functionName\": \"resumeDex\",
            \"args\": []
        }" \
        --fail \
        --silent \
        --show-error
    
    RESUME_RESULT=$?
fi

# Check if resume was successful
if [ $RESUME_RESULT -eq 0 ]; then
    echo ""
    echo "✅ DEX SUCCESSFULLY RESUMED!"
    echo "🟢 All trading operations are now active"
    echo ""
    echo "📋 NEXT STEPS:"
    echo "  1. 📊 Monitor system closely for 30 minutes"
    echo "  2. 📱 Notify team of successful resume"
    echo "  3. 📢 Update user communications"
    echo "  4. 📝 Complete incident report"
    echo "  5. 🔍 Review incident response process"
    echo ""
    echo "📈 Monitor: ./check-dex-status.sh"
    echo ""
    
    # Log the resume action
    echo "$(date): EMERGENCY RESUME - By: $(whoami)" >> emergency.log
    
else
    echo ""
    echo "❌ EMERGENCY RESUME FAILED!"
    echo "🚨 DEX STATUS UNKNOWN - INVESTIGATE IMMEDIATELY"
    echo ""
    echo "🔄 IMMEDIATE ACTIONS:"
    echo "  1. 📞 Contact technical team"
    echo "  2. 🔍 Check system logs"
    echo "  3. 🧪 Verify current pause status"
    echo ""
    exit 1
fi
