import { User } from "./user";

export interface PaginatedUsersResult {
  users: User[];
  totalCount: number;
  pageCount: number;
}

export interface GetUsersParams {
  pageIndex: number;
  pageSize: number;
  query?: string;
  sort?: { id: string; desc: boolean };
}
