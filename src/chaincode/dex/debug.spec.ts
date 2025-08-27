// Debug test - Save as: src/chaincode/dex/debug.spec.ts
// This will help us see what's going wrong with state storage

import { EmergencyControl, EmergencyPauseState } from "./emergencyControl";
import { GalaChainContext } from "@gala-chain/chaincode";

describe("Emergency Control Debug", () => {
  let ctx: GalaChainContext;
  let mockState: Map<string, Buffer> = new Map();
  
  beforeEach(() => {
    mockState.clear();
    
    ctx = {
      callingUser: "admin-user",
      txUnixTime: Date.now(),
      clientIdentity: {
        getMSPID: jest.fn().mockReturnValue("GalaAdminMSP")
      },
      stub: {
        createCompositeKey: jest.fn().mockImplementation((objectType: string, attributes: string[]) => {
          return `${objectType}:${attributes.join(':')}`;
        }),
        setEvent: jest.fn(),
        putState: jest.fn().mockImplementation(async (key: string, value: Buffer) => {
          console.log(`🔍 DEBUG: Storing state - Key: ${key}, Value: ${value.toString()}`);
          mockState.set(key, value);
        }),
        getState: jest.fn().mockImplementation(async (key: string) => {
          console.log(`🔍 DEBUG: Reading state - Key: ${key}`);
          const value = mockState.get(key);
          console.log(`🔍 DEBUG: Found value: ${value ? value.toString() : 'null'}`);
          return value || Buffer.from('');
        })
      }
    } as any;
  });

  it("should store and retrieve pause state correctly", async () => {
    console.log("\n=== DEBUGGING STATE STORAGE ===");
    
    // Step 1: Pause the DEX
    console.log("1️⃣ Pausing DEX...");
    await EmergencyControl.pauseDex(ctx, "Testing emergency pause");
    
    // Step 2: Check what was stored
    console.log("2️⃣ Current state in mock storage:");
    for (const [key, value] of mockState.entries()) {
      console.log(`   Key: ${key} -> Value: ${value.toString()}`);
    }
    
    // Step 3: Try to read the pause state
    console.log("3️⃣ Checking if paused...");
    try {
      await EmergencyControl.checkPaused(ctx);
      console.log("❌ ERROR: checkPaused did not throw an error!");
    } catch (error) {
      console.log(`✅ SUCCESS: checkPaused correctly threw: ${error.message}`);
    }
  });
});