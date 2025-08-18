/**
 * Shared types for Stagehand playground tests
 * Following browser-use test patterns for consistency
 */

import { Severity } from '@src/utils/types';

/**
 * Simple progress tracker for testing - matches browser-use pattern
 */
export class TestProgress {
  constructor(private name: string) {}

  log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}

/**
 * Test context interface - matches browser-use pattern
 */
export interface TestContext {
  events: {
    emit: (event: {
      timestamp: number;
      severity: Severity;
      message: string;
      details?: Record<string, unknown>;
      error?: Error;
    }) => void;
  };
}
