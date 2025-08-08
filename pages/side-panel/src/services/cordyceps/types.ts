/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { type Progress } from './progress';

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Size = {
  width: number;
  height: number;
};

export type LifecycleEvent = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

export interface NavigateOptions {
  waitUntil?: LifecycleEvent;
  timeout?: number;
  referer?: string;
}

export interface NavigateOptionsWithProgress extends NavigateOptions {
  progress?: Progress;
}

export interface NavigationRequest {
  response(): Promise<Response | null>;
}

export interface NavigationEvent {
  frameId: number;
  url: string;
  newDocument?: {
    documentId: string;
    request: NavigationRequest;
  };
  error?: Error;
  lifecycleEvents?: LifecycleEvent[];
}

export type TimeoutOptions = { timeout?: number };

export type StrictOptions = {
  strict?: boolean;
};

export type WaitForElementOptions = StrictOptions & {
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
} & { omitReturnValue?: boolean };

export type Point = {
  x: number;
  y: number;
};

export type CheckOptions = {
  position?: Point;
  force?: boolean;
  timeout?: number;
};

export type ClickOptions = {
  position?: Point;
  force?: boolean;
  timeout?: number;
  delay?: number;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
};

export type SelectOption = string | { value?: string; label?: string; index?: number };

export type SelectOptionOptions = {
  timeout?: number;
  force?: boolean;
};
