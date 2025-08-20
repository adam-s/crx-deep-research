/**
 * Minimal content script for ISOLATED world context.
 * This script runs in the isolated world and provides basic messaging functionality.
 * The main functionality is handled by content-cordyceps-main in the MAIN world.
 */

import {
  CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED,
  CRX_DEEP_RESEARCH_NAVIGATION_EVENT,
} from '@shared/utils/message';

// Send the loaded message to indicate this content script is ready
chrome.runtime.sendMessage({
  type: CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED,
});

// Send navigation event to signal content script readiness for waitForLoadState('networkidle')
// This signals that the content script is ready and network has stabilized
chrome.runtime.sendMessage({
  type: CRX_DEEP_RESEARCH_NAVIGATION_EVENT,
  detail: { url: window.location.href },
});

console.log('Content cordyceps (ISOLATED world) loaded - sent navigation ready event');
