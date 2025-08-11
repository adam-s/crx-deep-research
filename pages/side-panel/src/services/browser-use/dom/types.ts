/**
 * DOM element node type definitions
 */

export interface ElementHash {
  branchPathHash: string;
  // Add other hash properties as needed
}

export interface DOMElementNode {
  tag: string;
  id?: string;
  className?: string;
  textContent?: string;
  attributes?: Record<string, string>;
  children?: DOMElementNode[];
  index?: number;
  parent?: DOMElementNode;
  isVisible?: boolean;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  xpath?: string;
  selector?: string;
  hash?: ElementHash;
}

export interface DOMTreeOptions {
  includeAttributes?: string[];
  useHighlights?: boolean;
  includeScreenshot?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
}
