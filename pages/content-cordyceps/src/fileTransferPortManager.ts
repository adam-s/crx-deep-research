import { generateUuid } from 'vs/base/common/uuid';
import {
  FileTransferEvent,
  FileTransferCommand,
  FileTransferRequest,
  BufferTransferRequest,
  FileChunk,
  CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_CREATE,
  IncomingFileMeta,
} from '@shared/utils/fileTransferPort';

/**
 * File Transfer Port Manager for content scripts.
 * Handles temporary port connections with the side panel for file and buffer transfers.
 */
export class FileTransferPortManager {
  private readonly _activePorts = new Map<string, FileTransferPort>();

  /**
   * Creates a new file transfer port and notifies the side panel.
   */
  createPort(): FileTransferPort {
    const portId = generateUuid();
    const port = new FileTransferPort(portId, this._onPortClosed.bind(this));
    this._activePorts.set(portId, port);

    // Notify side panel that port is created
    const message = {
      type: CRX_DEEP_RESEARCH_FILE_TRANSFER_PORT_CREATE,
      portId,
    };
    chrome.runtime.sendMessage(message);

    return port;
  }

  /**
   * Gets an existing port by ID.
   */
  getPort(portId: string): FileTransferPort | undefined {
    const port = this._activePorts.get(portId);

    return port;
  }

  /**
   * Closes and removes a port.
   */
  closePort(portId: string): void {
    const port = this._activePorts.get(portId);
    if (port) {
      port.close();
      this._activePorts.delete(portId);
    }
  }

  /**
   * Closes all active ports.
   */
  closeAllPorts(): void {
    for (const [, port] of this._activePorts) {
      port.close();
    }
    this._activePorts.clear();
  }

  /**
   * Internal handler for when a port is closed.
   */
  private _onPortClosed(portId: string): void {
    this._activePorts.delete(portId);
  }

  /**
   * Gets the number of active ports.
   */
  get activePortCount(): number {
    return this._activePorts.size;
  }
}

/**
 * Individual file transfer port for communicating with the side panel.
 */
export class FileTransferPort {
  private readonly _portId: string;
  private readonly _onClosed: (portId: string) => void;
  private readonly _eventListeners = new Set<(event: FileTransferEvent) => void>();
  private readonly _commandListeners = new Set<(command: FileTransferCommand) => void>();
  private readonly _activeTransfers = new Map<string, ActiveTransfer>();
  // Track incoming transfers from side panel to content
  private readonly _incomingTransfers = new Map<string, IncomingTransfer>();
  private _isOpen = true;

  constructor(portId: string, onClosed: (portId: string) => void) {
    this._portId = portId;
    this._onClosed = onClosed;
    this._setupMessageListener();
  }

  /**
   * Gets the unique port ID.
   */
  get portId(): string {
    return this._portId;
  }

  /**
   * Checks if the port is still open.
   */
  get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Sends an event to the side panel.
   */
  sendEvent(event: FileTransferEvent): void {
    if (!this._isOpen) {
      console.error('[FileTransferPort.sendEvent] Cannot send event - port is closed', {
        portId: this._portId,
        eventType: event.type,
      });
      throw new Error('Port is closed');
    }

    const message = {
      type: 'crx-deep-research:fileTransferPortEvent',
      portId: this._portId,
      event,
    };

    chrome.runtime.sendMessage(message);
  }

  /**
   * Adds a listener for events from the side panel.
   */
  onEvent(listener: (event: FileTransferEvent) => void): void {
    this._eventListeners.add(listener);
  }

  /**
   * Removes an event listener.
   */
  offEvent(listener: (event: FileTransferEvent) => void): void {
    this._eventListeners.delete(listener);
  }

  /**
   * Adds a listener for commands from the side panel.
   */
  onCommand(listener: (command: FileTransferCommand) => void): void {
    this._commandListeners.add(listener);
  }

  /**
   * Removes a command listener.
   */
  offCommand(listener: (command: FileTransferCommand) => void): void {
    this._commandListeners.delete(listener);
  }

