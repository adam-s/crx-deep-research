// #region Type Definitions

export type DocumentLifecycle = 'prerender' | 'active' | 'cached' | 'pending_deletion'; // extensionTypes.DocumentLifecycle

export type FrameType = 'outermost_frame' | 'sub_frame' | 'fenced_frame'; // extensionTypes.FrameType

export type TabStatus = 'unloaded' | 'loading' | 'complete'; // tabs.TabStatus

export interface FrameConfiguration {
  // Frame properties (from webNavigation.getFrame / getAllFrames)
  documentId: string;
  documentLifecycle: DocumentLifecycle;
  errorOccurred: boolean;
  frameType: FrameType;
  parentFrameId: number;
  parentDocumentId?: string;
  url: string;

  // Sender / runtime.MessageSender bits
  frameId: number;
  extensionId: string; // sender.id
  origin: string; // sender.origin

  // Tab properties (flattened from sender.tab)
  tabId: number;
  tabActive: boolean;
  tabAudible?: boolean;
  tabAutoDiscardable: boolean;
  tabDiscarded: boolean;
  tabFavIconUrl?: string;
  tabFrozen: boolean;
  tabGroupId: number;
  tabHeight?: number;
  tabHighlighted: boolean;
  tabIncognito: boolean;
  tabIndex: number;
  tabLastAccessed: number;
  tabMuted: boolean;
  tabPinned: boolean;
  /** Deprecated upstream — keep only if you still read it from sender.tab */
  tabSelected: boolean;
  tabStatus: TabStatus;
  tabTitle?: string;
  tabUrl?: string;
  tabWidth?: number;
  tabWindowId: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// #endregion

// #region Pure Utility Functions

/**
 * Merges frame details and sender information into a typed FrameConfiguration object
 * @param frameDetails Frame details from webNavigation.getFrame or getAllFrames
 * @param sender MessageSender from runtime.onMessage or similar
 * @returns Flattened FrameConfiguration object
 */
export function createFrameConfiguration(
  frameDetails: {
    documentId: string;
    documentLifecycle: DocumentLifecycle;
    errorOccurred: boolean;
    frameType: FrameType;
    parentFrameId: number;
    parentDocumentId?: string;
    url: string;
  },
  sender: chrome.runtime.MessageSender,
): FrameConfiguration {
  const tab = sender.tab;

  if (!tab) {
    throw new Error('MessageSender must include tab information');
  }

  return {
    // Frame properties
    documentId: frameDetails.documentId,
    documentLifecycle: frameDetails.documentLifecycle,
    errorOccurred: frameDetails.errorOccurred,
    frameType: frameDetails.frameType,
    parentFrameId: frameDetails.parentFrameId,
    parentDocumentId: frameDetails.parentDocumentId,
    url: frameDetails.url,

    // Sender properties
    frameId: sender.frameId ?? 0,
    extensionId: sender.id ?? '',
    origin: sender.origin ?? '',

    // Tab properties (flattened)
    tabId: tab.id ?? -1,
    tabActive: tab.active ?? false,
    tabAudible: tab.audible,
    tabAutoDiscardable: tab.autoDiscardable ?? true,
    tabDiscarded: tab.discarded ?? false,
    tabFavIconUrl: tab.favIconUrl,
    tabFrozen: false, // Not available on chrome.tabs.Tab, always false
    tabGroupId: tab.groupId ?? -1,
    tabHeight: tab.height,
    tabHighlighted: tab.highlighted ?? false,
    tabIncognito: tab.incognito ?? false,
    tabIndex: tab.index ?? -1,
    tabLastAccessed: tab.lastAccessed ?? 0,
    tabMuted: tab.mutedInfo?.muted ?? false,
    tabPinned: tab.pinned ?? false,
    tabSelected: tab.selected ?? false,
    tabStatus: (tab.status as TabStatus) ?? 'unloaded',
    tabTitle: tab.title,
    tabUrl: tab.url,
    tabWidth: tab.width,
    tabWindowId: tab.windowId ?? -1,
  };
}

/**
 * Gets frame details from Chrome's webNavigation API
 * @param tabId The tab ID
 * @param frameId The frame ID
 * @returns Frame details or null if frame not found
 */
export function getFrame(
  tabId: number,
  frameId: number,
): Promise<chrome.webNavigation.GetFrameResultDetails | null> {
  return new Promise((resolve, reject) => {
    chrome.webNavigation.getFrame({ tabId, frameId }, frame => {
      const err = chrome.runtime.lastError;
      err ? reject(err) : resolve(frame);
    });
  });
}

/**
 * Calculate the center position of a bounding box
 * @param boundingBox The bounding box to calculate center for
 * @returns Position at the center of the bounding box
 */
export function calculateCenterPosition(boundingBox: BoundingBox): Position {
  return {
    x: boundingBox.x + boundingBox.width / 2,
    y: boundingBox.y + boundingBox.height / 2,
  };
}

/**
 * Create a DragEvent with proper initialization
 * @param type The event type (dragstart, dragenter, etc.)
 * @param position The position for the event
 * @param dataTransfer The DataTransfer object
 * @returns A properly initialized DragEvent
 */
export function createDragEvent(
  type: string,
  position: Position,
  dataTransfer: DataTransfer,
): DragEvent {
  return new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: position.x,
    clientY: position.y,
    dataTransfer,
  });
}

