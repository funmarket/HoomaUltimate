import type { HelpRequestImageSource, RequestImageContentType } from "@hooma/contracts/requests";

export interface HelpRequestImageRecord {
  readonly id: string;
  readonly requestId: string;
  readonly source: HelpRequestImageSource;
  readonly objectKey: string | null;
  readonly externalUrl: string | null;
  readonly contentType: RequestImageContentType | null;
  readonly sizeBytes: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface RequestImageRepository {
  prepareUpload(mediaId: string, requestId: string, objectKey: string): Promise<void>;
  replacePreparedUpload(input: {
    readonly mediaId: string;
    readonly requestId: string;
    readonly objectKey: string;
    readonly contentType: RequestImageContentType;
    readonly sizeBytes: number;
  }): Promise<HelpRequestImageRecord>;
  replaceExternalUrl(requestId: string, url: string): Promise<HelpRequestImageRecord>;
  getForRequest(requestId: string): Promise<HelpRequestImageRecord | null>;
  deleteForRequest(requestId: string): Promise<HelpRequestImageRecord | null>;
}
