import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { BrowserWindow } from '../cordyceps/browserWindow';
import { ILogService } from '@shared/services/log.service';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema, StorageKeys } from '@shared/storage/types/storage.types';
import { run } from './example';

export const IBrowserUseService = createDecorator<IBrowserUseService>('browserUseService');

export interface IBrowserUseService {
  readonly _serviceBrand: undefined;
  readonly getBrowser: () => Promise<BrowserWindow>;
  readonly runExample: () => Promise<void>;
}

export class BrowserUseService implements IBrowserUseService {
  public readonly _serviceBrand: undefined;
  private _browser: Promise<BrowserWindow>;

  constructor(
    @ILogService private readonly _logService: ILogService,
    @ILocalAsyncStorage private readonly _storage: ILocalAsyncStorage<SidePanelAppStorageSchema>,
  ) {
    this._logService.info('BrowserUseService is running');
    this._browser = BrowserWindow.create();
  }

  public getBrowser(): Promise<BrowserWindow> {
    return this._browser;
  }

  public async runExample(): Promise<void> {
    this._logService.info('BrowserUseService: Getting OpenAI API key and running example');

    try {
      // Get the OpenAI API key from storage
      const openAIKey = await this._storage.get(StorageKeys.OPEN_AI_API_KEY);

      if (!openAIKey) {
        this._logService.error('BrowserUseService: OpenAI API key not found in storage');
        throw new Error('OpenAI API key not configured. Please set it in Settings.');
      }

      this._logService.info('BrowserUseService: OpenAI API key found, running example');
      await run(openAIKey);
      this._logService.info('BrowserUseService: Example completed successfully');
    } catch (error) {
      this._logService.error('BrowserUseService: Example run failed', error);
      throw error;
    }
  }
}