/**
 * Create a MouseEvent with proper initialization
 * @param type The event type (mouseenter, mouseleave, etc.)
 * @param position The position for the event
 * @returns A properly initialized MouseEvent
 */
export function createMouseEvent(type: string, position: Position): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: position.x,
    clientY: position.y,
  });
}

/**
 * Create and initialize a DataTransfer object with element data
 * @param sourceElement The source element to extract data from
 * @returns A DataTransfer object with text and HTML data
 */
export function createDataTransfer(sourceElement: Element): DataTransfer {
  const dataTransfer = new DataTransfer();

  // Set some default data for the drag operation
  dataTransfer.setData('text/plain', sourceElement.textContent || '');
  dataTransfer.setData('text/html', sourceElement.outerHTML);

  return dataTransfer;
}

/**
 * Create a complete drag and drop script function that can be executed in a content script context
 * This returns a function that can be passed to executeScript
 */
export function createDragAndDropScript() {
  return (
    sourceSelector: string,
    targetSelector: string,
    srcPos: { x: number; y: number },
    tgtPos: { x: number; y: number },
  ) => {
    // Find elements in the content script context
    const sourceElem = document.querySelector(sourceSelector);
    const targetElem = document.querySelector(targetSelector);

    if (!sourceElem) {
      throw new Error(`Source element not found: ${sourceSelector}`);
    }
    if (!targetElem) {
      throw new Error(`Target element not found: ${targetSelector}`);
    }

    // Create a DataTransfer object (carries the payload)
    const dataTransfer = new DataTransfer();

    // Set some default data for the drag operation
    dataTransfer.setData('text/plain', sourceElem.textContent || '');
    dataTransfer.setData('text/html', sourceElem.outerHTML);

    // 1. Focus and hover source element
    if (sourceElem instanceof HTMLElement) {
      sourceElem.focus();
    }
    sourceElem.dispatchEvent(
      new MouseEvent('mouseenter', {
        bubbles: true,
        cancelable: true,
        clientX: srcPos.x,
        clientY: srcPos.y,
      }),
    );

    // 2. Dispatch dragstart on the source
    const dragStartEvent = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      clientX: srcPos.x,
      clientY: srcPos.y,
      dataTransfer,
    });
    sourceElem.dispatchEvent(dragStartEvent);

    // 3. Dispatch dragenter on the target
    const dragEnterEvent = new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
      clientX: tgtPos.x,
      clientY: tgtPos.y,
      dataTransfer,
    });
    targetElem.dispatchEvent(dragEnterEvent);

    // 4. Dispatch dragover on the target
    const dragOverEvent = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      clientX: tgtPos.x,
      clientY: tgtPos.y,
      dataTransfer,
    });
    targetElem.dispatchEvent(dragOverEvent);

    // 5. Dispatch drop on the target
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      clientX: tgtPos.x,
      clientY: tgtPos.y,
      dataTransfer,
    });
    targetElem.dispatchEvent(dropEvent);

    // 6. Dispatch dragend on the source (cleanup)
    const dragEndEvent = new DragEvent('dragend', {
      bubbles: true,
      cancelable: true,
      clientX: srcPos.x,
      clientY: srcPos.y,
      dataTransfer,
    });
    sourceElem.dispatchEvent(dragEndEvent);

    return 'success';
  };
}

/**
 * Validate that a bounding box has valid dimensions
 * @param boundingBox The bounding box to validate
 * @returns True if the bounding box has valid dimensions
 */
export function isValidBoundingBox(boundingBox: BoundingBox | null): boundingBox is BoundingBox {
  return boundingBox !== null && boundingBox.width > 0 && boundingBox.height > 0;
}

/**
 * Generate a human-readable string for a bounding box
 * @param boundingBox The bounding box to describe
 * @returns A descriptive string
 */
export function describeBoundingBox(boundingBox: BoundingBox): string {
  return `x=${boundingBox.x}, y=${boundingBox.y}, width=${boundingBox.width}, height=${boundingBox.height}`;
}

// #endregion

// #region Test ID Management

let _testIdAttributeName: string = 'data-testid';

/**
 * Get the current test ID attribute name
 * @returns The current test ID attribute name
 */
export function testIdAttributeName(): string {
  return _testIdAttributeName;
}

/**
 * Set the test ID attribute name
 * @param attributeName The new test ID attribute name
 */
export function setTestIdAttribute(attributeName: string): void {
  _testIdAttributeName = attributeName;
}

// #endregion
