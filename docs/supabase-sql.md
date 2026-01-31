# Supabase SQL Setup - Simple Database Setup

Run these SQL commands in your Supabase SQL Editor in order. This will set up the complete database for your Next.js app.

## 1) Create Role Enum
```sql
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');
```

## 2) Create Users Table
```sql
CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "fullName" text NOT NULL,
  email text NOT NULL UNIQUE,
  "passwordHash" text NOT NULL,
  role app_role NOT NULL DEFAULT 'user',

  otp text,
  "otpExpires" bigint,

  -- All possible user profile fields (enable/disable in user-schema.ts)
  username text,
  "profilePic" text,
  "profilePicId" text,
  "addressLine1" text,
  "addressLine2" text,
  gender text,
  bio text,
  "postalCode" text,
  "dateOfBirth" date,
  city text,
  state text,
  country text,
  is_active boolean,

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
```

## 3) Create Updated-At Trigger
```sql
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

## 4) Enable Row-Level Security
```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
```

## 5) Create RLS Policies
```sql
-- Admin can do everything
CREATE POLICY users_admin_all
ON public.users FOR ALL
USING (auth.jwt() ->> 'role' = 'admin')
WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Moderators can read all users
CREATE POLICY users_moderator_read
ON public.users FOR SELECT
USING ((auth.jwt() ->> 'role') IN ('moderator','admin'));

-- Moderators can update non-admin users
CREATE POLICY users_moderator_update_non_admin
ON public.users FOR UPDATE
USING ((auth.jwt() ->> 'role') IN ('moderator','admin') AND role <> 'admin')
WITH CHECK ((auth.jwt() ->> 'role') IN ('moderator','admin') AND role <> 'admin');

-- Users can read their own data
CREATE POLICY users_user_read_self
ON public.users FOR SELECT
USING (id::text = auth.jwt() ->> 'userId');

-- Users can update their own data (but not change role)
CREATE POLICY users_user_update_self
ON public.users FOR UPDATE
USING (id::text = auth.jwt() ->> 'userId')
WITH CHECK (
  id::text = auth.jwt() ->> 'userId'
  AND role = 'user'
);
```

## 6) Add Constraints
```sql
-- Create unique indexes for case-insensitive email and username
CREATE UNIQUE INDEX users_email_lower_unique ON public.users (lower(email));
CREATE UNIQUE INDEX users_username_unique ON public.users (lower(username));
```

That's it! Your database is now ready to use with your Next.js app.
