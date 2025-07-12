import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { getSingletonServiceDescriptors } from 'vs/platform/instantiation/common/extensions';
import { IPCClientService } from '@shared/ipc/ipc-client.service';
import { createMainWorldPort } from '../../../packages/shared/src/ipc/createMainWorldPort';
import { IMainProcessService } from '@shared/ipc/client.service';
import { generateUuid } from 'vs/base/common/uuid';
import { ProxyChannel } from 'vs/base/parts/ipc/common/ipc';
import { AlgoliaSearchService } from '@shared/services/algolia-search.service';

export interface IContentAlgoliaConfiguration {}

export class ContentAlgoliaApp extends Disposable {
  private _documentId = generateUuid();

  constructor(private readonly configuration: IContentAlgoliaConfiguration) {
    super();
    console.log('ContentAlgoliaApp initialized with configuration:', configuration);
  }

  get documentId() {
    return this._documentId;
  }

  // Because constructors can't be async, we need to call this method after creating the instance.
  async start() {
    // Register listeners first
    await this.registerListeners();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const instantiationService = await this.initServices();
  }

  async registerListeners() {}

  async initServices() {
    const serviceCollection = new ServiceCollection();
    // Instantiate the services
    const instantiationService = new InstantiationService(serviceCollection, true);

    // All Contributed Services
    const contributedServices = getSingletonServiceDescriptors();
    for (const [id, descriptor] of contributedServices) {
      serviceCollection.set(id, descriptor);
    }
    const ipcClientService = this._register(
      new IPCClientService(this.documentId, await createMainWorldPort(this.documentId, 'Algolia')),
    );
    serviceCollection.set(IMainProcessService, ipcClientService);

    const disposables = this._register(new DisposableStore());

    // AlgoliaSearchService wiring
    const algoliaSearchService = instantiationService.createInstance(AlgoliaSearchService);
    const algoliaSearchServiceChannel = ProxyChannel.fromService(algoliaSearchService, disposables);
    ipcClientService.registerChannel('algoliaSearchService', algoliaSearchServiceChannel);

    return instantiationService;
  }
}
