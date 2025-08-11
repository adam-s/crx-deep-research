/**
 * Simple test script to verify network header capture functionality
 * This can be run from the side panel to test header capture
 */

export interface HeaderTestResult {
  success: boolean;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  errors: string[];
}

export async function testNetworkHeaderCapture(): Promise<HeaderTestResult> {
  const result: HeaderTestResult = {
    success: false,
    requestHeaders: {},
    responseHeaders: {},
    errors: [],
  };

  try {
    // Test that chrome.webRequest is available
    if (!chrome.webRequest) {
      result.errors.push('chrome.webRequest is not available');
      return result;
    }

    // Test basic listener registration
    let requestHeadersCaptured = false;
    let responseHeadersCaptured = false;

    const requestListener = (details: chrome.webRequest.WebRequestHeadersDetails) => {
      if (details.requestHeaders && details.requestHeaders.length > 0) {
        requestHeadersCaptured = true;
        console.log('✓ Request headers captured:', details.requestHeaders.length, 'headers');

        // Convert to object for testing
        for (const header of details.requestHeaders) {
          if (header.name && header.value) {
            result.requestHeaders[header.name.toLowerCase()] = header.value;
          }
        }
      }
    };

    const responseListener = (details: chrome.webRequest.WebResponseHeadersDetails) => {
      if (details.responseHeaders && details.responseHeaders.length > 0) {
        responseHeadersCaptured = true;
        console.log('✓ Response headers captured:', details.responseHeaders.length, 'headers');

        // Convert to object for testing
        for (const header of details.responseHeaders) {
          if (header.name && header.value) {
            result.responseHeaders[header.name.toLowerCase()] = header.value;
          }
        }
      }
    };

    // Register listeners
    chrome.webRequest.onBeforeSendHeaders.addListener(requestListener, { urls: ['<all_urls>'] }, [
      'requestHeaders',
    ]);

    chrome.webRequest.onHeadersReceived.addListener(responseListener, { urls: ['<all_urls>'] }, [
      'responseHeaders',
    ]);

    console.log('📡 Network header listeners registered, waiting for requests...');

    // Wait for some network activity (or create some)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Cleanup listeners
    chrome.webRequest.onBeforeSendHeaders.removeListener(requestListener);
    chrome.webRequest.onHeadersReceived.removeListener(responseListener);

    // Check results
    if (requestHeadersCaptured && responseHeadersCaptured) {
      result.success = true;
      console.log('✅ Header capture test successful!');
    } else {
      result.errors.push(
        `Header capture incomplete: request=${requestHeadersCaptured}, response=${responseHeadersCaptured}`,
      );
    }
  } catch (error) {
    result.errors.push(`Test failed: ${error}`);
    console.error('❌ Header capture test failed:', error);
  }

  return result;
}

// Make it available globally for testing in console
declare global {
  interface Window {
    testNetworkHeaderCapture: typeof testNetworkHeaderCapture;
  }
}

if (typeof window !== 'undefined') {
  window.testNetworkHeaderCapture = testNetworkHeaderCapture;
}
