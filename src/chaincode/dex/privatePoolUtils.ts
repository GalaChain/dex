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
import { UnauthorizedError } from "@gala-chain/api";

import { Pool } from "../../api/";

/**
 * @dev Validates if a user has access to a private pool
 * @param pool The pool to check access for
 * @param user The user address to validate
 * @throws UnauthorizedError if user is not whitelisted for private pools
 */
export function validatePrivatePoolAccess(pool: Pool, user: string): void {
  if (pool.isPrivate && !pool.isWhitelisted(user)) {
    throw new UnauthorizedError(
      `Access denied: Pool is private and user ${user} is not whitelisted. Whitelisted users: ${pool.whitelist.join(", ")}`
    );
  }
}

/**
 * @dev Checks if a user can make a pool public
 * @param pool The pool to check
 * @param user The user address to validate
 * @returns true if user can make the pool public
 */
export function canMakePoolPublic(pool: Pool, user: string): boolean {
  return pool.canMakePublic(user);
}

/**
 * @dev Checks if a user is whitelisted for a pool
 * @param pool The pool to check
 * @param user The user address to validate
 * @returns true if user is whitelisted or pool is public
 */
export function isWhitelisted(pool: Pool, user: string): boolean {
  return pool.isWhitelisted(user);
}