  /**
   * Transfers a file by reading it from a file input element or blob.
   */
  async transferFile(file: File): Promise<string> {
    if (!this._isOpen) {
      throw new Error('Port is closed');
    }

    const transferId = generateUuid();
    const chunkSize = 64 * 1024; // 64KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);

    const request: FileTransferRequest = {
      transferId,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      chunks: totalChunks,
    };

    // Start the transfer
    this.sendEvent({ type: 'transfer-start', request });

    // Track the transfer
    const transfer = new ActiveTransfer(transferId, totalChunks, file.size);
    this._activeTransfers.set(transferId, transfer);

    try {
      // Send chunks
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const arrayBuffer = await chunk.arrayBuffer();

        const fileChunk: FileChunk = {
          transferId,
          chunkIndex,
          totalChunks,
          data: arrayBuffer,
        };

        this.sendEvent({ type: 'chunk', chunk: fileChunk });

        // Update progress
        transfer.addChunk(arrayBuffer.byteLength);
        this.sendEvent({
          type: 'progress',
          progress: {
            transferId,
            chunksReceived: transfer.chunksReceived,
            totalChunks,
            bytesReceived: transfer.bytesReceived,
            totalBytes: file.size,
          },
        });
      }

      // Complete the transfer
      this.sendEvent({
        type: 'transfer-complete',
        result: { transferId, success: true },
      });

      return transferId;
    } catch (error) {
      this.sendEvent({
        type: 'transfer-complete',
        result: {
          transferId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    } finally {
      this._activeTransfers.delete(transferId);
    }
  }

  /**
   * Transfers a buffer (like an image or binary data).
   */
  async transferBuffer(
    buffer: ArrayBuffer,
    bufferType: 'image' | 'binary' | 'text',
    mimeType?: string,
  ): Promise<string> {
    if (!this._isOpen) {
      throw new Error('Port is closed');
    }

    const transferId = generateUuid();
    const chunkSize = 64 * 1024; // 64KB chunks
    const totalChunks = Math.ceil(buffer.byteLength / chunkSize);

    const request: BufferTransferRequest = {
      transferId,
      bufferType,
      mimeType,
      size: buffer.byteLength,
      chunks: totalChunks,
    };

    // Start the transfer
    this.sendEvent({ type: 'transfer-start', request });

    // Track the transfer
    const transfer = new ActiveTransfer(transferId, totalChunks, buffer.byteLength);
    this._activeTransfers.set(transferId, transfer);

    try {
      // Send chunks
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * chunkSize;
        const end = Math.min(start + chunkSize, buffer.byteLength);
        const chunkData = buffer.slice(start, end);

        const fileChunk: FileChunk = {
          transferId,
          chunkIndex,
          totalChunks,
          data: chunkData,
        };

        this.sendEvent({ type: 'chunk', chunk: fileChunk });

        // Update progress
        transfer.addChunk(chunkData.byteLength);
        this.sendEvent({
          type: 'progress',
          progress: {
            transferId,
            chunksReceived: transfer.chunksReceived,
            totalChunks,
            bytesReceived: transfer.bytesReceived,
            totalBytes: buffer.byteLength,
          },
        });
      }

      // Complete the transfer
      this.sendEvent({
        type: 'transfer-complete',
        result: { transferId, success: true },
      });

      return transferId;
    } catch (error) {
      this.sendEvent({
        type: 'transfer-complete',
        result: {
          transferId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      throw error;
    } finally {
      this._activeTransfers.delete(transferId);
    }
  }

  /**
   * Closes the port.
   */
  close(): void {
    if (!this._isOpen) {
      return;
    }

    this._isOpen = false;

    // Cancel all active transfers
    for (const [transferId] of this._activeTransfers) {
      this.sendEvent({
        type: 'error',
        transferId,
        error: 'Port closed',
      });
    }
    this._activeTransfers.clear();

    // Clear listeners
    this._eventListeners.clear();
    this._commandListeners.clear();

    // Notify manager
    this._onClosed(this._portId);
  }

  /**
   * Sets up the message listener for commands from the side panel.
   */
  private _setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (
        message.type === 'crx-deep-research:fileTransferPortCommand' &&
        message.portId === this._portId
      ) {
        const command = this._deserializeCommand(message.command as FileTransferCommand);

        // Handle specific commands
        this._handleCommand(command);

        // Notify listeners
        for (const listener of this._commandListeners) {
          try {
            listener(command);
          } catch (error) {
            console.error('[FileTransferPort.onMessage] Error in command listener:', error);
          }
        }

        sendResponse({ success: true });
        return true;
      }
      return false;
    });
  }

  /**
   * Deserializes commands to handle ArrayBuffer data that was serialized for Chrome messaging
   */
  private _deserializeCommand(command: FileTransferCommand): FileTransferCommand {
    if (command.type === 'receive-file-chunk' && Array.isArray(command.chunk.data)) {
      // Convert array back to ArrayBuffer
      const uint8Array = new Uint8Array(command.chunk.data as number[]);
      return {
        ...command,
        chunk: {
          ...command.chunk,
          data: uint8Array.buffer,
        },
      };
    }
    return command;
  }

  /**
   * Handles specific commands from the side panel.
   */
  private async _handleCommand(command: FileTransferCommand): Promise<void> {
    try {
      switch (command.type) {
        case 'request-file':
          await this._handleFileRequest(command.selector, command.attribute);
          break;
        case 'request-image':
          await this._handleImageRequest(command.selector, command.format);
          break;
        case 'request-buffer':
          await this._handleBufferRequest(command.selector, command.bufferType);
          break;
        case 'cancel-transfer':
          this._handleCancelTransfer(command.transferId);
          break;
        case 'receive-file-start':
          this._handleIncomingStart(command.meta);
          break;
        case 'receive-file-chunk':
          this._handleIncomingChunk(command.chunk);
          break;
        case 'receive-file-complete':
          this._handleIncomingComplete(command.transferId);
          break;
      }
    } catch (error) {
      console.error('[FileTransferPort._handleCommand] Error processing command', {
        portId: this._portId,
        commandType: command.type,
        error,
      });

      this.sendEvent({
        type: 'error',
        transferId: 'command-error',
        error: error instanceof Error ? error.message : 'Command failed',
      });
    }
  }

  /**
   * Handles file requests from the side panel.
   */
  private async _handleFileRequest(selector: string, attribute?: string): Promise<void> {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    if (element instanceof HTMLInputElement && element.type === 'file' && element.files?.length) {
      // File input element
      const file = element.files[0];
      await this.transferFile(file);
    } else if (attribute) {
      // Get file from attribute (like href, src, etc.)
      const url = element.getAttribute(attribute);
      if (!url) {
        throw new Error(`Attribute '${attribute}' not found on element`);
      }

      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], url.split('/').pop() || 'download', { type: blob.type });
      await this.transferFile(file);
    } else {
      throw new Error('Element is not a file input and no attribute specified');
    }
  }

  /**
   * Handles image requests from the side panel.
   */
  private async _handleImageRequest(
    selector: string,
    format: 'blob' | 'dataurl' | 'canvas' = 'blob',
  ): Promise<void> {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    let buffer: ArrayBuffer;
    let mimeType = 'image/png';

    if (element instanceof HTMLImageElement) {
      // Convert image to canvas and then to buffer
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Cannot create canvas context');
      }

      canvas.width = element.naturalWidth || element.width;
      canvas.height = element.naturalHeight || element.height;
      ctx.drawImage(element, 0, 0);

      if (format === 'dataurl') {
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        buffer = Uint8Array.from(atob(base64), c => c.charCodeAt(0)).buffer;
      } else {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(blob =>
            blob ? resolve(blob) : reject(new Error('Canvas to blob failed')),
          );
        });
        buffer = await blob.arrayBuffer();
        mimeType = blob.type;
      }
    } else if (element instanceof HTMLCanvasElement) {
      const blob = await new Promise<Blob>((resolve, reject) => {
        element.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Canvas to blob failed'))));
      });
      buffer = await blob.arrayBuffer();
      mimeType = blob.type;
    } else {
      throw new Error('Element is not an image or canvas');
    }

    await this.transferBuffer(buffer, 'image', mimeType);
  }

  /**
   * Handles buffer requests from the side panel.
   */
  private async _handleBufferRequest(
    selector: string,
    bufferType: 'image' | 'binary' | 'text',
  ): Promise<void> {
    const element = document.querySelector(selector);
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    let buffer: ArrayBuffer;
    let mimeType: string | undefined;

    if (bufferType === 'text') {
      const text = element.textContent || element.innerHTML;
      buffer = new TextEncoder().encode(text).buffer;
      mimeType = 'text/plain';
    } else {
      // For binary or image, try to get from src attribute or similar
      const src = element.getAttribute('src') || element.getAttribute('href');
      if (!src) {
        throw new Error('No src or href attribute found on element');
      }

      const response = await fetch(src);
      buffer = await response.arrayBuffer();
      mimeType = response.headers.get('content-type') || undefined;
    }

    await this.transferBuffer(buffer, bufferType, mimeType);
  }

  /**
   * Handles transfer cancellation.
   */
  private _handleCancelTransfer(transferId: string): void {
    const transfer = this._activeTransfers.get(transferId);
    if (transfer) {
      this._activeTransfers.delete(transferId);
      this.sendEvent({
        type: 'error',
        transferId,
        error: 'Transfer cancelled',
      });
    }
  }

  /**
   * Begin receiving a file/buffer from the side panel.
   */
  private _handleIncomingStart(meta: IncomingFileMeta): void {
    this._incomingTransfers.set(meta.transferId, new IncomingTransfer(meta));
  }

  /**
   * Receive one chunk of incoming data.
   */
  private _handleIncomingChunk(chunk: FileChunk): void {
    const incoming = this._incomingTransfers.get(chunk.transferId);
    if (!incoming) {
      console.error('[FileTransferPort._handleIncomingChunk] No incoming transfer found', {
        portId: this._portId,
        transferId: chunk.transferId,
        availableTransfers: Array.from(this._incomingTransfers.keys()),
      });
      return;
    }

    incoming.addChunk(chunk);
  }

  /**
   * Finalize an incoming transfer and store it for later retrieval.
   */
  private _handleIncomingComplete(transferId: string): void {
    const incoming = this._incomingTransfers.get(transferId);
    if (!incoming) {
      console.error('[FileTransferPort._handleIncomingComplete] No incoming transfer found', {
        portId: this._portId,
        transferId,
        availableTransfers: Array.from(this._incomingTransfers.keys()),
      });
      return;
    }

    incoming.finalize();
  }

  /**
   * Retrieve a completed incoming buffer for a transferId (if available).
   */
  getIncomingBuffer(
    transferId: string,
  ): { buffer: ArrayBuffer; mimeType: string; name: string } | undefined {
    const incoming = this._incomingTransfers.get(transferId);
    if (!incoming || !incoming.isComplete) {
      return undefined;
    }

    const buffer = incoming.getData();
    const result = {
      buffer,
      mimeType: incoming.meta.mimeType,
      name: incoming.meta.filename,
    };

    return result;
  }
}

