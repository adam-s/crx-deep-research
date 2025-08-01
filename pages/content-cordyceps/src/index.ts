import { CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED } from '@shared/utils/message';
import { InjectedScript } from '@injected/injectedScript';
import { UtilityScript } from '@injected/utilityScript';
import { HandledInjectedScript, HandleManager } from './handledInjectedScript';

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

// Initialize the scripts
bootstrapInjectedScript();
bootstrapUtilityScript();
const handleManager = bootstrapHandleManager();
bootstrapHandledInjectedScript(handleManager);

// Send the loaded message
chrome.runtime.sendMessage({
  type: CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED,
});

console.log('Content cordyceps loaded with HandledInjectedScript');
