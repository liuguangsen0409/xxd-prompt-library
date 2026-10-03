export interface StylePreviewImage {
  src: string;
  position?: string;
  width?: number;
  height?: number;
}

export interface StylePreview {
  path: string;
  title: string;
  description: string;
  number: number;
  images: StylePreviewImage[];
  fallbackImage?: string;
}

export interface StylePreviewPage {
  items: StylePreview[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}