/**
 * Tracks an active transfer's progress.
 */
class ActiveTransfer {
  readonly transferId: string;
  readonly totalChunks: number;
  readonly totalBytes: number;
  chunksReceived = 0;
  bytesReceived = 0;

  constructor(transferId: string, totalChunks: number, totalBytes: number) {
    this.transferId = transferId;
    this.totalChunks = totalChunks;
    this.totalBytes = totalBytes;
  }

  addChunk(bytes: number): void {
    this.chunksReceived++;
    this.bytesReceived += bytes;
  }

  get isComplete(): boolean {
    return this.chunksReceived >= this.totalChunks;
  }

  get progress(): number {
    return this.totalBytes > 0 ? this.bytesReceived / this.totalBytes : 0;
  }
}

/**
 * Assembles incoming chunks for a side-panel -> content transfer.
 */
class IncomingTransfer {
  readonly meta: IncomingFileMeta;
  private readonly chunks = new Map<number, ArrayBuffer>();
  private complete = false;

  constructor(meta: IncomingFileMeta) {
    this.meta = meta;
  }

  addChunk(chunk: FileChunk): void {
    if (this.complete) {
      console.warn('[IncomingTransfer.addChunk] Attempt to add chunk to completed transfer', {
        transferId: this.meta.transferId,
        chunkIndex: chunk.chunkIndex,
      });
      return;
    }

    // Ensure chunk.data is ArrayBuffer (handle deserialization from number[])
    const arrayBuffer = Array.isArray(chunk.data) ? new Uint8Array(chunk.data).buffer : chunk.data;

    this.chunks.set(chunk.chunkIndex, arrayBuffer);
  }

  finalize(): void {
    this.complete = true;
  }

  get isComplete(): boolean {
    const complete = this.complete && this.chunks.size === this.meta.chunks;
    return complete;
  }

  getData(): ArrayBuffer {
    const totalSize = this.meta.size;
    const out = new Uint8Array(totalSize);
    let offset = 0;

    for (let i = 0; i < this.meta.chunks; i++) {
      const chunk = this.chunks.get(i);
      if (!chunk) {
        throw new Error('Missing chunk ' + i);
      }

      out.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return out.buffer;
  }
}
