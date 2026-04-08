[BETTER-AUTH.](https://better-auth.com/)

[BETTER-AUTH.](https://better-auth.com/)

Toggle theme

[readme](https://better-auth.com/)

[docs](https://better-auth.com/docs)

products

[enterprise](https://better-auth.com/enterprise)

resources

[sign-in](https://dash.better-auth.com/sign-in)

# Admin

Copy MDOpen in

Admin plugin for Better Auth

The Admin plugin provides a set of administrative functions for user management in your application. It allows administrators to perform various operations such as creating users, managing user roles, banning/unbanning users, impersonating users, and more.

## [Installation](https://better-auth.com/docs/plugins/admin\#installation)

### [Add the plugin to your auth config](https://better-auth.com/docs/plugins/admin\#add-the-plugin-to-your-auth-config)

To use the Admin plugin, add it to your auth config.

auth.ts

```
import { betterAuth } from "better-auth"
import { admin } from "better-auth/plugins"

export const auth = betterAuth({
    // ... other config options
    plugins: [\
        admin()\
    ]
})
```

### [Migrate the database](https://better-auth.com/docs/plugins/admin\#migrate-the-database)

Run the migration or generate the schema to add the necessary fields and tables to the database.

migrategenerate

npm

pnpm

yarn

bun

```
npx auth migrate
```

npm

pnpm

yarn

bun

```
npx auth generate
```

See the [Schema](https://better-auth.com/docs/plugins/admin#schema) section to add the fields manually.

### [Add the client plugin](https://better-auth.com/docs/plugins/admin\#add-the-client-plugin)

Next, include the admin client plugin in your authentication client instance.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { adminClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    plugins: [\
        adminClient()\
    ]
})
```

## [Usage](https://better-auth.com/docs/plugins/admin\#usage)

Before performing any admin operations, the user must be authenticated with an admin account. An admin is any user assigned the `admin` role or any user whose ID is included in the `adminUserIds` option.

### [Create User](https://better-auth.com/docs/plugins/admin\#create-user)

Allows an admin to create a new user.

ClientServer

POST/admin/create-user

```
const { data: newUser, error } = await authClient.admin.createUser({
    email: "user@example.com", // required
    password: "some-secure-password", // required
    name: "James Smith", // required
    role: "user",
    data: { customField: "customValue" },
});
```

Parameters

`email`stringrequired

The email of the user.

`password`stringrequired

The password of the user.

`name`stringrequired

The name of the user.

`role`string \| string\[\]

A string or array of strings representing the roles to apply to the new user.

`data`Record<string, any>

Extra fields for the user. Including custom additional fields.

POST/admin/create-user

```
const newUser = await auth.api.createUser({
    body: {
        email: "user@example.com", // required
        password: "some-secure-password", // required
        name: "James Smith", // required
        role: "user",
        data: { customField: "customValue" },
    },
});
```

Parameters

`email`stringrequired

The email of the user.

`password`stringrequired

The password of the user.

`name`stringrequired

The name of the user.

`role`string \| string\[\]

A string or array of strings representing the roles to apply to the new user.

`data`Record<string, any>

Extra fields for the user. Including custom additional fields.

### [List Users](https://better-auth.com/docs/plugins/admin\#list-users)

Allows an admin to list all users in the database.

ClientServer

GET/admin/list-users

Notes

All properties are optional to configure. By default, 100 rows are returned, you can configure this by the `limit` property.

```
const { data: users, error } = await authClient.admin.listUsers({
    query: {
        searchValue: "some name",
        searchField: "name",
        searchOperator: "contains",
        limit: 100,
        offset: 100,
        sortBy: "name",
        sortDirection: "desc",
        filterField: "email",
        filterValue: "hello@example.com",
        filterOperator: "eq",
    },
});
```

Parameters

`searchValue`string

The value to search for.

`searchField`"email" \| "name"

The field to search in, defaults to email. Can be `email` or `name`.

`searchOperator`"contains" \| "starts\_with" \| "ends\_with"

The operator to use for the search. Can be `contains`, `starts_with` or `ends_with`.

`limit`string \| number

The number of users to return. Defaults to 100.

`offset`string \| number

The offset to start from.

`sortBy`string

The field to sort by.

`sortDirection`"asc" \| "desc"

The direction to sort by.

`filterField`string

The field to filter by.

`filterValue`string \| number \| boolean \| string\[\] \| number\[\]

The value to filter by.

`filterOperator`"eq" \| "ne" \| "lt" \| "lte" \| "gt" \| "gte" \| "in" \| "not\_in" \| "contains" \| "starts\_with" \| "ends\_with"

The operator to use for the filter.

GET/admin/list-users

Notes

All properties are optional to configure. By default, 100 rows are returned, you can configure this by the `limit` property.

```
const users = await auth.api.listUsers({
    query: {
        searchValue: "some name",
        searchField: "name",
        searchOperator: "contains",
        limit: 100,
        offset: 100,
        sortBy: "name",
        sortDirection: "desc",
        filterField: "email",
        filterValue: "hello@example.com",
        filterOperator: "eq",
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`searchValue`string

The value to search for.

`searchField`"email" \| "name"

The field to search in, defaults to email. Can be `email` or `name`.

`searchOperator`"contains" \| "starts\_with" \| "ends\_with"

The operator to use for the search. Can be `contains`, `starts_with` or `ends_with`.

`limit`string \| number

The number of users to return. Defaults to 100.

`offset`string \| number

The offset to start from.

`sortBy`string

The field to sort by.

`sortDirection`"asc" \| "desc"

The direction to sort by.

`filterField`string

The field to filter by.

`filterValue`string \| number \| boolean \| string\[\] \| number\[\]

The value to filter by.

`filterOperator`"eq" \| "ne" \| "lt" \| "lte" \| "gt" \| "gte" \| "in" \| "not\_in" \| "contains" \| "starts\_with" \| "ends\_with"

The operator to use for the filter.

#### [Query Filtering](https://better-auth.com/docs/plugins/admin\#query-filtering)

The `listUsers` function supports various filter operators including `eq`, `contains`, `starts_with`, and `ends_with`.

#### [Pagination](https://better-auth.com/docs/plugins/admin\#pagination)

The `listUsers` function supports pagination by returning metadata alongside the user list. The response includes the following fields:

```
{
  users: User[],   // Array of returned users
  total: number,   // Total number of users after filters and search queries
  limit: number | undefined,   // The limit provided in the query
  offset: number | undefined   // The offset provided in the query
}
```

##### [How to Implement Pagination](https://better-auth.com/docs/plugins/admin\#how-to-implement-pagination)

To paginate results, use the `total`, `limit`, and `offset` values to calculate:

- **Total pages:**`Math.ceil(total / limit)`
- **Current page:**`(offset / limit) + 1`
- **Next page offset:**`Math.min(offset + limit, (total - 1))` – The value to use as `offset` for the next page, ensuring it does not exceed the total number of pages.
- **Previous page offset:**`Math.max(0, offset - limit)` – The value to use as `offset` for the previous page (ensuring it doesn’t go below zero).

##### [Example Usage](https://better-auth.com/docs/plugins/admin\#example-usage)

Fetching the second page with 10 users per page:

```
import { authClient } from "@/lib/auth-client";

const pageSize = 10;
const currentPage = 2;

const users = await authClient.admin.listUsers({
    query: {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize
    }
});

const totalUsers = users.total;
const totalPages = Math.ceil(totalUsers / pageSize)
```

### [Get User](https://better-auth.com/docs/plugins/admin\#get-user)

Fetches a user's information using an id.

ClientServer

GET/admin/get-user

```
const { data, error } = await authClient.admin.getUser({
    query: {
        id: "user-id", // required
    },
});
```

Parameters

`id`stringrequired

The id of the user you want to fetch.

GET/admin/get-user

```
const data = await auth.api.getUser({
    query: {
        id: "user-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`id`stringrequired

The id of the user you want to fetch.

#### [Returns](https://better-auth.com/docs/plugins/admin\#returns)

On success, `data` contains the user object. On failure, `error` is populated by `code`, `message`, `status`, and `statusText`.

```
type GetUserResponse = {
  data: User | null;
  error: null | {
    message: string;
    status: number; //HTTP status code
    statusText: string;
    code: string;
}
```

### [Set User Role](https://better-auth.com/docs/plugins/admin\#set-user-role)

Changes the role of a user.

ClientServer

POST/admin/set-role

```
const { data, error } = await authClient.admin.setRole({
    userId: "user-id",
    role: "admin", // required
});
```

Parameters

`userId`string

The user id which you want to set the role for.

`role`string \| string\[\]required

The role to set, this can be a string or an array of strings.

POST/admin/set-role

```
const data = await auth.api.setRole({
    body: {
        userId: "user-id",
        role: "admin", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`userId`string

The user id which you want to set the role for.

`role`string \| string\[\]required

The role to set, this can be a string or an array of strings.

### [Set User Password](https://better-auth.com/docs/plugins/admin\#set-user-password)

Changes the password of a user.

ClientServer

POST/admin/set-user-password

```
const { data, error } = await authClient.admin.setUserPassword({
    newPassword: 'new-password', // required
    userId: 'user-id', // required
});
```

Parameters

`newPassword`stringrequired

The new password.

`userId`stringrequired

The user id which you want to set the password for.

POST/admin/set-user-password

```
const data = await auth.api.setUserPassword({
    body: {
        newPassword: 'new-password', // required
        userId: 'user-id', // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`newPassword`stringrequired

The new password.

`userId`stringrequired

The user id which you want to set the password for.

### [Update user](https://better-auth.com/docs/plugins/admin\#update-user)

Update a user's details.

ClientServer

POST/admin/update-user

```
const { data, error } = await authClient.admin.updateUser({
    userId: "user-id", // required
    data: { name: "John Doe" }, // required
});
```

Parameters

`userId`stringrequired

The user id which you want to update.

`data`Record<string, any>required

The data to update.

POST/admin/update-user

```
const data = await auth.api.adminUpdateUser({
    body: {
        userId: "user-id", // required
        data: { name: "John Doe" }, // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`userId`stringrequired

The user id which you want to update.

`data`Record<string, any>required

The data to update.

### [Ban User](https://better-auth.com/docs/plugins/admin\#ban-user)

Bans a user, preventing them from signing in and revokes all of their existing sessions.

ClientServer

POST/admin/ban-user

```
await authClient.admin.banUser({
    userId: "user-id", // required
    banReason: "Spamming",
    banExpiresIn: 60 * 60 * 24 * 7,
});
```

Parameters

`userId`stringrequired

The user id which you want to ban.

`banReason`string

The reason for the ban.

`banExpiresIn`number

The number of seconds until the ban expires. If not provided, the ban will never expire.

POST/admin/ban-user

```
await auth.api.banUser({
    body: {
        userId: "user-id", // required
        banReason: "Spamming",
        banExpiresIn: 60 * 60 * 24 * 7,
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`userId`stringrequired

The user id which you want to ban.

`banReason`string

The reason for the ban.

`banExpiresIn`number

The number of seconds until the ban expires. If not provided, the ban will never expire.

### [Unban User](https://better-auth.com/docs/plugins/admin\#unban-user)

Removes the ban from a user, allowing them to sign in again.

ClientServer

POST/admin/unban-user

```
await authClient.admin.unbanUser({
    userId: "user-id", // required
});
```

Parameters

`userId`stringrequired

The user id which you want to unban.

POST/admin/unban-user

```
await auth.api.unbanUser({
    body: {
        userId: "user-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`userId`stringrequired

The user id which you want to unban.

### [List User Sessions](https://better-auth.com/docs/plugins/admin\#list-user-sessions)

Lists all sessions for a user.

ClientServer

POST/admin/list-user-sessions

```
const { data, error } = await authClient.admin.listUserSessions({
    userId: "user-id", // required
});
```

Parameters

`userId`stringrequired

The user id.

POST/admin/list-user-sessions

```
const data = await auth.api.listUserSessions({
    body: {
        userId: "user-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`userId`stringrequired

The user id.

### [Revoke User Session](https://better-auth.com/docs/plugins/admin\#revoke-user-session)

Revokes a specific session for a user.

ClientServer

POST/admin/revoke-user-session

```
const { data, error } = await authClient.admin.revokeUserSession({
    sessionToken: "session_token_here", // required
});
```

Parameters

`sessionToken`stringrequired

The session token which you want to revoke.

POST/admin/revoke-user-session

```
const data = await auth.api.revokeUserSession({
    body: {
        sessionToken: "session_token_here", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`sessionToken`stringrequired

The session token which you want to revoke.

### [Revoke All Sessions for a User](https://better-auth.com/docs/plugins/admin\#revoke-all-sessions-for-a-user)

Revokes all sessions for a user.

ClientServer

POST/admin/revoke-user-sessions

```
const { data, error } = await authClient.admin.revokeUserSessions({
    userId: "user-id", // required
});
```

Parameters

`userId`stringrequired

The user id which you want to revoke all sessions for.

POST/admin/revoke-user-sessions

```
const data = await auth.api.revokeUserSessions({
    body: {
        userId: "user-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`userId`stringrequired

The user id which you want to revoke all sessions for.

### [Impersonate User](https://better-auth.com/docs/plugins/admin\#impersonate-user)

This feature allows an admin to create a session that mimics the specified user. The session will remain active until either the browser session ends or it reaches 1 hour. You can change this duration by setting the `impersonationSessionDuration` option.

ClientServer

POST/admin/impersonate-user

```
const { data, error } = await authClient.admin.impersonateUser({
    userId: "user-id", // required
});
```

Parameters

`userId`stringrequired

The user id which you want to impersonate.

POST/admin/impersonate-user

```
const data = await auth.api.impersonateUser({
    body: {
        userId: "user-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`userId`stringrequired

The user id which you want to impersonate.

By default, admins cannot impersonate other admin users. To allow this, grant the `impersonate-admins` permission to a role:

auth.ts

```
const superAdmin = ac.newRole({
  ...adminAc.statements,
  user: ["impersonate-admins", ...adminAc.statements.user],
});
```

The legacy `allowImpersonatingAdmins` option is still supported, but is deprecated and will be removed in a future version.

### [Stop Impersonating User](https://better-auth.com/docs/plugins/admin\#stop-impersonating-user)

To stop impersonating a user and continue with the admin account, you can use `stopImpersonating`

ClientServer

POST/admin/stop-impersonating

```
await authClient.admin.stopImpersonating();
```

POST/admin/stop-impersonating

```
await auth.api.stopImpersonating({
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

### [Remove User](https://better-auth.com/docs/plugins/admin\#remove-user)

Hard deletes a user from the database.

ClientServer

POST/admin/remove-user

```
const { data: deletedUser, error } = await authClient.admin.removeUser({
    userId: "user-id", // required
});
```

Parameters

`userId`stringrequired

The user id which you want to remove.

POST/admin/remove-user

```
const deletedUser = await auth.api.removeUser({
    body: {
        userId: "user-id", // required
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`userId`stringrequired

The user id which you want to remove.

## [Access Control](https://better-auth.com/docs/plugins/admin\#access-control)

The admin plugin offers a highly flexible access control system, allowing you to manage user permissions based on their role. You can define custom permission sets to fit your needs.

### [Roles](https://better-auth.com/docs/plugins/admin\#roles)

By default, there are two roles:

`admin`: Users with the admin role have full control over other users.

`user`: Users with the user role have no control over other users.

A user can have multiple roles. Multiple roles are stored as string separated by comma (",").

### [Permissions](https://better-auth.com/docs/plugins/admin\#permissions)

By default, there are two resources with up to six permissions.

**user**:
`create``list``set-role``ban``impersonate``impersonate-admins``delete``set-password`

**session**:
`list``revoke``delete`

Users with the admin role have full control over all the resources and actions. Users with the user role have no control over any of those actions.

### [Custom Permissions](https://better-auth.com/docs/plugins/admin\#custom-permissions)

The plugin provides an easy way to define your own set of permissions for each role.

#### [Create Access Control](https://better-auth.com/docs/plugins/admin\#create-access-control)

You first need to create an access controller by calling the `createAccessControl` function and passing the statement object. The statement object should have the resource name as the key and the array of actions as the value.

permissions.ts

```
import { createAccessControl } from "better-auth/plugins/access";

/**
 * make sure to use `as const` so typescript can infer the type correctly
 */
const statement = {
    project: ["create", "share", "update", "delete"],
} as const;

const ac = createAccessControl(statement);
```

To keep bundle sizes small, make sure to import from `better-auth/plugins/access` instead of `better-auth/plugins`.

#### [Create Roles](https://better-auth.com/docs/plugins/admin\#create-roles)

Once you have created the access controller you can create roles with the permissions you have defined.

permissions.ts

```
import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
    project: ["create", "share", "update", "delete"], // <-- Permissions available for created roles
} as const;

export const ac = createAccessControl(statement);

export const user = ac.newRole({
    project: ["create"],
});

export const admin = ac.newRole({
    project: ["create", "update"],
});

export const myCustomRole = ac.newRole({
    project: ["create", "update", "delete"],
    user: ["ban"],
});
```

When you create custom roles for existing roles, the predefined permissions for those roles will be overridden. To add the existing permissions to the custom role, you need to import `defaultStatements` and merge it with your new statement, plus merge the roles' permissions set with the default roles.

permissions.ts

```
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

const statement = {
    ...defaultStatements,
    project: ["create", "share", "update", "delete"],
} as const;

const ac = createAccessControl(statement);

const admin = ac.newRole({
    project: ["create", "update"],
    ...adminAc.statements,
});
```

#### [Pass Roles to the Plugin](https://better-auth.com/docs/plugins/admin\#pass-roles-to-the-plugin)

Once you have created the roles you can pass them to the admin plugin both on the client and the server.

auth.ts

```
import { betterAuth } from "better-auth"
import { admin as adminPlugin } from "better-auth/plugins"
import { ac, admin, user } from "@/auth/permissions"

export const auth = betterAuth({
    plugins: [\
        adminPlugin({\
            ac,\
            roles: {\
                admin,\
                user,\
                myCustomRole\
            }\
        }),\
    ],
});
```

You also need to pass the access controller and the roles to the client plugin.

auth-client.ts

```
import { createAuthClient } from "better-auth/client"
import { adminClient } from "better-auth/client/plugins"
import { ac, admin, user, myCustomRole } from "@/auth/permissions"

export const client = createAuthClient({
    plugins: [\
        adminClient({\
            ac,\
            roles: {\
                admin,\
                user,\
                myCustomRole\
            }\
        })\
    ]
})
```

### [Access Control Usage](https://better-auth.com/docs/plugins/admin\#access-control-usage)

**Has Permission**:

To check a user's permissions, you can use the `hasPermission` function provided by the client.

ClientServer

POST/admin/has-permission

```
const { data, error } = await authClient.admin.hasPermission({
    userId: "user-id",
    permission: { "project": ["create", "update"] } /* Must use this, or permissions */,
    permissions,
});
```

Parameters

`userId`string

The user id which you want to check the permissions for.

`permission`Record<string, string\[\]>

Optionally check if a single permission is granted. Must use this, or permissions.

`permissions`Record<string, string\[\]>

Optionally check if multiple permissions are granted. Must use this, or permission.

POST/admin/has-permission

```
const data = await auth.api.userHasPermission({
    body: {
        userId: "user-id",
        role: "admin", // server-only
        permission: { "project": ["create", "update"] } /* Must use this, or permissions */,
        permissions,
    },
});
```

Parameters

`userId`string

The user id which you want to check the permissions for.

`role`stringserver

Check role permissions.

`permission`Record<string, string\[\]>

Optionally check if a single permission is granted. Must use this, or permissions.

`permissions`Record<string, string\[\]>

Optionally check if multiple permissions are granted. Must use this, or permission.

Example usage:

```
import { authClient } from "@/lib/auth-client";

const canCreateProject = await authClient.admin.hasPermission({
  permissions: {
    project: ["create"],
  },
});

// You can also check multiple resource permissions at the same time
const canCreateProjectAndCreateSale = await authClient.admin.hasPermission({
  permissions: {
    project: ["create"],
    sale: ["create"]
  },
});
```

If you want to check a user's permissions server-side, you can use the `userHasPermission` action provided by the `api` to check the user's permissions.

permission.ts

```
import { auth } from "@/lib/auth"

await auth.api.userHasPermission({
  body: {
    userId: 'id', //the user id
    permissions: {
      project: ["create"], // This must match the structure in your access control
    },
  },
});

// You can also just pass the role directly
await auth.api.userHasPermission({
  body: {
   role: "admin",
    permissions: {
      project: ["create"], // This must match the structure in your access control
    },
  },
});

// You can also check multiple resource permissions at the same time
await auth.api.userHasPermission({
  body: {
   role: "admin",
    permissions: {
      project: ["create"], // This must match the structure in your access control
      sale: ["create"]
    },
  },
});
```

**Check Role Permission**:

Use the `checkRolePermission` function on the client side to verify whether a given **role** has a specific **permission**. This is helpful after defining roles and their permissions, as it allows you to perform permission checks without needing to contact the server.

Note that this function does **not** check the permissions of the currently logged-in user directly. Instead, it checks what permissions are assigned to a specified role. The function is synchronous, so you don't need to use `await` when calling it.

```
import { authClient } from "@/lib/auth-client";

const canCreateProject = authClient.admin.checkRolePermission({
  permissions: {
    user: ["delete"],
  },
  role: "admin",
});

// You can also check multiple resource permissions at the same time
const canDeleteUserAndRevokeSession = authClient.admin.checkRolePermission({
  permissions: {
    user: ["delete"],
    session: ["revoke"]
  },
  role: "admin",
});
```

## [Schema](https://better-auth.com/docs/plugins/admin\#schema)

This plugin adds the following fields to the `user` table:

Table

TableSQLPrismaDrizzle

Field

Type

Key

Description

role

string

?

The user's role. Defaults to \`user\`. Admins will have the \`admin\` role.

banned

boolean

?

Indicates whether the user is banned.

banReason

string

?

The reason for the user's ban.

banExpires

date

?

The date when the user's ban will expire.

And adds one field in the `session` table:

Table

TableSQLPrismaDrizzle

Field

Type

Key

Description

impersonatedBy

string

?

The ID of the admin that is impersonating this session.

### [Email Enumeration Protection](https://better-auth.com/docs/plugins/admin\#email-enumeration-protection)

If you use [email enumeration protection](https://better-auth.com/docs/authentication/email-password#email-enumeration-protection) (`requireEmailVerification` or `autoSignIn: false`), you need to configure `customSyntheticUser` to include the admin plugin fields in the fake sign-up response:

auth.ts

```
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      // Admin plugin fields (in schema order)
      role: "user", // or your configured defaultRole
      banned: false,
      banReason: null,
      banExpires: null,
      ...additionalFields,
      id,
    }),
  },
  plugins: [admin()],
});
```

## [Options](https://better-auth.com/docs/plugins/admin\#options)

### [Default Role](https://better-auth.com/docs/plugins/admin\#default-role)

The default role for a user. Defaults to `user`.

auth.ts

```
admin({
  defaultRole: "regular",
});
```

### [Admin Roles](https://better-auth.com/docs/plugins/admin\#admin-roles)

Specifies which roles are considered admin roles. Defaults to `["admin"]`. Custom roles (for example, `superadmin`) must be defined in custom access control.

auth.ts

```
admin({
  // Requires custom access control with `superadmin` defined in `roles`
  adminRoles: ["admin", "superadmin"],
});
```

**Note:** The `adminRoles` option is **not required** when using custom access control (via `ac` and `roles`). When you define custom roles with specific permissions, those roles will have exactly the permissions you grant them through the access control system.

**Warning:** When **not** using custom access control, only `admin` and `user` exist as valid roles. Any role that isn't in the `adminRoles` list will **not** be able to perform admin operations.

### [Admin userIds](https://better-auth.com/docs/plugins/admin\#admin-userids)

You can pass an array of userIds that should be considered as admin. Default to `[]`

auth.ts

```
admin({
    adminUserIds: ["user_id_1", "user_id_2"]
})
```

If a user is in the `adminUserIds` list, they will be able to perform any admin operation.

### [impersonationSessionDuration](https://better-auth.com/docs/plugins/admin\#impersonationsessionduration)

The duration of the impersonation session in seconds. Defaults to 1 hour.

auth.ts

```
admin({
  impersonationSessionDuration: 60 * 60 * 24, // 1 day
});
```

### [Default Ban Reason](https://better-auth.com/docs/plugins/admin\#default-ban-reason)

The default ban reason for a user created by the admin. Defaults to `No reason`.

auth.ts

```
admin({
  defaultBanReason: "Spamming",
});
```

### [Default Ban Expires In](https://better-auth.com/docs/plugins/admin\#default-ban-expires-in)

The default ban expires in for a user created by the admin in seconds. Defaults to `undefined` (meaning the ban never expires).

auth.ts

```
admin({
  defaultBanExpiresIn: 60 * 60 * 24, // 1 day
});
```

### [bannedUserMessage](https://better-auth.com/docs/plugins/admin\#bannedusermessage)

The message to show when a banned user tries to sign in. Defaults to "You have been banned from this application. Please contact support if you believe this is an error."

auth.ts

```
admin({
  bannedUserMessage: "Custom banned user message",
});
```

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/plugins/admin.mdx)

### On this page

[Installation](https://better-auth.com/docs/plugins/admin#installation) [Add the plugin to your auth config](https://better-auth.com/docs/plugins/admin#add-the-plugin-to-your-auth-config) [Migrate the database](https://better-auth.com/docs/plugins/admin#migrate-the-database) [Add the client plugin](https://better-auth.com/docs/plugins/admin#add-the-client-plugin) [Usage](https://better-auth.com/docs/plugins/admin#usage) [Create User](https://better-auth.com/docs/plugins/admin#create-user) [List Users](https://better-auth.com/docs/plugins/admin#list-users) [Query Filtering](https://better-auth.com/docs/plugins/admin#query-filtering) [Pagination](https://better-auth.com/docs/plugins/admin#pagination) [How to Implement Pagination](https://better-auth.com/docs/plugins/admin#how-to-implement-pagination) [Example Usage](https://better-auth.com/docs/plugins/admin#example-usage) [Get User](https://better-auth.com/docs/plugins/admin#get-user) [Returns](https://better-auth.com/docs/plugins/admin#returns) [Set User Role](https://better-auth.com/docs/plugins/admin#set-user-role) [Set User Password](https://better-auth.com/docs/plugins/admin#set-user-password) [Update user](https://better-auth.com/docs/plugins/admin#update-user) [Ban User](https://better-auth.com/docs/plugins/admin#ban-user) [Unban User](https://better-auth.com/docs/plugins/admin#unban-user) [List User Sessions](https://better-auth.com/docs/plugins/admin#list-user-sessions) [Revoke User Session](https://better-auth.com/docs/plugins/admin#revoke-user-session) [Revoke All Sessions for a User](https://better-auth.com/docs/plugins/admin#revoke-all-sessions-for-a-user) [Impersonate User](https://better-auth.com/docs/plugins/admin#impersonate-user) [Stop Impersonating User](https://better-auth.com/docs/plugins/admin#stop-impersonating-user) [Remove User](https://better-auth.com/docs/plugins/admin#remove-user) [Access Control](https://better-auth.com/docs/plugins/admin#access-control) [Roles](https://better-auth.com/docs/plugins/admin#roles) [Permissions](https://better-auth.com/docs/plugins/admin#permissions) [Custom Permissions](https://better-auth.com/docs/plugins/admin#custom-permissions) [Create Access Control](https://better-auth.com/docs/plugins/admin#create-access-control) [Create Roles](https://better-auth.com/docs/plugins/admin#create-roles) [Pass Roles to the Plugin](https://better-auth.com/docs/plugins/admin#pass-roles-to-the-plugin) [Access Control Usage](https://better-auth.com/docs/plugins/admin#access-control-usage) [Schema](https://better-auth.com/docs/plugins/admin#schema) [Email Enumeration Protection](https://better-auth.com/docs/plugins/admin#email-enumeration-protection) [Options](https://better-auth.com/docs/plugins/admin#options) [Default Role](https://better-auth.com/docs/plugins/admin#default-role) [Admin Roles](https://better-auth.com/docs/plugins/admin#admin-roles) [Admin userIds](https://better-auth.com/docs/plugins/admin#admin-userids) [impersonationSessionDuration](https://better-auth.com/docs/plugins/admin#impersonationsessionduration) [Default Ban Reason](https://better-auth.com/docs/plugins/admin#default-ban-reason) [Default Ban Expires In](https://better-auth.com/docs/plugins/admin#default-ban-expires-in) [bannedUserMessage](https://better-auth.com/docs/plugins/admin#bannedusermessage)

Ask AI `⌘I`