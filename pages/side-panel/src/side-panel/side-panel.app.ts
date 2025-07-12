// External libraries
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { Disposable } from 'vs/base/common/lifecycle';
import { getSingletonServiceDescriptors } from 'vs/platform/instantiation/common/extensions';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';

// Shared services and utilities
import { ILogService, LogService } from '@shared/services/log.service';
import { MessageClient } from '@shared/ipc/message/MessageClient';
import { MessageServer } from '@shared/ipc/message/MessageServer';
import { CRX_DEEP_RESEARCH_SIDE_PANEL_VISIBILITY_CHANGE } from '@shared/utils/message';
import {
  ILocalAsyncStorage,
  LocalAsyncStorageService,
} from '@crx-deep-research/shared/src/storage/localAsyncStorage/localAsyncStorage.service';

import { renderSidePanel } from '@src/side-panel/index';

import { IConnectionManager, ConnectionManager } from '@shared/ipc/message/ConnectionManger';
import { ProxyChannel, StaticRouter } from 'vs/base/parts/ipc/common/ipc';
import { IMathService } from '@shared/services/math.service';
import { IAlgoliaSearchService } from '@shared/services/algolia-search.service';
import { parseDocumentId } from '@shared/utils/utils';
import {
  ISubmissionDetectionService,
  SubmissionDetectionService,
} from '@src/services/submission-detection.service';

export interface ISidePanelConfiguration {}

// Define a basic schema for your local async storage
// You can expand this with specific keys and types as needed
interface SidePanelStorageSchema {
  [key: string]: unknown;
  // Example: openAiApiKey?: string;
}
export class SidePanelApp extends Disposable {
  private _windowId!: number;

  constructor(private readonly configuration: ISidePanelConfiguration) {
    super();
    this._registerListeners();
    this._sendReloadMessageToContentScripts();
  }

  get windowId() {
    return this._windowId;
  }

  // Because constructors can't be async, we need to call this method
  // after creating the instance.
  async start() {
    this._windowId = await new Promise(resolve =>
      chrome.windows.getCurrent(window => resolve(window.id!)),
    );

    try {
      const instantiationService = await this._initServices();
      renderSidePanel(instantiationService);
    } catch (error) {
      console.log(error);
    }
  }

  private async _initServices() {
    const serviceCollection = new ServiceCollection();
    const instantiationService = new InstantiationService(serviceCollection, true);

    const contributedServices = getSingletonServiceDescriptors();
    for (const [id, descriptor] of contributedServices) {
      serviceCollection.set(id, descriptor);
    }

    // Register ILogService
    const logService = instantiationService.createInstance(LogService);
    serviceCollection.set(ILogService, logService);

    // Register LocalAsyncStorageService
    const localAsyncStorageService = this._register(
      instantiationService.createInstance(LocalAsyncStorageService<SidePanelStorageSchema>),
    );
    serviceCollection.set(ILocalAsyncStorage, localAsyncStorageService);
    await localAsyncStorageService.start();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const messageClient = new MessageClient( // Message Client
      `documentId:side-panel:${this.windowId}`,
      'documentId:service-worker',
    );

    serviceCollection.set(IConnectionManager, new SyncDescriptor(ConnectionManager));

    // #region Content Injected Script
    const channelId = `documentId:side-panel:content:${this.windowId}`;
    const server = new MessageServer(channelId);

    const contentRouter = new StaticRouter(async ctx => {
      const parsedDocument = parseDocumentId(ctx);
      if (!parsedDocument?.tabId) return false;
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isMatchingTab = activeTab?.id === parsedDocument.tabId;
      return isMatchingTab;
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mathService = ProxyChannel.toService<IMathService>(
      server.getChannel('mathService', contentRouter),
    );

    mathService.add(2, 3).then(result => {
      console.log('Math service result:', result);
    });

    const algoliaRouter = new StaticRouter(async ctx => {
      const parsedDocument = parseDocumentId(ctx);
      if (!parsedDocument?.tabId) return false;
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const isMatchingTab = tabs.some(
        tab =>
          tab.id === parsedDocument.tabId &&
          typeof tab.url === 'string' &&
          tab.url.startsWith('https://hn.algolia.com/'),
      );
      return isMatchingTab;
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const algoliaSearchService = ProxyChannel.toService<IAlgoliaSearchService>(
      server.getChannel('algoliaSearchService', algoliaRouter),
    );

    serviceCollection.set(IAlgoliaSearchService, algoliaSearchService);

    const submissionDetectionService = this._register(
      instantiationService.createInstance(SubmissionDetectionService),
    );
    serviceCollection.set(ISubmissionDetectionService, submissionDetectionService);

    return instantiationService;
  }

  private _sendReloadMessageToContentScripts(): void {
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs
            .sendMessage(tab.id, { type: 'CRX_DEEP_RESEARCH_SIDE_PANEL_RELOAD' })
            .catch(() => {
              // Ignore errors for tabs that don't have content scripts
            });
        }
      });
    });
  }

  private _registerListeners(): void {
    document.addEventListener('visibilitychange', () => {
      const listener = (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message: any,
        _: chrome.runtime.MessageSender,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sendResponse: (response?: any) => void,
      ) => {
        if (
          message.type === `crx-deep-research:sidePanelVisibilityChangeTest:${this.windowId}`
        ) {
          setTimeout(() => {
            sendResponse();
          }, 100);
          chrome.runtime.onMessage.removeListener(listener);
          return true;
        }
        return false;
      };
      chrome.runtime.onMessage.addListener(listener);
      chrome.runtime
        .sendMessage({
          type: CRX_DEEP_RESEARCH_SIDE_PANEL_VISIBILITY_CHANGE,
          windowId: this.windowId,
        })
        .catch(error => {
          console.log('sending visibility message error: ', error);
        });
    });
  }
}
