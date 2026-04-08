[Skip to main content](https://upstash.com/docs/redis/sdks/ts/getstarted#content-area)

[Upstash Documentation home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/upstash/logo/upstash-white-bg.svg)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/upstash/logo/upstash-dark-bg.svg)](https://upstash.com/docs)

Search...

Ctrl KAsk AI

Search...

Navigation

Typescript

Get Started

[Overview](https://upstash.com/docs/introduction) [Redis](https://upstash.com/docs/redis/overall/getstarted) [Vector](https://upstash.com/docs/vector/overall/getstarted) [QStash](https://upstash.com/docs/qstash/overall/getstarted) [Workflow](https://upstash.com/docs/workflow/getstarted) [Search](https://upstash.com/docs/search/overall/getstarted) [Box](https://upstash.com/docs/box/overall/quickstart) [Realtime](https://upstash.com/docs/realtime/overall/quickstart) [Developer API](https://upstash.com/docs/devops/developer-api/introduction)

On this page

- [Basic Usage:](https://upstash.com/docs/redis/sdks/ts/getstarted#basic-usage)

`@upstash/redis` is written in Deno and can be imported from
[deno.land](https://deno.land/)

```
import { Redis } from "https://deno.land/x/upstash_redis/mod.ts";
```

We transpile the package into an npm compatible package as well:

```
npm install @upstash/redis
```

```
yarn add @upstash/redis
```

```
pnpm add @upstash/redis
```

## [​](https://upstash.com/docs/redis/sdks/ts/getstarted\#basic-usage)  Basic Usage:

```
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: <UPSTASH_REDIS_REST_URL>,
  token: <UPSTASH_REDIS_REST_TOKEN>,
})

// string
await redis.set('key', 'value');
let data = await redis.get('key');
console.log(data)

await redis.set('key2', 'value2', {ex: 1});

// sorted set
await redis.zadd('scores', { score: 1, member: 'team1' })
data = await redis.zrange('scores', 0, 100 )
console.log(data)

// list
await redis.lpush('elements', 'magnesium')
data = await redis.lrange('elements', 0, 100 )
console.log(data)

// hash
await redis.hset('people', {name: 'joe'})
data = await redis.hget('people', 'name' )
console.log(data)

// sets
await redis.sadd('animals', 'cat')
data  = await redis.spop('animals', 1)
console.log(data)
```

Was this page helpful?

YesNo

[Suggest edits](https://github.com/upstash/docs/edit/main/redis/sdks/ts/getstarted.mdx) [Raise issue](https://github.com/upstash/docs/issues/new?title=Issue%20on%20docs&body=Path:%20/redis/sdks/ts/getstarted)

[Overview](https://upstash.com/docs/redis/sdks/ts/overview) [Overview](https://upstash.com/docs/redis/sdks/ts/commands/overview)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.