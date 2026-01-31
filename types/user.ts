import { UserRole } from "./roles";

export interface User {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  otp?: string | null;
  otpExpires?: number | null;
  addressLine1?: string;
  addressLine2?: string;
  gender?: string;
  bio?: string;
  profilePic?: string;
  profilePicId?: string;
  username?: string;
  postalCode?: string;
  dateOfBirth?: string;
  city?: string;
  state?: string;
  country?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}
