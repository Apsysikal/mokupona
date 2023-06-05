type StrapiApiUrlParameters = {
  sort?: string;
  filters?: string | object;
  populate?: string | object;
  fields?: string | string[];
  pagination?: string | object;
  publicationState?: "live" | "preview";
  locale: string | string[];
};

type StrapiApiResponse<T> = {
  data: T;
  meta: object;
  error?: object;
};

type StrapiComponentAddressField = {
  id: number;
  street: string;
  number?: string;
  zipcode: string;
  city: string;
};

type StrapiMediaField = {
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
