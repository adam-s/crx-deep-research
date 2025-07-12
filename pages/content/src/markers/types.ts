// Type definitions for the marking scripts

export interface CaptureOptions {
  debugHighlight?: boolean;
}

export interface InteractiveElement {
  index: number;
  type: string;
  xpath: string;
  description: string;
  text: string;
  x: number;
  y: number;
  inViewport?: boolean;
}

export interface TextEditorDetection {
  detected: boolean;
  XPath?: string;
  X?: number;
  Y?: number;
}

export type ElementFilterFunction = (node: Element) => number;

export interface HighlightStyle {
  position: string;
  border: string;
  backgroundColor: string;
  top: string;
  left: string;
  width: string;
  height: string;
  pointerEvents: string;
}

export interface LabelStyle {
  position: string;
  top?: string;
  bottom?: string;
  left: string;
  background: string;
  color: string;
  padding: string;
  borderRadius: string;
  fontSize: string;
  whiteSpace: string;
  overflow: string;
  textOverflow: string;
  lineHeight: string;
  textShadow: string;
}
