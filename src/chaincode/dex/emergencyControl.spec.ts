/*
 * Emergency Control Test Suite
 */
import { GalaChainContext } from "@gala-chain/chaincode";
import { ForbiddenError } from "@gala-chain/api";
import { EmergencyControl, EmergencyPauseState } from "./emergencyControl";
import { swap } from "./swap";
import { addLiquidity } from "./addLiquidity";
import { burn } from "./burn";
import { collect } from "./collect";

describe("Emergency Control Tests", () => {
  let ctx: GalaChainContext;
  let mockState: Map<string, Buffer>;
  
  beforeEach(() => {
    mockState = new Map();
    
    // Mock context with proper state management
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

  describe("Emergency Pause", () => {
    it("should allow admin to pause the DEX", async () => {
      await expect(EmergencyControl.pauseDex(ctx, "Security vulnerability detected"))
        .resolves.not.toThrow();
      
      expect(ctx.stub.setEvent).toHaveBeenCalledWith(
        "EmergencyPause",
        expect.any(Buffer)
      );
    });

    it("should prevent non-admin from pausing", async () => {
      ctx.clientIdentity.getMSPID = jest.fn().mockReturnValue("UserMSP");
      
      await expect(EmergencyControl.pauseDex(ctx, "Trying to pause"))
        .rejects.toThrow(ForbiddenError);
    });
  });

  describe("Pause Check", () => { 
    it("should throw error when DEX is paused", async () => {
      // First pause the DEX using our pauseDex method
      await EmergencyControl.pauseDex(ctx, "Emergency maintenance");
      
      // Now check if it properly detects the paused state
      await expect(EmergencyControl.checkPaused(ctx))
        .rejects.toThrow("DEX operations are currently paused");
    });

    it("should not throw when DEX is not paused", async () => {
      // mockState is empty by default, so system should not be paused
      await expect(EmergencyControl.checkPaused(ctx))
        .resolves.not.toThrow();
    });
  });

  describe("Resume Functionality", () => {
    it("should allow admin to resume operations", async () => {
      await expect(EmergencyControl.resumeDex(ctx))
        .resolves.not.toThrow();
      
      expect(ctx.stub.setEvent).toHaveBeenCalledWith(
        "EmergencyResume",
        expect.any(Buffer)
      );
    });
  });
});