import {
  ContainerURL,
  Aborter,
  BlockBlobURL,
  IUploadStreamToBlockBlobOptions,
  BlobUploadCommonResponse
} from '@azure/storage-blob';
import { Storage, Component, File, Index, ComponentTree, ComponentGetter, Maybe } from '@dynamico/driver';
import intoStream from 'into-stream';
import { Readable } from 'stream';
import { FailedIndexUpsert } from './errors';

const ONE_MEGABYTE = 1024 * 1024;
const FOUR_MEGABYTES = 4 * ONE_MEGABYTE;
type Uploader = (
  aborter: Aborter,
  stream: Readable,
  blockBlobURL: BlockBlobURL,
  bufferSize: number,
  maxBuffers: number,
  options?: IUploadStreamToBlockBlobOptions
) => Promise<BlobUploadCommonResponse>;

interface AzureBlobStorageOptions {
  container: ContainerURL;
  uploadStreamToBlockBlob: Uploader;
  indexBlobName?: string;
}

export class AzureBlobStorage implements Storage {
  private container: ContainerURL;
  private indexBlobUrl: BlockBlobURL;
  private aborter: Aborter;
  private uploader: Uploader;

  constructor({ container, uploadStreamToBlockBlob, indexBlobName = 'index.json' }: AzureBlobStorageOptions) {
    this.container = container;
    this.indexBlobUrl = BlockBlobURL.fromContainerURL(this.container, indexBlobName);
    this.aborter = Aborter.timeout(30 * 60000);
    this.uploader = uploadStreamToBlockBlob;
  }

  private async downloadBlobAsString(blobUrl: BlockBlobURL): Promise<string> {
    const response = await blobUrl.download(this.aborter, 0);
    return (response.readableStreamBody as NodeJS.ReadableStream).read(response.contentLength).toString();
  }

  async getIndex(): Promise<Index> {
    try {
      return JSON.parse(await this.downloadBlobAsString(this.indexBlobUrl));
    } catch (error) {
      if (error.statusCode === 404) return {};
      throw error;
    }
  }

  async upsertIndex(index: Index) {
    try {
      const currentIndex = await this.getIndex();
      const updatedIndex = JSON.stringify({ ...currentIndex, ...index });
      const indexStream = intoStream(updatedIndex);
      await this.uploader(this.aborter, indexStream, this.indexBlobUrl, updatedIndex.length, 10);
    } catch (error) {
      throw new FailedIndexUpsert(error, index);
    }
  }
  async getComponentTree(): Promise<ComponentTree> {
    let listBlobsResult = await this.container.listBlobFlatSegment(this.aborter);
    let blobs = listBlobsResult.segment.blobItems.map(({ name }) => name);
    while (listBlobsResult.nextMarker) {
      listBlobsResult = await this.container.listBlobFlatSegment(this.aborter, listBlobsResult.nextMarker);
      blobs = [...blobs, ...listBlobsResult.segment.blobItems.map(({ name }) => name)];
    }

    return blobs
      .filter(b => b.endsWith('package.json'))
      .reduce((soFar: ComponentTree, current: string) => {
        const [name, componentVersion] = current.split('/');
        return {
          ...soFar,
          [name]: {
            ...soFar[name],
            [componentVersion]: async () => {
              const blobUrl = BlockBlobURL.fromContainerURL(this.container, current);
              return JSON.parse(await this.downloadBlobAsString(blobUrl)).peerDependencies;
            }
          }
        };
      }, {});
  }
  async getComponent(name: string, version: string): Promise<Maybe<ComponentGetter>> {
    const basePath = `${name.toLowerCase()}/${version}`;
    const packageJsonUrl = BlockBlobURL.fromContainerURL(this.container, `${basePath}/package.json`);
    const { main } = JSON.parse(await this.downloadBlobAsString(packageJsonUrl));

    return {
      name,
      version,
      getCode: async () => {
        const codeUrl = BlockBlobURL.fromContainerURL(this.container, `${basePath}/${main}`);
        return await this.downloadBlobAsString(codeUrl);
      }
    };
  }
  async saveComponent(component: Component, files: File[]): Promise<void> {
    if (!files.length) return;
    if (!files.some(f => f.name === 'package.json')) throw new Error('Missing package.json file');
    const basePath = `${component.name}/${component.version}`;

    await Promise.all(
      files.map(f =>
        this.uploader(
          this.aborter,
          f.stream as Readable,
          BlockBlobURL.fromContainerURL(this.container, `${basePath}/${f.name}`),
          FOUR_MEGABYTES,
          5
        )
      )
    );
  }
}
