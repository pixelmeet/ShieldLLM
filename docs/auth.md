# Customizable Authentication System

This document provides a comprehensive guide to customizing the authentication system in this Next.js template. The system is designed to be highly modular and configurable, allowing you to easily add, remove, or modify authentication features.

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Authentication Files](#core-authentication-files)
3. [Role-Based Access Control](#role-based-access-control)
4. [User Profile Fields](#user-profile-fields)
5. [Database Configuration](#database-configuration)
6. [Customization Examples](#customization-examples)
7. [File Upload System](#file-upload-system)
8. [Location System](#location-system)

## System Overview

The authentication system consists of several key components:

- **JWT-based authentication** with HTTP-only cookies
- **Role-based access control** (RBAC) with hierarchical permissions
- **Dynamic user profile fields** that can be enabled/disabled
- **File upload system** with Cloudinary integration
- **Location-based dropdowns** for countries, states, and cities
- **Middleware-based route protection**

## Core Authentication Files

### 1. Authentication Actions (`app/actions/auth.ts`)

**Purpose**: Server actions for authentication operations

**Key Functions**:
- `getCurrentUserAction()`: Gets current authenticated user
- `logoutAction()`: Logs out the current user

**Customization**:
- Modify user data returned by `getCurrentUserAction()` by changing the destructuring in line 35
- Add new authentication actions as needed

### 2. User Actions (`app/actions/user.ts`)

**Purpose**: Server actions for user-specific operations

**Key Functions**:
- `updateUserNameAction()`: Updates user's full name
- `updateUserExtrasAction()`: Updates dynamic user fields
- `deleteUserAction()`: Deletes user account

**Customization**:
- Add new user operations by creating additional server actions
- Modify validation logic in existing actions

### 3. Admin Actions (`app/actions/admin.ts`)

**Purpose**: Server actions for admin operations

**Key Functions**:
- `getAdminAnalyticsAction()`: Gets analytics data
- `createAdminUserAction()`: Creates new users (admin only)
- `updateAdminUserAction()`: Updates user data (admin only)

**Customization**:
- Add new admin operations
- Modify analytics queries to include different metrics

## Role-Based Access Control

### Role Configuration (`types/roles.ts`)

**Purpose**: Central configuration for all roles and permissions

**Key Components**:
```typescript
export const ROLE_DEFINITIONS = {
  admin: {
    level: 3,
    displayName: "Admin",
    description: "Full system access",
    canAccess: ["admin", "moderator", "user"] as const,
  },
  moderator: {
    level: 2,
    displayName: "Moderator", 
    description: "Content moderation and user management",
    canAccess: ["moderator", "user"] as const,
  },
  user: {
    level: 1,
    displayName: "User",
    description: "Basic user access", 
    canAccess: ["user"] as const,
  },
} as const;
```

**To Add a New Role**:
1. Add the role to `ROLE_DEFINITIONS`
2. Update the database enum (see [Database Configuration](#database-configuration))
3. The system will automatically generate types and utilities

**To Remove a Role**:
1. Remove from `ROLE_DEFINITIONS`
2. Update database enum
3. Remove any role-specific pages/routes

### Middleware (`middleware.ts`)

**Purpose**: Protects routes based on user roles

**Protected Routes**:
- `/admin/*` - Admin only
- `/moderator/*` - Moderator and Admin
- `/user` - All authenticated users

**Customization**:
- Add new protected routes by modifying the `matcher` array
- Add new role checks in the middleware logic

## User Profile Fields

### User Schema Configuration (`types/user-schema.ts`)

**Purpose**: Defines all possible user profile fields and their properties

**Key Components**:
```typescript
export const USER_FIELD_DEFS: UserFieldDef[] = [
  // Comment/uncomment fields to enable/disable them
  { name: "addressLine1", label: "Address Line 1", ui: "textarea", ... },
  { name: "gender", label: "Gender", ui: "select", options: [...], ... },
  // ... more fields
];
```

**Field Properties**:
- `name`: Database field name
- `label`: Display label
- `ui`: UI component type (`text`, `textarea`, `select`, `date`, `url`, `checkbox`, `file`)
- `options`: Options for select fields
- `required`: Whether field is required
- `placeholder`: Placeholder text
- `contexts`: Where field appears (`signup`, `profile`)
- `editableInProfile`: Whether field can be edited on profile page
- `dependsOn`: For dependent dropdowns (e.g., state depends on country)

**To Enable/Disable Fields**:
1. **Enable**: Uncomment the field definition
2. **Disable**: Comment out the field definition
3. **Modify**: Change properties like `label`, `placeholder`, `options`

**Example - Enable Gender Field**:
```typescript
// Change from:
// { name: "gender", label: "Gender", ui: "select", ... },

// To:
{ name: "gender", label: "Gender", ui: "select", ... },
```

### User Type Definition (`types/user.ts`)

**Purpose**: TypeScript interface for user data

**Customization**:
- Add new fields to the `User` interface when enabling new profile fields
- Fields should match the database schema

### User Components (`components/user/`)

**Purpose**: Reusable user-related components with modular field system

**Components**:
- `UserInfoCard`: Complete user profile card with form, display, and actions
- `fields/`: Individual field components for each UI type
  - `BaseField`: Base wrapper for all form fields
  - `TextField`: Text input field
  - `TextareaField`: Textarea field
  - `DateField`: Date input field
  - `UrlField`: URL input field
  - `SelectField`: Select dropdown field
  - `FileField`: File upload field
  - `FieldFactory`: Renders appropriate field based on field definition
- `index.ts`: Clean exports for easy importing

**Usage**:
```typescript
import { UserInfoCard, TextField, SelectField } from "@/components/user";

// Use the complete card
<UserInfoCard 
  user={user} 
  onUserUpdate={handleUserUpdate}
  variants={cardVariants}
/>

// Or use individual field components
<TextField
  name="username"
  control={control}
  label="Username"
  placeholder="Enter username"
/>
```

**Customization**:
- Modify individual field components to change specific field behavior
- Add new field types by creating new components in `fields/`
- Update `FieldFactory` to handle new field types
- Modify `UserInfoCard` to change the overall profile interface
- Add new user-related components to the `/components/user/` directory

### Admin Components (`components/admin/`)

**Purpose**: Admin interface components for user management

**Components**:
- `users/create-user-dialog.tsx`: Dialog for creating new users with all user fields
- `users/edit-user-dialog.tsx`: Dialog for editing existing users with all user fields
- `users/delete-user-dialog.tsx`: Dialog for deleting users

**Features**:
- **Dynamic Field Support**: All admin components automatically support all user fields defined in the schema
- **Role-Based Access**: Components respect role permissions and allowed roles
- **Field Validation**: Uses the same validation schema as user components
- **Dependent Dropdowns**: Supports country/state/city dependent selections
- **File Uploads**: Supports profile picture uploads in create/edit dialogs

**Usage**:
```typescript
import { CreateUserDialog, EditUserDialog } from "@/components/admin/users";

<CreateUserDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  allowedRoles={["user", "moderator"]} // Optional: restrict roles
/>

<EditUserDialog
  user={selectedUser}
  onOpenChange={setIsOpen}
  allowedRoles={["user", "moderator"]} // Optional: restrict roles
/>
```

**Customization**:
- Admin components automatically adapt to schema changes
- Modify field behavior by updating the user field components
- Add new field types by extending the user schema
- Customize role restrictions by passing `allowedRoles` prop

## Database Configuration

### Supabase Setup (`docs/supabase-sql.md`)

**Purpose**: SQL commands to set up the database

**Key Components**:
1. **Role Enum**: `CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');`
2. **Users Table**: Contains all user fields
3. **RLS Policies**: Row-level security for data access
4. **Triggers**: Auto-update timestamps

**To Add New Profile Fields**:
1. Add column to the `CREATE TABLE public.users` statement
2. Update the `User` interface in `types/user.ts`
3. Add field definition to `USER_FIELD_DEFS` in `types/user-schema.ts`

**Example - Add Phone Number Field**:
```sql
-- In CREATE TABLE statement:
"phoneNumber" text,

-- In types/user.ts:
phoneNumber?: string;

-- In types/user-schema.ts:
{ name: "phoneNumber", label: "Phone Number", ui: "text", placeholder: "+1 (555) 123-4567", contexts: ["signup", "profile"], editableInProfile: true },
```

## Customization Examples

### Example 1: Add a New Role "Editor"

1. **Update Role Definitions** (`types/roles.ts`):
```typescript
export const ROLE_DEFINITIONS = {
  admin: { level: 4, displayName: "Admin", ... },
  editor: { 
    level: 3, 
    displayName: "Editor", 
    description: "Content editing access",
    canAccess: ["editor", "moderator", "user"] as const,
  },
  moderator: { level: 2, displayName: "Moderator", ... },
  user: { level: 1, displayName: "User", ... },
} as const;
```

2. **Update Database** (`docs/supabase-sql.md`):
```sql
CREATE TYPE app_role AS ENUM ('admin', 'editor', 'moderator', 'user');
```

3. **Create Editor Page** (`app/editor/page.tsx`):
```typescript
// Create new page with editor-specific functionality
```

4. **Update Middleware** (`middleware.ts`):
```typescript
// Add editor route protection
```

### Example 2: Enable Profile Picture Upload

1. **Uncomment in User Schema** (`types/user-schema.ts`):
```typescript
{ name: "profilePic", label: "Profile Picture", ui: "file", contexts: ["profile"], editableInProfile: true },
```

2. **Ensure Cloudinary is Configured**:
- Add Cloudinary credentials to `.env`
- Verify `lib/cloudinary.ts` is properly configured

3. **Database Field Already Exists**:
- `profilePic` and `profilePicId` fields are already in the database schema

### Example 3: Add Custom Validation

1. **Modify User Schema** (`types/user-schema.ts`):
```typescript
{ 
  name: "phoneNumber", 
  label: "Phone Number", 
  ui: "text", 
  required: true,
  placeholder: "+1 (555) 123-4567",
  contexts: ["signup", "profile"],
  editableInProfile: true 
},
```

2. **Add Validation in Zod Schema**:
```typescript
// In buildUserExtraZodShape function:
case "text":
  if (f.name === "phoneNumber") {
    schema = z.string().regex(/^\+?[\d\s\-\(\)]+$/, "Invalid phone number format");
  } else {
    schema = z.string().min(f.required ? 1 : 0).optional();
  }
  break;
```

## File Upload System

### Cloudinary Integration (`lib/cloudinary.ts`)

**Purpose**: Configures Cloudinary SDK for file uploads

**API Endpoints**:
- `POST /api/files/upload` - Upload files
- `POST /api/files/delete` - Delete single file
- `POST /api/files/delete-folder` - Delete entire folder

**Configuration**:
1. Add Cloudinary credentials to `.env`:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

2. Files are automatically uploaded to specified folders
3. Profile pictures are stored in `users/profilePics/` folder

**Customization**:
- Modify upload folder structure in API routes
- Add file type restrictions
- Implement file size limits (currently 2MB for profile pictures)

## Location System

### Location Data Files

**Files**:
- `constants/locations/countries.ts` - List of countries
- `constants/locations/states.ts` - States/provinces by country
- `constants/locations/cities.ts` - Cities by state

**Usage**:
- Countries, states, and cities are configured as dependent dropdowns
- States depend on selected country
- Cities depend on selected state

**To Add New Locations**:
1. Add to the appropriate constant file
2. Use the existing format: `{ code: "XX", name: "Location Name", ... }`

**To Enable Location Fields**:
1. Uncomment in `types/user-schema.ts`:
```typescript
{ name: "country", label: "Country", ui: "select", options: getCountries().map(c => ({ label: c.name, value: c.code })), contexts: ["profile"], editableInProfile: true },
{ name: "state", label: "State/Province", ui: "select", dependsOn: "country", contexts: ["profile"], editableInProfile: true },
{ name: "city", label: "City", ui: "select", dependsOn: "state", contexts: ["profile"], editableInProfile: true },
```

## Common Customization Tasks

### Remove Authentication Entirely

1. **Remove Middleware** (`middleware.ts`):
   - Delete or comment out the entire file

2. **Remove Protected Routes**:
   - Delete `/admin`, `/moderator`, `/user` pages
   - Remove authentication checks from other pages

3. **Remove Auth Actions**:
   - Delete `app/actions/auth.ts`
   - Remove auth-related server actions

4. **Update Database**:
   - Remove RLS policies
   - Simplify users table

### Simplify to Basic User System

1. **Remove Roles** (`types/roles.ts`):
   - Keep only `user` role in `ROLE_DEFINITIONS`

2. **Remove Admin/Moderator Pages**:
   - Delete `/admin` and `/moderator` directories

3. **Simplify User Schema**:
   - Keep only essential fields (name, email, password)

### Add Social Authentication

1. **Install OAuth Provider**:
   - Add NextAuth.js or similar
   - Configure OAuth providers

2. **Update User Schema**:
   - Add OAuth provider fields
   - Modify signup flow

3. **Update Database**:
   - Add OAuth-related columns

## Troubleshooting

### Common Issues

1. **Type Errors After Adding Fields**:
   - Ensure field is added to `User` interface in `types/user.ts`
   - Check that database column exists
   - Verify field definition in `USER_FIELD_DEFS`

2. **Fields Not Appearing**:
   - Check `contexts` property in field definition
   - Ensure field is uncommented in `USER_FIELD_DEFS`
   - Verify form rendering logic

3. **Role Access Issues**:
   - Check `ROLE_DEFINITIONS` configuration
   - Verify middleware route protection
   - Ensure user has correct role in database

4. **File Upload Issues**:
   - Verify Cloudinary credentials
   - Check file size limits
   - Ensure proper folder permissions

### Debug Mode

Enable debug logging by adding to your environment:
```
DEBUG_AUTH=true
```

This will log authentication events and help identify issues.

## Type Safety and Code Quality

### TypeScript Best Practices

The authentication system follows strict TypeScript practices:

1. **Avoid `any` types**: Use specific types like `Record<string, unknown>` for dynamic objects
2. **Proper type casting**: Use `as User` instead of `as any` when you know the type
3. **Unused variable handling**: Prefix unused variables with `_` (e.g., `_unusedVar`)
4. **Next.js Image optimization**: Use `next/image` instead of `<img>` tags for better performance

### Code Quality Features

- **Linting**: ESLint configuration ensures consistent code style
- **Type checking**: Strict TypeScript configuration catches errors early
- **Unused code detection**: Automatic detection of unused imports and variables
- **React best practices**: Proper handling of unescaped entities and image optimization

### Example - Type-Safe User Data Access

```typescript
// ❌ Avoid this:
const value = (user as any)[fieldName];

// ✅ Use this instead:
const value = (user as Record<string, unknown>)[fieldName];

// ✅ Or even better, with proper typing:
const value = (user as User)[fieldName as keyof User];
```

## Best Practices

1. **Always test changes** in a development environment first
2. **Backup your database** before making schema changes
3. **Use TypeScript** to catch type errors early
4. **Follow the existing patterns** when adding new features
5. **Document custom changes** for future reference
6. **Keep the system modular** - don't tightly couple components
7. **Maintain type safety** - avoid `any` types, use proper type casting
8. **Follow React best practices** - use Next.js Image, escape entities properly

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the existing code patterns
3. Ensure all dependencies are properly installed
4. Verify environment variables are set correctly

The authentication system is designed to be flexible and maintainable. Follow the patterns established in the codebase, and you should be able to customize it to meet your specific needs.
