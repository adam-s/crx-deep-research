import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { BrowserWindow } from './browser-window';

export const ICordycepsService = createDecorator<ICordycepsService>('cordycepsService');

export interface ICordycepsService {
  readonly _serviceBrand: undefined;
  readonly browser: BrowserWindow;
}

export class CordycepsService implements ICordycepsService {
  public readonly _serviceBrand: undefined;
  private _browser: BrowserWindow;

  constructor() {
    this._browser = new BrowserWindow();
  }

  public get browser(): BrowserWindow {
    return this._browser;
  }
}
