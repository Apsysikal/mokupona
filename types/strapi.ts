type StrapiApiMeta = Record<string, unknown>;

type StrapiApiFilterOperators =
  | "$eq"
  | "$eqi"
  | "$ne"
  | "$lt"
  | "$lte"
  | "$gt"
  | "$gte"
  | "$in"
  | "$notIn"
  | "$contains"
  | "$notContains"
  | "$containsi"
  | "$notContainsi"
  | "$null"
  | "$notNull"
  | "$between"
  | "$startsWith"
  | "$startsWithi"
  | "$endsWith"
  | "$endsWithi"
  | "$or"
  | "$and"
  | "$not";

type StrapiApiError = {
  status: string;
  name: string;
  message: string;
  details: Record<string, unknown>;
};

export type StrapiCollectionType<T> = {
  id: number;
  attributes: T;
  meta: Record<string, unknown>;
};

type KeyOfCollectionType<T extends StrapiCollectionType<T>> = keyof T;

export type StrapiApiUrlParameters<T extends StrapiCollectionType<T>> = {
  sort?: KeyOfCollectionType<T> | Array<KeyOfCollectionType<T>>;
  filters?: Record<
    KeyOfCollectionType<T>,
    Record<StrapiApiFilterOperators, any>
  >;
  populate?: KeyOfCollectionType<T> | Array<KeyOfCollectionType<T>>;
  fields?: KeyOfCollectionType<T> | Array<KeyOfCollectionType<T>>;
  pagination?: Record<"page" | "pageSize" | "withCount", number | boolean>;
  publicationState?: "live" | "preview";
  locale?: string | string[];
};

export type StrapiApiResponse<T> = {
  data: StrapiCollectionType<T>;
  meta: StrapiApiMeta;
  error?: StrapiApiError;
};

export type StrapiApiResponseMultiple<T> = {
  data: Array<StrapiCollectionType<T>>;
  meta: StrapiApiMeta;
  error?: StrapiApiError;
};

export type StrapiComponentAddressField = {
  street: string;
  number?: string;
  zipcode: string;
  city: string;
};

export type StrapiMediaField = {
  id: number;
  attributes: {
    alternativeText: string;
    url: string;
    formats: {
      large: {
        url: string;
      };
      small: {
        url: string;
      };
      medium: {
        url: string;
      };
      thumbnail: {
        url: string;
      };
    };
  };
};
