export type Entity = Record<string, any>;
type EntityKey<T extends Entity> = keyof T;
type SimpleFilterOperator =
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
  | "$endsWithi";

// type ComplexFilterOperator = "$or" | "$and" | "$not";

type SimpleFilterQuery = Partial<Record<SimpleFilterOperator, any>>;

type PaginateByPage = {
  page?: number;
  start?: never;
  pageSize?: number;
  limit?: never;
  withCount?: boolean;
};

type PaginateByOffset = {
  start?: number;
  page?: never;
  limit?: number;
  pageSize?: never;
  withCount?: boolean;
};

type SuccessResponseBody<T> = {
  data: T;
  meta: Record<string, unknown>;
  error: never;
};

type ErrorResponseBody = {
  data: never;
  meta: never;
  error: {
    status: string;
    name: string;
    message: string;
    details: Record<string, unknown>;
  };
};

type ResponseBody<T> = SuccessResponseBody<T> | ErrorResponseBody;

type SortParameter<T extends Entity> = EntityKey<T> | Array<EntityKey<T>>;

type FilterParameter<T extends Entity> = Partial<
  Record<EntityKey<T>, SimpleFilterQuery>
>;

type PopulateParameter<T extends Entity> =
  | "*"
  | Array<EntityKey<T>>
  | Partial<Record<EntityKey<T>, boolean>>;

type FieldsParameter<T extends Entity> = Array<EntityKey<T>>;

type PaginationParameter = PaginateByPage | PaginateByOffset;

type PublicationStateParameter = "live" | "preview";

type GetEntriesResponseBody<T extends Entity> = ResponseBody<
  Array<{
    id: number;
    attributes: { [K in EntityKey<T>]: T[K] };
    meta: Record<string, unknown>;
  }>
>;

type GetEntryBody<T extends Entity> = ResponseBody<{
  id: number;
  attributes: { [K in EntityKey<T>]: T[K] };
  meta: Record<string, unknown>;
}>;

type CreateEntryBody<T extends Entity> = ResponseBody<{
  id: number;
  attributes: { [K in EntityKey<T>]: T[K] };
  meta: Record<string, unknown>;
}>;

type UpdateEntryBody<T extends Entity> = ResponseBody<{
  id: number;
  attributes: { [K in EntityKey<T>]: T[K] };
  meta: Record<string, unknown>;
}>;

type DeleteEntryBody<T extends Entity> = ResponseBody<{
  id: number;
  attributes: { [K in EntityKey<T>]: T[K] };
  meta: Record<string, unknown>;
}>;
