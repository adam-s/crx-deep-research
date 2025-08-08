/**
 * Example usage of the File Transfer Port system between content script and side panel.
 * This demonstrates how to create ports, transfer files and buffers, and handle the communication.
 */

import { Frame } from './frame';
import { FileTransferPortController } from './fileTransferPortController';

/**
 * Example: Setting up file transfer from side panel perspective
 */
export class FileTransferExample {
  private readonly _frame: Frame;
  private readonly _portController: FileTransferPortController;

  constructor(frame: Frame) {
    this._frame = frame;
    this._portController = new FileTransferPortController();
    this._setupPortHandling();
  }

  /**
   * Example: Request a file from a file input element
   */
  async requestFileFromInput(inputSelector: string): Promise<ArrayBuffer | undefined> {
    try {
      // 1. Create a file transfer port in the content script
      const portId = await this._frame.createFileTransferPort();
      console.log('📦 Created file transfer port:', portId);

      // 2. Wait for the port to be available
      const port = this._portController.getPort(portId);
      if (!port) {
        throw new Error('Port not found after creation');
      }

      // 3. Request the file from the content script
      const transferId = await port.requestFile(inputSelector);
      console.log('📤 Requested file transfer:', transferId);

      // 4. Get the transferred data
      const data = port.getTransferData(transferId);
      console.log('📥 Received file data:', data?.byteLength, 'bytes');

      return data;
    } catch (error) {
      console.error('❌ File transfer failed:', error);
      throw error;
    }
  }

  /**
   * Example: Request an image from an img element and convert to blob
   */
  async requestImageAsBlob(imageSelector: string): Promise<Blob | undefined> {
    try {
      // 1. Create a file transfer port
      const portId = await this._frame.createFileTransferPort();

      // 2. Get the port connection
      const port = this._portController.getPort(portId);
      if (!port) {
        throw new Error('Port not found after creation');
      }

      // 3. Request the image
      const transferId = await port.requestImage(imageSelector, 'blob');

      // 4. Get the data and convert to blob
      const data = port.getTransferData(transferId);
      if (data) {
        return new Blob([data], { type: 'image/png' });
      }

      return undefined;
    } catch (error) {
      console.error('❌ Image transfer failed:', error);
      throw error;
    }
  }

  /**
   * Example: Request text content from an element
   */
  async requestTextContent(selector: string): Promise<string | undefined> {
    try {
      // 1. Create a file transfer port
      const portId = await this._frame.createFileTransferPort();

      // 2. Get the port connection
      const port = this._portController.getPort(portId);
      if (!port) {
        throw new Error('Port not found after creation');
      }

      // 3. Request the text buffer
      const transferId = await port.requestBuffer(selector, 'text');

      // 4. Get the data and convert to string
      const data = port.getTransferData(transferId);
      if (data) {
        return new TextDecoder().decode(data);
      }

      return undefined;
    } catch (error) {
      console.error('❌ Text transfer failed:', error);
      throw error;
    }
  }

  /**
   * Example: Monitor transfer progress
   */
  async requestFileWithProgress(selector: string): Promise<ArrayBuffer | undefined> {
    try {
      const portId = await this._frame.createFileTransferPort();
      const port = this._portController.getPort(portId);
      if (!port) {
        throw new Error('Port not found after creation');
      }

      // Set up progress monitoring
      const progressDisposable = port.onProgress(progress => {
        const percent = Math.round((progress.bytesReceived / progress.totalBytes) * 100);
        console.log(
          `📊 Transfer progress: ${percent}% (${progress.chunksReceived}/${progress.totalChunks} chunks)`,
        );
      });

      try {
        const transferId = await port.requestFile(selector);
        const data = port.getTransferData(transferId);
        return data;
      } finally {
        progressDisposable.dispose();
      }
    } catch (error) {
      console.error('❌ File transfer with progress failed:', error);
      throw error;
    }
  }

  /**
   * Sets up event handling for the port controller
   */
  private _setupPortHandling(): void {
    // Handle new port creation
    this._portController.onPortCreated(port => {
      console.log('🔗 New file transfer port created:', port.portId);

      // Set up event listeners for this port
      port.onTransferStart(request => {
        if ('filename' in request) {
          console.log('📤 File transfer started:', request.filename, `(${request.size} bytes)`);
        } else {
          console.log('📤 Buffer transfer started:', request.bufferType, `(${request.size} bytes)`);
        }
      });

      port.onTransferComplete(result => {
        if (result.success) {
          console.log('✅ Transfer completed:', result.transferId);
        } else {
          console.log('❌ Transfer failed:', result.transferId, result.error);
        }
      });

      port.onError(error => {
        console.log('❌ Transfer error:', error.transferId, error.error);
      });
    });

    // Handle port closure
    this._portController.onPortClosed(portId => {
      console.log('🔌 File transfer port closed:', portId);
    });
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this._portController.dispose();
  }
}

/**
 * Example usage in side panel:
 *
 * ```typescript
 * // Initialize with a frame
 * const fileTransfer = new FileTransferExample(frame);
 *
 * // Request a file from a file input
 * const fileData = await fileTransfer.requestFileFromInput('#file-upload');
 *
 * // Request an image
 * const imageBlob = await fileTransfer.requestImageAsBlob('#main-image');
 *
 * // Request text content
 * const textContent = await fileTransfer.requestTextContent('#article-content');
 *
 * // Monitor progress
 * const largeFileData = await fileTransfer.requestFileWithProgress('#large-file-input');
 * ```
 */
