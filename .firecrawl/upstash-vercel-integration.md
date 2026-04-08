[Skip to main content](https://upstash.com/docs/redis/howto/vercelintegration#content-area)

[Upstash Documentation home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/upstash/logo/upstash-white-bg.svg)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/upstash/logo/upstash-dark-bg.svg)](https://upstash.com/docs)

Search...

Ctrl KAsk AI

Search...

Navigation

Integrations

Vercel - Upstash Redis Integration

[Overview](https://upstash.com/docs/introduction) [Redis](https://upstash.com/docs/redis/overall/getstarted) [Vector](https://upstash.com/docs/vector/overall/getstarted) [QStash](https://upstash.com/docs/qstash/overall/getstarted) [Workflow](https://upstash.com/docs/workflow/getstarted) [Search](https://upstash.com/docs/search/overall/getstarted) [Box](https://upstash.com/docs/box/overall/quickstart) [Realtime](https://upstash.com/docs/realtime/overall/quickstart) [Developer API](https://upstash.com/docs/devops/developer-api/introduction)

On this page

- [Add Integration to Your Vercel Account](https://upstash.com/docs/redis/howto/vercelintegration#add-integration-to-your-vercel-account)
- [Option 1: “Create New Upstash Account”](https://upstash.com/docs/redis/howto/vercelintegration#option-1-%E2%80%9Ccreate-new-upstash-account%E2%80%9D)
- [Option 2: “Link Existing Upstash Account”](https://upstash.com/docs/redis/howto/vercelintegration#option-2-%E2%80%9Clink-existing-upstash-account%E2%80%9D)
- [Use Upstash in Your App](https://upstash.com/docs/redis/howto/vercelintegration#use-upstash-in-your-app)
- [Redis](https://upstash.com/docs/redis/howto/vercelintegration#redis)
- [QStash](https://upstash.com/docs/redis/howto/vercelintegration#qstash)
- [Vector](https://upstash.com/docs/redis/howto/vercelintegration#vector)
- [Search](https://upstash.com/docs/redis/howto/vercelintegration#search)
- [Support](https://upstash.com/docs/redis/howto/vercelintegration#support)

If you are using [Vercel](https://vercel.com/) then you can integrate Upstash
Redis, Vector, Search or QStash to your project easily. Upstash is the perfect serverless
solution for your applications thanks to its:

- Low latency data
- Per request pricing
- Durable storage
- Ease of use

Below are the steps of the integration.

## [​](https://upstash.com/docs/redis/howto/vercelintegration\#add-integration-to-your-vercel-account)  Add Integration to Your Vercel Account

Visit the [Upstash Integration](https://vercel.com/integrations/upstash) on
Vercel and click the `Install` button. If you are installing an Upstash integration
for the first time, you will be prompted to choosing between connecting an existing Upstash
account or letting Vercel manage an Upstash account for you.![](https://mintcdn.com/upstash/jORuCV5FkbdVFZ31/img/vercel/vercel_integration_create.png?fit=max&auto=format&n=jORuCV5FkbdVFZ31&q=85&s=7ddb17b7704d1783fd33fbec684d382f)In both cases, you will be able to create and use a redis database as usual. If you let Vercel
manage your Upstash account, you can handle payments, database creation and deletion directly from the Vercel dashboard.If you choose to connect an existing Upstash account, you will be able to utilize features on Upstash Console
such as teams and audit logs.

### [​](https://upstash.com/docs/redis/howto/vercelintegration\#option-1-%E2%80%9Ccreate-new-upstash-account%E2%80%9D)  Option 1: “Create New Upstash Account”

If you choose this option, Vercel will prompt you to choose one of the products available on Upstash,
configure the database (by choosing database name, regions, plan). After you finish the configuration,
Vercel will create the Upstash account and the selected resources for you and redirect you to the
page of the created resource on Vercel dashboard.On the Vercel dashboard, you will be able to find the credentials of the database, change the database
name, update the regions or plan.![](https://mintcdn.com/upstash/jORuCV5FkbdVFZ31/img/vercel/vercel_dashboard.png?fit=max&auto=format&n=jORuCV5FkbdVFZ31&q=85&s=146cab752ab283c660ca333bdc18ca14)You can also go to the `Settings` tab and connect your apps on Vercel to the database, making the credentials
of the database available to the app as environment variables.

### [​](https://upstash.com/docs/redis/howto/vercelintegration\#option-2-%E2%80%9Clink-existing-upstash-account%E2%80%9D)  Option 2: “Link Existing Upstash Account”

Vercel will redirect you to Upstash, where you can select your Vercel project
and Upstash resources that you want to integrate.

You should login to [the Upstash Console](https://console.upstash.com/) with your account if you
are not logged in before clicking continue.

![](https://mintcdn.com/upstash/jORuCV5FkbdVFZ31/img/vercel/integration_init.png?fit=max&auto=format&n=jORuCV5FkbdVFZ31&q=85&s=3ba54cc2387ad309508e0ce02609a2f5)

If you do not have a Redis database yet, you can create one
from the dropdown menu.

![](https://mintcdn.com/upstash/jORuCV5FkbdVFZ31/img/vercel/integration_redis_create.png?fit=max&auto=format&n=jORuCV5FkbdVFZ31&q=85&s=4ed4dde36532aa6dafdf6e73a920617e)

Once you have selected all resources, click the `Save` button at the bottom of
the page.After all environment variables are created, you will be forwarded to Vercel. Go
to your project settings where you can see all added environment variables.

You need to redeploy your app for the environment variable to be used.

The [Integration Dashboard](https://console.upstash.com/integration/vercel)
allows you to see all your integrations, link new projects or manage existing
ones.

![](https://mintcdn.com/upstash/jORuCV5FkbdVFZ31/img/vercel/integration_dashboard.png?fit=max&auto=format&n=jORuCV5FkbdVFZ31&q=85&s=9d0f827ee454d30d24636740f83dd30b)

## [​](https://upstash.com/docs/redis/howto/vercelintegration\#use-upstash-in-your-app)  Use Upstash in Your App

If you completed the integration steps above and redeploy your app, the added
environment variables will be accessible inside your Vercel application. You can
now use them in your clients to connect

### [​](https://upstash.com/docs/redis/howto/vercelintegration\#redis)  Redis

```
import { Redis } from "@upstash/redis";
import { type NextRequest, NextResponse } from "next/server";

const redis = Redis.fromEnv();

export const POST = async (request: NextRequest) => {
  await redis.set("foo", "bar");
  const bar = await redis.get("foo");
  return NextResponse.json({
    body: `foo: ${bar}`,
  });
}
```

### [​](https://upstash.com/docs/redis/howto/vercelintegration\#qstash)  QStash

**Client**

```
import { Client } from "@upstash/qstash";

const client = new Client({
  token: process.env.QSTASH_TOKEN,
});

const res = await client.publishJSON({
  url: "https://my-api...",
  body: {
    hello: "world",
  },
});
```

**Receiver**

```
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
});

const isValid = await receiver.verify({
  signature: "..."
  body: "..."
})
```

### [​](https://upstash.com/docs/redis/howto/vercelintegration\#vector)  Vector

```
import { Index } from "@upstash/vector";

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN,
});

await index.upsert({
  id: "1",
  data: "Hello world!",
  metadata: { "category": "greeting" }
})
```

### [​](https://upstash.com/docs/redis/howto/vercelintegration\#search)  Search

```
import { Search } from "@upstash/search";

const client = new Search({
  url: process.env.UPSTASH_SEARCH_REST_URL,
  token: process.env.UPSTASH_SEARCH_REST_TOKEN,
});

const index = client.index("my-index");
await index.upsert({
  id: "1",
  content: { text: "Hello world!" },
  metadata: { category: "greeting" }
});
```

## [​](https://upstash.com/docs/redis/howto/vercelintegration\#support)  Support

If you have any issue you can ask in our
[Discord server](https://discord.gg/w9SenAtbme) or send email at
[support@upstash.com](mailto:support@upstash.com)

Was this page helpful?

YesNo

[Suggest edits](https://github.com/upstash/docs/edit/main/redis/howto/vercelintegration.mdx) [Raise issue](https://github.com/upstash/docs/issues/new?title=Issue%20on%20docs&body=Path:%20/redis/howto/vercelintegration)

[Sidekiq](https://upstash.com/docs/redis/integrations/sidekiq) [Replit Templates](https://upstash.com/docs/redis/integrations/replit-templates)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.

![](https://mintcdn.com/upstash/jORuCV5FkbdVFZ31/img/vercel/vercel_integration_create.png?w=1100&fit=max&auto=format&n=jORuCV5FkbdVFZ31&q=85&s=213c9ecd06073b85ed7de8bc4c84a395)

![](https://mintcdn.com/upstash/jORuCV5FkbdVFZ31/img/vercel/vercel_dashboard.png?w=1100&fit=max&auto=format&n=jORuCV5FkbdVFZ31&q=85&s=6d18e6ca0fd8221d001bd266d1b1c3f1)

![](https://mintcdn.com/upstash/jORuCV5FkbdVFZ31/img/vercel/integration_init.png?w=1100&fit=max&auto=format&n=jORuCV5FkbdVFZ31&q=85&s=7083c6ebd83b23e3489431dce34c9ecc)

![](https://mintcdn.com/upstash/jORuCV5FkbdVFZ31/img/vercel/integration_redis_create.png?w=1100&fit=max&auto=format&n=jORuCV5FkbdVFZ31&q=85&s=d3cd2ae4d253e56a452ba41deefb03bb)

![](https://mintcdn.com/upstash/jORuCV5FkbdVFZ31/img/vercel/integration_dashboard.png?w=1100&fit=max&auto=format&n=jORuCV5FkbdVFZ31&q=85&s=cfcd45cf4a0ef149edabb801bc19c83f)