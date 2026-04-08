[Skip to main content](https://upstash.com/docs/redis/howto/connectclient#content-area)

[Upstash Documentation home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/upstash/logo/upstash-white-bg.svg)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/upstash/logo/upstash-dark-bg.svg)](https://upstash.com/docs)

Search...

Ctrl KAsk AI

Search...

Navigation

How To

Connect Your Client

[Overview](https://upstash.com/docs/introduction) [Redis](https://upstash.com/docs/redis/overall/getstarted) [Vector](https://upstash.com/docs/vector/overall/getstarted) [QStash](https://upstash.com/docs/qstash/overall/getstarted) [Workflow](https://upstash.com/docs/workflow/getstarted) [Search](https://upstash.com/docs/search/overall/getstarted) [Box](https://upstash.com/docs/box/overall/quickstart) [Realtime](https://upstash.com/docs/realtime/overall/quickstart) [Developer API](https://upstash.com/docs/devops/developer-api/introduction)

On this page

- [Database](https://upstash.com/docs/redis/howto/connectclient#database)
- [upstash-redis](https://upstash.com/docs/redis/howto/connectclient#upstash-redis)
- [Node.js](https://upstash.com/docs/redis/howto/connectclient#node-js)
- [Python](https://upstash.com/docs/redis/howto/connectclient#python)
- [Java](https://upstash.com/docs/redis/howto/connectclient#java)
- [PHP](https://upstash.com/docs/redis/howto/connectclient#php)
- [Go](https://upstash.com/docs/redis/howto/connectclient#go)

Upstash works with Redis® API, that means you can use any Redis client with
Upstash. At the [Redis Clients](https://redis.io/clients) page you can find the
list of Redis clients in different languages.Probably, the easiest way to connect to your database is to use `redis-cli`.
Because it is already covered in [Getting Started](https://upstash.com/docs/redis/overall/getstarted), we
will skip it here.

## [​](https://upstash.com/docs/redis/howto/connectclient\#database)  Database

After completing the [getting started](https://upstash.com/docs/redis/overall/getstarted) guide, you will
see the database page as below:

![](https://mintcdn.com/upstash/eu0laKPu7u_-Kw04/img/getting_started/database.png?fit=max&auto=format&n=eu0laKPu7u_-Kw04&q=85&s=4530264625c10bdf334129ec8b367511)

The information required for Redis clients is displayed here as **Endpoint**,
**Port** and **Password**. Also when you click on `Clipboard` button on **Connect to your database** section, you can copy
the code that is required for your client.Below, we will provide examples from popular Redis clients, but the information above should help you configure all Redis clients similarly.

TLS is enabled by default for all Upstash Redis databases. It’s not possible
to disable it.

## [​](https://upstash.com/docs/redis/howto/connectclient\#upstash-redis)  upstash-redis

Because upstash-redis is HTTP based, we recommend it for Serverless functions.
Other TCP based clients can cause connection problems in highly concurrent use
cases.

**Library**: [upstash-redis](https://github.com/upstash/upstash-redis)**Example**:

```
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: "UPSTASH_REDIS_REST_URL",
  token: "UPSTASH_REDIS_REST_TOKEN",
});

(async () => {
  try {
    const data = await redis.get("key");
    console.log(data);
  } catch (error) {
    console.error(error);
  }
})();
```

## [​](https://upstash.com/docs/redis/howto/connectclient\#node-js)  Node.js

**Library**: [ioredis](https://github.com/luin/ioredis)**Example**:

```
const Redis = require("ioredis");

let client = new Redis("rediss://:YOUR_PASSWORD@YOUR_ENDPOINT:YOUR_PORT");
await client.set("foo", "bar");
let x = await client.get("foo");
console.log(x);
```

## [​](https://upstash.com/docs/redis/howto/connectclient\#python)  Python

**Library**: [redis-py](https://github.com/andymccurdy/redis-py)**Example**:

```
import redis
r = redis.Redis(
host= 'YOUR_ENDPOINT',
port= 'YOUR_PORT',
password= 'YOUR_PASSWORD',
ssl=True)
r.set('foo','bar')
print(r.get('foo'))
```

## [​](https://upstash.com/docs/redis/howto/connectclient\#java)  Java

**Library**: [jedis](https://github.com/xetorthio/jedis)**Example**:

```
Jedis jedis = new Jedis("YOUR_ENDPOINT", "YOUR_PORT", true);
jedis.auth("YOUR_PASSWORD");
jedis.set("foo", "bar");
String value = jedis.get("foo");
System.out.println(value);
```

Jedis does not offer command level retry config by default, but you can handle
retries using connection pool. Check [Retrying a command after a connection\\
failure](https://redis.io/docs/latest/develop/clients/jedis/connect/#retrying-a-command-after-a-connection-failure)

## [​](https://upstash.com/docs/redis/howto/connectclient\#php)  PHP

**Library**: [phpredis](https://github.com/phpredis/phpredis)**Example**:

```
<?php

$redis = new Redis();

$redis->connect("YOUR_ENDPOINT", "YOUR_PORT");
$redis->auth("YOUR_PASSWORD");

$redis->set("foo", "bar");

print_r($redis->get("foo"));
```

Phpredis supports connection level retries through `OPT_MAX_RETRIES`. However,
for command level retries, it only supports [SCAN\\
command](https://github.com/phpredis/phpredis?tab=readme-ov-file#example-29).

## [​](https://upstash.com/docs/redis/howto/connectclient\#go)  Go

**Library**: [redigo](https://github.com/gomodule/redigo)**Example**:

```
func main() {
  c, err := redis.Dial("tcp", "YOUR_ENDPOINT:YOUR_PORT", redis.DialUseTLS(true))
  if err != nil {
      panic(err)
  }

  _, err = c.Do("AUTH", "YOUR_PASSWORD")
  if err != nil {
      panic(err)
  }

  _, err = c.Do("SET", "foo", "bar")
  if err != nil {
      panic(err)
  }

  value, err := redis.String(c.Do("GET", "foo"))
  if err != nil {
      panic(err)
  }

  println(value)
}
```

Was this page helpful?

YesNo

[Suggest edits](https://github.com/upstash/docs/edit/main/redis/howto/connectclient.mdx) [Raise issue](https://github.com/upstash/docs/issues/new?title=Issue%20on%20docs&body=Path:%20/redis/howto/connectclient)

[User Directory](https://upstash.com/docs/redis/search/recipes/user-directory) [Connect with upstash-redis](https://upstash.com/docs/redis/howto/connectwithupstashredis)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.

![](https://mintcdn.com/upstash/eu0laKPu7u_-Kw04/img/getting_started/database.png?w=1100&fit=max&auto=format&n=eu0laKPu7u_-Kw04&q=85&s=eca30f6532a78f7f25952b41beac50d5)