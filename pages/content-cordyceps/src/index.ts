import {
  CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED,
  CRX_DEEP_RESEARCH_NAVIGATION_EVENT,
} from '@shared/utils/message';
import { InjectedScript } from '@injected/injectedScript';
import { UtilityScript } from '@injected/utilityScript';
import { HandledInjectedScript, HandleManager } from './handledInjectedScript';
import './browserUse.js';
declare global {
  // Add type for global properties
  interface Window {
    __cordyceps_injectedScript?: InjectedScript;
    __cordyceps_utilityScript?: UtilityScript;
    __cordyceps_handleManager?: HandleManager;
    __cordyceps_handledInjectedScript?: HandledInjectedScript;
  }
}

function bootstrapInjectedScript(): InjectedScript {
  if (window.__cordyceps_injectedScript) return window.__cordyceps_injectedScript;

  const injected = new InjectedScript(window, {
    isUnderTest: false,
    sdkLanguage: 'javascript',
    testIdAttributeName: 'data-testid',
    stableRafCount: 2,
    browserName: navigator.userAgent.includes('Firefox') ? 'firefox' : 'chrome',
    customEngines: [],
  });
  window.__cordyceps_injectedScript = injected;

  return injected;
}

function bootstrapUtilityScript(): UtilityScript {
  if (window.__cordyceps_utilityScript) return window.__cordyceps_utilityScript;

  const utility = new UtilityScript(window, false); // isUnderTest
  window.__cordyceps_utilityScript = utility;
  return utility;
}

function bootstrapHandleManager(): HandleManager {
  if (window.__cordyceps_handleManager) return window.__cordyceps_handleManager;

  const handleManager = new HandleManager();
  window.__cordyceps_handleManager = handleManager;
  return handleManager;
}

function bootstrapHandledInjectedScript(handleManager: HandleManager): HandledInjectedScript {
  if (window.__cordyceps_handledInjectedScript) return window.__cordyceps_handledInjectedScript;

  const handledInjectedScript = new HandledInjectedScript(
    window,
    false, // isUnderTest
    'javascript', // sdkLanguage
    'data-testid', // testIdAttributeNameForStrictErrorAndConsoleCodegen
    2, // stableRafCount
    navigator.userAgent.includes('Firefox') ? 'firefox' : 'chrome', // browserName
    [], // customEngines
    handleManager,
  );
  window.__cordyceps_handledInjectedScript = handledInjectedScript;

  return handledInjectedScript;
}

// Set up navigation event bridge from MAIN world to extension
function setupNavigationEventBridge(): void {
  document.addEventListener('__cordyceps:navigation', (event: Event) => {
    const customEvent = event as CustomEvent;
    const detail = customEvent.detail as {
      type: 'pushState' | 'replaceState' | 'popstate' | 'hashchange';
      url: string;
      timestamp: number;
    };

    // Forward navigation events to background/side panel
    chrome.runtime
      .sendMessage({
        type: CRX_DEEP_RESEARCH_NAVIGATION_EVENT,
        detail,
        tabId: undefined, // Background script will populate this
        frameId: undefined, // Background script will populate this
      })
      .catch(error => {
        // Ignore errors if no listeners (side panel might be closed)
        console.debug('Navigation event send failed (side panel may be closed):', error);
      });
  });
}

// Initialize the scripts
bootstrapInjectedScript();
bootstrapUtilityScript();
const handleManager = bootstrapHandleManager();
const handledInjectedScript = bootstrapHandledInjectedScript(handleManager);

// Set up navigation event bridge
setupNavigationEventBridge();

// Add debugger to inspect the setup
console.log('🔧 HandledInjectedScript initialized:', handledInjectedScript);

// Send the loaded message
chrome.runtime.sendMessage({
  type: CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED,
});

console.log('Content cordyceps loaded with HandledInjectedScript and NavigationEventBridge');
