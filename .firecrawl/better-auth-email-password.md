[BETTER-AUTH.](https://better-auth.com/)

[BETTER-AUTH.](https://better-auth.com/)

Toggle theme

[readme](https://better-auth.com/)

[docs](https://better-auth.com/docs)

products

[enterprise](https://better-auth.com/enterprise)

resources

[sign-in](https://dash.better-auth.com/sign-in)

# Email & Password

Copy MDOpen in

Implementing email and password authentication with Better Auth.

Email and password authentication is a common method used by many applications. Better Auth provides a built-in email and password authenticator that you can easily integrate into your project.

If you prefer username-based authentication, check out the [username plugin](https://better-auth.com/docs/plugins/username). It extends the
email and password authenticator with username support.

## [Enable Email and Password](https://better-auth.com/docs/authentication/email-password\#enable-email-and-password)

To enable email and password authentication, you need to set the `emailAndPassword.enabled` option to `true` in the `auth` configuration.

auth.ts

```
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
});
```

If it's not enabled, it'll not allow you to sign in or sign up with email and
password.

## [Usage](https://better-auth.com/docs/authentication/email-password\#usage)

### [Sign Up](https://better-auth.com/docs/authentication/email-password\#sign-up)

To sign a user up, you can use the `signUp.email` function provided by the client.

ClientServer

POST/sign-up/email

```
const { data, error } = await authClient.signUp.email({
    name: "John Doe", // required
    email: "john.doe@example.com", // required
    password: "password1234", // required
    image: "https://example.com/image.png",
    callbackURL: "https://example.com/callback",
});
```

Parameters

`name`stringrequired

The name of the user.

`email`stringrequired

The email address of the user.

`password`stringrequired

The password of the user. It should be at least 8 characters long and max 128 by default.

`image`string

An optional profile image of the user.

`callbackURL`string

An optional URL to redirect to after the user signs up.

POST/sign-up/email

```
const data = await auth.api.signUpEmail({
    body: {
        name: "John Doe", // required
        email: "john.doe@example.com", // required
        password: "password1234", // required
        image: "https://example.com/image.png",
        callbackURL: "https://example.com/callback",
    },
});
```

Parameters

`name`stringrequired

The name of the user.

`email`stringrequired

The email address of the user.

`password`stringrequired

The password of the user. It should be at least 8 characters long and max 128 by default.

`image`string

An optional profile image of the user.

`callbackURL`string

An optional URL to redirect to after the user signs up.

These are the default properties for the sign up email endpoint, however it's possible that with [additional fields](https://better-auth.com/docs/concepts/typescript#additional-fields) or special plugins you can pass more properties to the endpoint.

### [Sign In](https://better-auth.com/docs/authentication/email-password\#sign-in)

To sign a user in, you can use the `signIn.email` function provided by the client.

ClientServer

POST/sign-in/email

```
const { data, error } = await authClient.signIn.email({
    email: "john.doe@example.com", // required
    password: "password1234", // required
    rememberMe: true,
    callbackURL: "https://example.com/callback",
});
```

Parameters

`email`stringrequired

The email address of the user.

`password`stringrequired

The password of the user. It should be at least 8 characters long and max 128 by default.

`rememberMe`boolean

If false, the user will be signed out when the browser is closed. (optional) (default: true)

`callbackURL`string

An optional URL to redirect to after the user signs in. (optional)

POST/sign-in/email

```
const data = await auth.api.signInEmail({
    body: {
        email: "john.doe@example.com", // required
        password: "password1234", // required
        rememberMe: true,
        callbackURL: "https://example.com/callback",
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`email`stringrequired

The email address of the user.

`password`stringrequired

The password of the user. It should be at least 8 characters long and max 128 by default.

`rememberMe`boolean

If false, the user will be signed out when the browser is closed. (optional) (default: true)

`callbackURL`string

An optional URL to redirect to after the user signs in. (optional)

These are the default properties for the sign in email endpoint, however it's possible that with [additional fields](https://better-auth.com/docs/concepts/typescript#additional-fields) or special plugins you can pass different properties to the endpoint.

### [Sign Out](https://better-auth.com/docs/authentication/email-password\#sign-out)

To sign a user out, you can use the `signOut` function provided by the client.

ClientServer

POST/sign-out

```
await authClient.signOut();
```

POST/sign-out

```
await auth.api.signOut({
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

you can pass `fetchOptions` to redirect onSuccess

```
import { authClient } from "@/lib/auth-client"

await authClient.signOut({
  fetchOptions: {
    onSuccess: () => {
      router.push("/login"); // redirect to login page
    },
  },
});
```

### [Email Verification](https://better-auth.com/docs/authentication/email-password\#email-verification)

To enable email verification, you need to pass a function that sends a verification email with a link. The `sendVerificationEmail` function takes a data object with the following properties:

- `user`: The user object.
- `url`: The URL to send to the user which contains the token.
- `token`: A verification token used to complete the email verification.

and a `request` object as the second parameter.

auth.ts

```
import { betterAuth } from "better-auth";
import { sendEmail } from "./email"; // your email sending function

export const auth = betterAuth({
  emailVerification: {
    sendVerificationEmail: async ( { user, url, token }, request) => {
      void sendEmail({
        to: user.email,
        subject: "Verify your email address",
        text: `Click the link to verify your email: ${url}`,
      });
    },
  },
});
```

Avoid awaiting the email sending to prevent
timing attacks. On serverless platforms, use `waitUntil` or similar to ensure the email is sent.

On the client side you can use `sendVerificationEmail` function to send verification link to user. This will trigger the `sendVerificationEmail` function you provided in the `auth` configuration.

Once the user clicks on the link in the email, if the token is valid, the user will be redirected to the URL provided in the `callbackURL` parameter. If the token is invalid, the user will be redirected to the URL provided in the `callbackURL` parameter with an error message in the query string `?error=invalid_token`.

#### [Require Email Verification](https://better-auth.com/docs/authentication/email-password\#require-email-verification)

If you enable require email verification, users must verify their email before they can log in. And every time a user tries to sign in, sendVerificationEmail is called.

This only works if you have sendVerificationEmail implemented and if the user
is trying to sign in with email and password.

When `requireEmailVerification` is enabled, signing up with an existing email returns a success response instead of an error to prevent user enumeration.

auth.ts

```
export const auth = betterAuth({
  emailAndPassword: {
    requireEmailVerification: true,
  },
});
```

You can use the `onExistingUserSignUp` callback to notify the existing user when someone tries to register with their email address:

auth.ts

```
import { betterAuth } from "better-auth";
import { sendEmail } from "./email"; // your email sending function

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    onExistingUserSignUp: async ({ user }, request) => {
      void sendEmail({
        to: user.email,
        subject: "Sign-up attempt with your email",
        text: "Someone tried to create an account using your email address. If this was you, try signing in instead. If not, you can safely ignore this email.",
      });
    },
  },
});
```

If a user tries to sign in without verifying their email, you can handle the error and show a message to the user.

```
import { authClient } from "@/lib/auth-client"

await authClient.signIn.email(
  {
    email: "email@example.com",
    password: "password",
  },
  {
    onError: (ctx) => {
      // Handle the error
      if (ctx.error.status === 403) {
        alert("Please verify your email address");
      }
      //you can also show the original error message
      alert(ctx.error.message);
    },
  }
);
```

#### [Email Enumeration Protection](https://better-auth.com/docs/authentication/email-password\#email-enumeration-protection)

When `requireEmailVerification` is enabled or `autoSignIn` is set to `false`, the sign-up endpoint prevents email enumeration by returning the same `200` response whether the email is already registered or not. This follows [OWASP authentication best practices](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#authentication-and-error-messages).

This protection is only active when the sign-up response does not include a session token — i.e., when `requireEmailVerification` is `true` or `autoSignIn` is `false`. With the default configuration, the endpoint still returns a `422` error for existing emails.

Similarly, the `/change-email` endpoint no longer reveals whether the target email is already registered — it always returns a success response.

##### [Plugins that add user fields](https://better-auth.com/docs/authentication/email-password\#plugins-that-add-user-fields)

If you use plugins that add fields to the user table (e.g. [admin](https://better-auth.com/docs/plugins/admin), [two-factor](https://better-auth.com/docs/plugins/two-factor), [phone-number](https://better-auth.com/docs/plugins/phone-number)), the synthetic response needs to include those fields to be indistinguishable from a real sign-up. Use the `customSyntheticUser` option to build the complete user object:

auth.ts

```
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    customSyntheticUser: ({ coreFields, additionalFields, id }) => ({
      ...coreFields,
      // Admin plugin fields (in schema order)
      role: "user",
      banned: false,
      banReason: null,
      banExpires: null,
      // Your additional fields
      ...additionalFields,
      // ID must be last to match database output order
      id,
    }),
  },
  plugins: [admin()],
});
```

The callback receives three building blocks:

- **`coreFields`** — `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`
- **`additionalFields`** — Your `user.additionalFields` with defaults applied
- **`id`** — A generated user ID matching your configured ID strategy

You assemble them in the same order as your database schema: core fields → plugin fields → additional fields → id. Each plugin documents the fields you need to add — see [admin plugin](https://better-auth.com/docs/plugins/admin#email-enumeration-protection) for an example.

#### [Triggering manually Email Verification](https://better-auth.com/docs/authentication/email-password\#triggering-manually-email-verification)

You can trigger the email verification manually by calling the `sendVerificationEmail` function.

```
import { authClient } from "@/lib/auth-client"

await authClient.sendVerificationEmail({
  email: "user@email.com",
  callbackURL: "/", // The redirect URL after verification
});
```

### [Request Password Reset](https://better-auth.com/docs/authentication/email-password\#request-password-reset)

To allow users to reset a password first you need to provide `sendResetPassword` function to the email and password authenticator. The `sendResetPassword` function takes a data object with the following properties:

- `user`: The user object.
- `url`: The URL to send to the user which contains the token.
- `token`: A verification token used to complete the password reset.

and a `request` object as the second parameter.

auth.ts

```
import { betterAuth } from "better-auth";
import { sendEmail } from "./email"; // your email sending function

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({user, url, token}, request) => {
      void sendEmail({
        to: user.email,
        subject: "Reset your password",
        text: `Click the link to reset your password: ${url}`,
      });
    },
    onPasswordReset: async ({ user }, request) => {
      // your logic here
      console.log(`Password for user ${user.email} has been reset.`);
    },
  },
});
```

Avoid awaiting the email sending to prevent
timing attacks. On serverless platforms, use `waitUntil` or similar to ensure the email is sent.

Additionally, you can provide an `onPasswordReset` callback to execute logic after a password has been successfully reset.

Once you configured your server you can call `requestPasswordReset` function to send reset password link to user. If the user exists, it will trigger the `sendResetPassword` function you provided in the auth config.

ClientServer

POST/request-password-reset

```
const { data, error } = await authClient.requestPasswordReset({
    email: "john.doe@example.com", // required
    redirectTo: "https://example.com/reset-password",
});
```

Parameters

`email`stringrequired

The email address of the user to send a password reset email to

`redirectTo`string

The URL to redirect the user to reset their password. If the token isn't valid or expired, it'll be redirected with a query parameter `?error=INVALID_TOKEN`. If the token is valid, it'll be redirected with a query parameter \`?token=VALID\_TOKEN

POST/request-password-reset

```
const data = await auth.api.requestPasswordReset({
    body: {
        email: "john.doe@example.com", // required
        redirectTo: "https://example.com/reset-password",
    },
});
```

Parameters

`email`stringrequired

The email address of the user to send a password reset email to

`redirectTo`string

The URL to redirect the user to reset their password. If the token isn't valid or expired, it'll be redirected with a query parameter `?error=INVALID_TOKEN`. If the token is valid, it'll be redirected with a query parameter \`?token=VALID\_TOKEN

When a user clicks on the link in the email, they will be redirected to the reset password page. You can add the reset password page to your app. Then you can use `resetPassword` function to reset the password. It takes an object with the following properties:

- `newPassword`: The new password of the user.

```
import { authClient } from "@/lib/auth-client"

const { data, error } = await authClient.resetPassword({
  newPassword: "password1234",
  token,
});
```

ClientServer

POST/reset-password

```
const token = new URLSearchParams(window.location.search).get("token");

if (!token) {
  // Handle the error
}

const { data, error } = await authClient.resetPassword({
    newPassword: "password1234", // required
    token, // required
});
```

Parameters

`newPassword`stringrequired

The new password to set

`token`stringrequired

The token to reset the password

POST/reset-password

```
const token = new URLSearchParams(window.location.search).get("token");

if (!token) {
  // Handle the error
}

const data = await auth.api.resetPassword({
    body: {
        newPassword: "password1234", // required
        token, // required
    },
});
```

Parameters

`newPassword`stringrequired

The new password to set

`token`stringrequired

The token to reset the password

### [Update password](https://better-auth.com/docs/authentication/email-password\#update-password)

A user's password isn't stored in the user table. Instead, it's stored in the account table. To change the password of a user, you can use one of the following approaches:

ClientServer

POST/change-password

```
const { data, error } = await authClient.changePassword({
    newPassword: "newpassword1234", // required
    currentPassword: "oldpassword1234", // required
    revokeOtherSessions: true,
});
```

Parameters

`newPassword`stringrequired

The new password to set

`currentPassword`stringrequired

The current user password

`revokeOtherSessions`boolean

When set to true, all other active sessions for this user will be invalidated

POST/change-password

```
const data = await auth.api.changePassword({
    body: {
        newPassword: "newpassword1234", // required
        currentPassword: "oldpassword1234", // required
        revokeOtherSessions: true,
    },
    // This endpoint requires session cookies.
    headers: await headers(),
});
```

Parameters

`newPassword`stringrequired

The new password to set

`currentPassword`stringrequired

The current user password

`revokeOtherSessions`boolean

When set to true, all other active sessions for this user will be invalidated

### [Configuration](https://better-auth.com/docs/authentication/email-password\#configuration)

**Password**

Better Auth stores passwords inside the `account` table with `providerId` set to `credential`.

**Password Hashing**: Better Auth uses `scrypt` to hash passwords. The `scrypt` algorithm is designed to be slow and memory-intensive to make it difficult for attackers to brute force passwords. OWASP recommends using `scrypt` if `argon2id` is not available. We decided to use `scrypt` because it's natively supported by Node.js.

You can pass custom password hashing algorithm by setting `password` option in the `emailAndPassword` configuration.

**Example**

Here's an example of customizing the password hashing to use Argon2:

password.ts

```
import { hash, type Options, verify } from "@node-rs/argon2";

const opts: Options = {
  memoryCost: 65536, // 64 MiB
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 lanes
  outputLen: 32, // 32 bytes
  algorithm: 2, // Argon2id
};

export async function hashPassword(password: string) {
  const result = await hash(password, opts);
  return result;
}

export async function verifyPassword(data: { password: string; hash: string }) {
  const { password, hash } = data;
  const result = await verify(hash, password, opts);
  return result;
}
```

auth.ts

```
import { betterAuth } from "better-auth";
import { hashPassword, verifyPassword } from "./password";

export const auth = betterAuth({
  emailAndPassword: {
    //...rest of the options
    enabled: true,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
  },
});
```

Prop

Type

`enabled?`boolean

`disableSignUp?`boolean

`minPasswordLength?`number

`maxPasswordLength?`number

`sendResetPassword?`function

`onPasswordReset?`function

`onExistingUserSignUp?`function

`customSyntheticUser?`function

`autoSignIn?`boolean

`requireEmailVerification?`boolean

`revokeSessionsOnPasswordReset?`boolean

`resetPasswordTokenExpiresIn?`number

`password?`object

[Edit on GitHub](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/email-password.mdx)

### On this page

[Enable Email and Password](https://better-auth.com/docs/authentication/email-password#enable-email-and-password) [Usage](https://better-auth.com/docs/authentication/email-password#usage) [Sign Up](https://better-auth.com/docs/authentication/email-password#sign-up) [Sign In](https://better-auth.com/docs/authentication/email-password#sign-in) [Sign Out](https://better-auth.com/docs/authentication/email-password#sign-out) [Email Verification](https://better-auth.com/docs/authentication/email-password#email-verification) [Require Email Verification](https://better-auth.com/docs/authentication/email-password#require-email-verification) [Email Enumeration Protection](https://better-auth.com/docs/authentication/email-password#email-enumeration-protection) [Plugins that add user fields](https://better-auth.com/docs/authentication/email-password#plugins-that-add-user-fields) [Triggering manually Email Verification](https://better-auth.com/docs/authentication/email-password#triggering-manually-email-verification) [Request Password Reset](https://better-auth.com/docs/authentication/email-password#request-password-reset) [Update password](https://better-auth.com/docs/authentication/email-password#update-password) [Configuration](https://better-auth.com/docs/authentication/email-password#configuration)

Ask AI `⌘I`