import type { BrowserUsePlaygroundService } from './browserUsePlaygroundService';

/**
 * Simple test runner for manual execution
 */
export async function runBrowserUseConversationTests(
  service: BrowserUsePlaygroundService,
): Promise<void> {
  console.log('🚀 Running BrowserUse conversation sanity tests...');

  try {
    // Test 1: Basic conversation history
    console.log('Test 1: Getting conversation history');
    const history = await service.getConversationHistory();
    console.log(`✅ Found ${history.length} existing conversations`);

    // Test 2: Test save without active conversation
    console.log('Test 2: Testing save without active conversation');
    try {
      await service.saveConversation();
      console.log('⚠️ Unexpected: save succeeded without active conversation');
    } catch (error) {
      console.log('✅ Correctly rejected save without active conversation');
    }

    // Test 3: Built-in service tests
    console.log('Test 3: Running built-in service tests');
    await service.testConversationService();
    console.log('✅ Built-in tests completed');

    console.log('🎉 All BrowserUse conversation tests completed successfully!');
  } catch (error) {
    console.error('❌ Tests failed:', error);
    throw error;
  }
}

/**
 * Quick integration test
 */
export async function quickConversationTest(
  service: BrowserUsePlaygroundService,
): Promise<boolean> {
  try {
    const history = await service.getConversationHistory();
    console.log(`✅ Quick test passed - ${history.length} conversations found`);
    return true;
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return false;
  }
}
