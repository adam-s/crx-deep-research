// Export all marking script classes and types
export { BaseElementMarker } from './BaseElementMarker';
export { FinalElementMarker } from './FinalElementMarker';
export { ButtonElementMarker } from './ButtonElementMarker';
export { InputElementMarker } from './InputElementMarker';
export { LinkElementMarker } from './LinkElementMarker';
export { GeneralElementMarker } from './GeneralElementMarker';
export { TextEditorDetector } from './TextEditorDetector';

export * from './types';

import { FinalElementMarker } from './FinalElementMarker';
import { ButtonElementMarker } from './ButtonElementMarker';
import { InputElementMarker } from './InputElementMarker';
import { LinkElementMarker } from './LinkElementMarker';
import { GeneralElementMarker } from './GeneralElementMarker';
import { TextEditorDetector } from './TextEditorDetector';
import { CaptureOptions } from './types';

// Factory function to create instances based on script type
export function createElementMarker(type: 'final' | 'button' | 'input' | 'link' | 'general', options: CaptureOptions = {}) {
  switch (type) {
    case 'final':
      return new FinalElementMarker(options);
    case 'button':
      return new ButtonElementMarker(options);
    case 'input':
      return new InputElementMarker(options);
    case 'link':
      return new LinkElementMarker(options);
    case 'general':
      return new GeneralElementMarker(options);
    default:
      throw new Error(`Unknown marker type: ${type}`);
  }
}

// Global execution functions similar to the original JavaScript files
export function executeFinalMarking(options: CaptureOptions = {}) {
  const marker = new FinalElementMarker(options);
  return marker.captureInteractiveElements();
}

export function executeButtonMarking(options: CaptureOptions = {}) {
  const marker = new ButtonElementMarker(options);
  return marker.captureInteractiveElements();
}

export function executeInputMarking(options: CaptureOptions = {}) {
  const marker = new InputElementMarker(options);
  return marker.captureInteractiveElements();
}

export function executeLinkMarking(options: CaptureOptions = {}) {
  const marker = new LinkElementMarker(options);
  return marker.captureInteractiveElements();
}

export function executeGeneralMarking(options: CaptureOptions = {}) {
  const marker = new GeneralElementMarker(options);
  return marker.captureInteractiveElements();
}

export function executeTextEditorDetection() {
  const detector = new TextEditorDetector();
  return detector.detectTextEditor();
}
