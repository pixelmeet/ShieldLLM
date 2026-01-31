import { User } from "./user";
import { AdminAnalytics } from "./admin";
import { PaginatedUsersResult, GetUsersParams } from "./pagination";

export interface DatabaseAdapter {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(user: Omit<User, "otp" | "otpExpires">): Promise<User | null>;
  updateUser(id: string, data: Partial<User>): Promise<User | null>;
  deleteUserById(id: string): Promise<boolean>;
  getAdminAnalytics(): Promise<AdminAnalytics>;
  getPaginatedUsers(params: GetUsersParams): Promise<PaginatedUsersResult>;
}
