/*
 * Copyright (c) Gala Games Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ChainKey, ChainObject, ForbiddenError } from "@gala-chain/api";
import { GalaChainContext, getObjectByKey, putChainObject } from "@gala-chain/chaincode";
import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";

export class EmergencyPauseState extends ChainObject {
  public static readonly INDEX_KEY = "GCDEMERGENCYPAUSE";
  
  @ChainKey({ position: 0 })
  @IsString()
  public readonly key: string = "SINGLETON";
  
  @IsBoolean()
  public isPaused: boolean;
  
  @IsOptional()
  @IsString()
  public pausedBy?: string;
  
  @IsOptional()
  @IsInt()
  public pausedAt?: number;
  
  @IsOptional()
  @IsString()
  public reason?: string;
  
  constructor() {
    super();
    this.isPaused = false;
  }
}

export class EmergencyControl {
  /**
   * Pauses all DEX operations in case of emergency
   * Requires admin privileges
   */
  public static async pauseDex(ctx: GalaChainContext, reason: string): Promise<void> {
    // Check admin permission
    const callingUser = ctx.callingUser;
    if (!this.isAdmin(ctx, callingUser)) {
      throw new ForbiddenError("Only admins can pause the DEX");
    }
    
    // Create pause state data
    const pauseState = {
      isPaused: true,
      key: "SINGLETON",
      pausedBy: callingUser,
      pausedAt: ctx.txUnixTime,
      reason: reason
    };

    // Store using the same method as checkPaused uses to read
    const key = ctx.stub.createCompositeKey(EmergencyPauseState.INDEX_KEY, []);
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(pauseState)));
    
    // Emit event
    ctx.stub.setEvent("EmergencyPause", Buffer.from(JSON.stringify({
      pausedBy: callingUser,
      timestamp: ctx.txUnixTime,
      reason
    })));
  }
  
  /**
   * Resumes DEX operations after emergency
   * Requires admin privileges
   */
  public static async resumeDex(ctx: GalaChainContext): Promise<void> {
    // Check admin permission
    const callingUser = ctx.callingUser;
    if (!this.isAdmin(ctx, callingUser)) {
      throw new ForbiddenError("Only admins can resume the DEX");
    }
    
    // Clear pause state using the same method
    const key = ctx.stub.createCompositeKey(EmergencyPauseState.INDEX_KEY, []);
    const pauseState = {
      isPaused: false,
      key: "SINGLETON",
      pausedBy: undefined,
      pausedAt: undefined,
      reason: undefined
    };
    
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(pauseState)));
    
    // Emit event
    ctx.stub.setEvent("EmergencyResume", Buffer.from(JSON.stringify({
      resumedBy: callingUser,
      timestamp: ctx.txUnixTime
    })));
  }
  
  /**
   * Checks if DEX is currently paused
   * Should be called at the start of every state-changing function
   */
  public static async checkPaused(ctx: GalaChainContext): Promise<void> {
    try {
      const key = ctx.stub.createCompositeKey(EmergencyPauseState.INDEX_KEY, []);
      
      // Get raw state data
      const stateBytes = await ctx.stub.getState(key);
      
      if (stateBytes && stateBytes.length > 0) {
        // Parse the stored JSON
        const stateData = JSON.parse(stateBytes.toString());
        
        if (stateData && stateData.isPaused === true) {
          throw new ForbiddenError(`DEX operations are currently paused: ${stateData.reason || "Emergency maintenance"}`);
        }
      }
    } catch (error) {
      // If it's a ForbiddenError (pause error), re-throw it
      if (error instanceof ForbiddenError) {
        throw error;
      }
      // If it's any other error (like JSON parse error), assume system is not paused
      // Log the error for debugging but don't throw
      console.log(`DEBUG: Error checking pause state: ${error.message}`);
    }
  }
  
  /**
   * Check if user is admin
   * TODO: Implement your actual admin check logic here
   */
  private static isAdmin(ctx: GalaChainContext, user: string): boolean {
    // For now, you can hardcode admin users or check MSP
    // This should be replaced with your actual admin logic
    
    // Example: Check if user belongs to admin organization
    const mspId = ctx.clientIdentity.getMSPID();
    
    // Replace these with your actual admin MSPs
    const adminMSPs = ["GalaAdminMSP", "Org1MSP"];
    
    return adminMSPs.includes(mspId);
  }
}