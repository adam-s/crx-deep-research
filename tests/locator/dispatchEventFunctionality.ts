import { test } from '../fixtures/cordycepsFixture';
import { expect } from '@playwright/test';

test.describe('Locator dispatchEvent()', () => {
  test('should dispatch custom events on elements', async ({ cordycepsPage }) => {
    await cordycepsPage.goto('http://example.com');

    const result = await cordycepsPage.evaluate(async () => {
      // Create test element
      const testElement = document.createElement('div');
      testElement.id = 'test-dispatch-element';
      testElement.style.width = '100px';
      testElement.style.height = '100px';
      testElement.style.backgroundColor = 'blue';
      document.body.appendChild(testElement);

      // Add event listeners to track dispatched events
      const events: Array<{ type: string; detail?: unknown }> = [];

      testElement.addEventListener('customEvent', (e: Event) => {
        const customEvent = e as CustomEvent;
        events.push({ type: 'customEvent', detail: customEvent.detail });
      });

      testElement.addEventListener('click', () => {
        events.push({ type: 'click' });
      });

      testElement.addEventListener('mousedown', () => {
        events.push({ type: 'mousedown' });
      });

      testElement.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        events.push({ type: 'keydown', detail: keyEvent.key });
      });

      testElement.addEventListener('focus', () => {
        events.push({ type: 'focus' });
      });

      // Store events array on window for later access
      (window as unknown as { testEvents: Array<{ type: string; detail?: unknown }> }).testEvents =
        events;

      return 'setup complete';
    });

    expect(result).toBe('setup complete');

    // Test custom event dispatch
    const customEventLocator = cordycepsPage.locator('#test-dispatch-element');
    await customEventLocator.dispatchEvent('customEvent', {
      detail: { message: 'Hello from custom event' },
    });

    // Test mouse event dispatch
    await customEventLocator.dispatchEvent('click');
    await customEventLocator.dispatchEvent('mousedown');

    // Test keyboard event dispatch
    await customEventLocator.dispatchEvent('keydown', { key: 'Enter' });

    // Test focus event dispatch
    await customEventLocator.dispatchEvent('focus');

    // Verify events were dispatched correctly
    const capturedEvents = await cordycepsPage.evaluate(() => {
      return (window as unknown as { testEvents: Array<{ type: string; detail?: unknown }> })
        .testEvents;
    });

    expect(capturedEvents).toHaveLength(5);
    expect(capturedEvents[0]).toEqual({
      type: 'customEvent',
      detail: { message: 'Hello from custom event' },
    });
    expect(capturedEvents[1]).toEqual({ type: 'click' });
    expect(capturedEvents[2]).toEqual({ type: 'mousedown' });
    expect(capturedEvents[3]).toEqual({ type: 'keydown', detail: 'Enter' });
    expect(capturedEvents[4]).toEqual({ type: 'focus' });
  });

  test('should handle dispatchEvent timeout correctly', async ({ cordycepsPage }) => {
    await cordycepsPage.goto('http://example.com');

    // Test timeout when element doesn't exist
    const nonExistentLocator = cordycepsPage.locator('#non-existent-element');

    await expect(async () => {
      await nonExistentLocator.dispatchEvent('click', {}, { timeout: 1000 });
    }).rejects.toThrow();
  });

  test('should work with Frame.dispatchEvent()', async ({ cordycepsPage }) => {
    await cordycepsPage.goto('http://example.com');

    await cordycepsPage.evaluate(() => {
      // Create test element for frame testing
      const testElement = document.createElement('button');
      testElement.id = 'frame-dispatch-button';
      testElement.textContent = 'Frame Dispatch Test';
      document.body.appendChild(testElement);

      const events: string[] = [];
      testElement.addEventListener('custom-frame-event', () => {
        events.push('custom-frame-event');
      });

      (window as unknown as { frameEvents: string[] }).frameEvents = events;
    });

    // Test Frame.dispatchEvent
    const mainFrame = cordycepsPage.frameManager.mainFrame();
    await mainFrame.dispatchEvent('#frame-dispatch-button', 'custom-frame-event');

    const frameEvents = await cordycepsPage.evaluate(() => {
      return (window as unknown as { frameEvents: string[] }).frameEvents;
    });

    expect(frameEvents).toEqual(['custom-frame-event']);
  });

  test('should work with Page.dispatchEvent()', async ({ cordycepsPage }) => {
    await cordycepsPage.goto('http://example.com');

    await cordycepsPage.evaluate(() => {
      // Create test element for page testing
      const testElement = document.createElement('div');
      testElement.id = 'page-dispatch-element';
      document.body.appendChild(testElement);

      const events: string[] = [];
      testElement.addEventListener('page-custom-event', () => {
        events.push('page-custom-event');
      });

      (window as unknown as { pageEvents: string[] }).pageEvents = events;
    });

    // Test Page.dispatchEvent
    await cordycepsPage.dispatchEvent('#page-dispatch-element', 'page-custom-event');

    const pageEvents = await cordycepsPage.evaluate(() => {
      return (window as unknown as { pageEvents: string[] }).pageEvents;
    });

    expect(pageEvents).toEqual(['page-custom-event']);
  });

  test('should dispatch events with complex eventInit objects', async ({ cordycepsPage }) => {
    await cordycepsPage.goto('http://example.com');

    await cordycepsPage.evaluate(() => {
      const testElement = document.createElement('input');
      testElement.id = 'complex-event-input';
      testElement.type = 'text';
      document.body.appendChild(testElement);

      const events: Array<{ type: string; [key: string]: unknown }> = [];

      testElement.addEventListener('keydown', (e: Event) => {
        const keyEvent = e as KeyboardEvent;
        events.push({
          type: 'keydown',
          key: keyEvent.key,
          code: keyEvent.code,
          ctrlKey: keyEvent.ctrlKey,
          shiftKey: keyEvent.shiftKey,
          altKey: keyEvent.altKey,
        });
      });

      testElement.addEventListener('click', (e: Event) => {
        const mouseEvent = e as MouseEvent;
        events.push({
          type: 'click',
          button: mouseEvent.button,
          ctrlKey: mouseEvent.ctrlKey,
          clientX: mouseEvent.clientX,
          clientY: mouseEvent.clientY,
        });
      });

      (
        window as unknown as { complexEvents: Array<{ type: string; [key: string]: unknown }> }
      ).complexEvents = events;
    });

    const locator = cordycepsPage.locator('#complex-event-input');

    // Dispatch complex keyboard event
    await locator.dispatchEvent('keydown', {
      key: 'A',
      code: 'KeyA',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
    });

    // Dispatch complex mouse event
    await locator.dispatchEvent('click', {
      button: 0,
      ctrlKey: true,
      clientX: 50,
      clientY: 75,
    });

    const complexEvents = await cordycepsPage.evaluate(() => {
      return (
        window as unknown as { complexEvents: Array<{ type: string; [key: string]: unknown }> }
      ).complexEvents;
    });

    expect(complexEvents).toHaveLength(2);

    // Verify keyboard event properties
    const keydownEvent = complexEvents[0];
    expect(keydownEvent.type).toBe('keydown');
    expect(keydownEvent.key).toBe('A');
    expect(keydownEvent.code).toBe('KeyA');
    expect(keydownEvent.ctrlKey).toBe(true);
    expect(keydownEvent.shiftKey).toBe(false);
    expect(keydownEvent.altKey).toBe(false);

    // Verify mouse event properties
    const clickEvent = complexEvents[1];
    expect(clickEvent.type).toBe('click');
    expect(clickEvent.button).toBe(0);
    expect(clickEvent.ctrlKey).toBe(true);
    expect(clickEvent.clientX).toBe(50);
    expect(clickEvent.clientY).toBe(75);
  });
});
