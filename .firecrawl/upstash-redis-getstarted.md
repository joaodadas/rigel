[Skip to main content](https://upstash.com/docs/redis/overall/getstarted#content-area)

[Upstash Documentation home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/upstash/logo/upstash-white-bg.svg)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/upstash/logo/upstash-dark-bg.svg)](https://upstash.com/docs)

Search...

Ctrl KAsk AI

Search...

Navigation

Overall

Getting Started

[Overview](https://upstash.com/docs/introduction) [Redis](https://upstash.com/docs/redis/overall/getstarted) [Vector](https://upstash.com/docs/vector/overall/getstarted) [QStash](https://upstash.com/docs/qstash/overall/getstarted) [Workflow](https://upstash.com/docs/workflow/getstarted) [Search](https://upstash.com/docs/search/overall/getstarted) [Box](https://upstash.com/docs/box/overall/quickstart) [Realtime](https://upstash.com/docs/realtime/overall/quickstart) [Developer API](https://upstash.com/docs/devops/developer-api/introduction)

On this page

- [1\. Create an Upstash Redis Database](https://upstash.com/docs/redis/overall/getstarted#1-create-an-upstash-redis-database)
- [2\. Connect to Your Database](https://upstash.com/docs/redis/overall/getstarted#2-connect-to-your-database)

Upstash Redis is a **highly available, infinitely scalable** Redis-compatible database:

- 99.99% uptime guarantee with auto-scaling ( [Prod Pack](https://upstash.com/docs/redis/overall/enterprise#prod-pack-features))
- Ultra-low latency worldwide
- Multi-region replication
- Durable, persistent storage without sacrificing performance
- Automatic backups
- Optional SOC-2 compliance, encryption at rest and much more

* * *

## [​](https://upstash.com/docs/redis/overall/getstarted\#1-create-an-upstash-redis-database)  1\. Create an Upstash Redis Database

Once you’re logged in, create a database by clicking `+ Create Database` in the upper right corner. A dialog opens up:

![](https://mintcdn.com/upstash/eu0laKPu7u_-Kw04/img/getting_started/create-global.png?fit=max&auto=format&n=eu0laKPu7u_-Kw04&q=85&s=09013e74602d754565d828cc90c26aa6)

**Database Name:** Enter a name for your database.**Primary Region and Read Regions:** For optimal performance, select the Primary Region closest to where most of your writes will occur. Select the read region(s) where most of your reads will occur.Once you click `Next` and select a plan, your database is running and ready to connect:

![](https://mintcdn.com/upstash/eu0laKPu7u_-Kw04/img/getting_started/database.png?fit=max&auto=format&n=eu0laKPu7u_-Kw04&q=85&s=4530264625c10bdf334129ec8b367511)

* * *

## [​](https://upstash.com/docs/redis/overall/getstarted\#2-connect-to-your-database)  2\. Connect to Your Database

You can connect to Upstash Redis with any Redis client. For simplicity, we’ll use `redis-cli`. See the [Connect Your Client](https://upstash.com/docs/redis/howto/connectclient) section for connecting via our TypeScript or Python SDKs and other clients.The Redis CLI is included in the official Redis distribution. If you don’t
have Redis installed, you can get it [here](https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/).Connect to your database and execute commands on it:

```
> redis-cli --tls -a PASSWORD -h ENDPOINT -p PORT
ENDPOINT:PORT> set counter 0
OK
ENDPOINT:PORT> get counter
"0"
ENDPOINT:PORT> incr counter
(int) 1
ENDPOINT:PORT> incr counter
(int) 2
```

As you run commands, you’ll see updates to your database metrics in (almost) real-time. These database metrics are refreshed every 10 seconds.

![](https://mintcdn.com/upstash/eu0laKPu7u_-Kw04/img/getting_started/charts.png?fit=max&auto=format&n=eu0laKPu7u_-Kw04&q=85&s=0a226cc212d85606ab415a6a90c66beb)

Congratulations! You have created an ultra-fast Upstash Redis database! 🎉

**New: Manage Upstash Redis From Cursor (optional)**Manage Upstash Redis databases from Cursor and other AI tools by using our [MCP server](https://upstash.com/docs/redis/integrations/mcp).

Was this page helpful?

YesNo

[Suggest edits](https://github.com/upstash/docs/edit/main/redis/overall/getstarted.mdx) [Raise issue](https://github.com/upstash/docs/issues/new?title=Issue%20on%20docs&body=Path:%20/redis/overall/getstarted)

[Pricing & Limits](https://upstash.com/docs/redis/overall/pricing)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.

![](https://mintcdn.com/upstash/eu0laKPu7u_-Kw04/img/getting_started/create-global.png?w=1100&fit=max&auto=format&n=eu0laKPu7u_-Kw04&q=85&s=94fccda941b66418a310a4332816e5e3)

![](https://mintcdn.com/upstash/eu0laKPu7u_-Kw04/img/getting_started/database.png?w=1100&fit=max&auto=format&n=eu0laKPu7u_-Kw04&q=85&s=eca30f6532a78f7f25952b41beac50d5)

![](https://mintcdn.com/upstash/eu0laKPu7u_-Kw04/img/getting_started/charts.png?w=1100&fit=max&auto=format&n=eu0laKPu7u_-Kw04&q=85&s=11e42d05b3266a9873b7754ef3727cd0)