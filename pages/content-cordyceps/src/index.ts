/**
 * Minimal content script for ISOLATED world context.
 * This script runs in the isolated world and provides basic messaging functionality.
 * The main functionality is handled by content-cordyceps-main in the MAIN world.
 */

import { CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED } from '@shared/utils/message';

// Send the loaded message to indicate this content script is ready
chrome.runtime.sendMessage({
  type: CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED,
});

console.log('Content cordyceps (ISOLATED world) loaded - minimal functionality');
