// DEX Emergency Integration Test
// Save as: src/chaincode/dex/dexEmergency.spec.ts

import { GalaChainContext } from "@gala-chain/chaincode";
import { ForbiddenError } from "@gala-chain/api";
import { EmergencyControl } from "./emergencyControl";
import { swap } from "./swap";
import { addLiquidity } from "./addLiquidity";
import { burn } from "./burn";
import { collect } from "./collect";
import { createPool } from "./createPool";

describe("DEX Emergency Integration Tests", () => {
  let ctx: GalaChainContext;
  let mockState: Map<string, Buffer>;
  
  beforeEach(() => {
    mockState = new Map();
    
    ctx = {
      callingUser: "admin-user",
      txUnixTime: Date.now(),
      clientIdentity: {
        getMSPID: jest.fn().mockReturnValue("GalaAdminMSP")
      },
      stub: {
        createCompositeKey: jest.fn().mockImplementation((objectType: string, attributes: string[]) => {
          return `${objectType}${attributes.join('')}`;
        }),
        setEvent: jest.fn(),
        putState: jest.fn().mockImplementation(async (key: string, value: Buffer) => {
          mockState.set(key, value);
        }),
        getState: jest.fn().mockImplementation(async (key: string) => {
          const value = mockState.get(key);
          return value || Buffer.from('');
        })
      }
    } as any;
  });

  describe("Emergency Controls Block DEX Operations", () => {
    it("should block swap when DEX is paused", async () => {
      // Pause the DEX
      await EmergencyControl.pauseDex(ctx, "Emergency security patch");
      
      // Try to swap - should be blocked
      await expect(swap(ctx, {} as any))
        .rejects.toThrow("DEX operations are currently paused");
    });

    it("should block addLiquidity when DEX is paused", async () => {
      // Pause the DEX
      await EmergencyControl.pauseDex(ctx, "Emergency maintenance");
      
      // Try to add liquidity - should be blocked
      await expect(addLiquidity(ctx, {} as any))
        .rejects.toThrow("DEX operations are currently paused");
    });

    it("should block burn when DEX is paused", async () => {
      // Pause the DEX
      await EmergencyControl.pauseDex(ctx, "Security audit");
      
      // Try to burn liquidity - should be blocked
      await expect(burn(ctx, {} as any))
        .rejects.toThrow("DEX operations are currently paused");
    });

    it("should block collect when DEX is paused", async () => {
      // Pause the DEX
      await EmergencyControl.pauseDex(ctx, "Fee calculation fix");
      
      // Try to collect fees - should be blocked
      await expect(collect(ctx, {} as any))
        .rejects.toThrow("DEX operations are currently paused");
    });

    it("should block createPool when DEX is paused", async () => {
      // Pause the DEX
      await EmergencyControl.pauseDex(ctx, "Pool creation security review");
      
      // Try to create pool - should be blocked
      await expect(createPool(ctx, {} as any))
        .rejects.toThrow("DEX operations are currently paused");
    });
  });

  describe("DEX Operations Work When Not Paused", () => {
    it("should allow operations when DEX is not paused", async () => {
      // These should NOT throw emergency pause errors
      // (They may throw other validation errors, which is fine)
      
      try {
        await swap(ctx, {} as any);
      } catch (error) {
        // Should NOT be an emergency pause error
        expect(error.message).not.toContain("DEX operations are currently paused");
      }
      
      try {
        await addLiquidity(ctx, {} as any);
      } catch (error) {
        // Should NOT be an emergency pause error
        expect(error.message).not.toContain("DEX operations are currently paused");
      }
    });
  });
});