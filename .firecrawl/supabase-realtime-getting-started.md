Realtime

# Getting Started with Realtime

## Learn how to build real-time applications with Supabase Realtime

* * *

## Quick start [\#](https://supabase.com/docs/guides/realtime/getting_started\#quick-start)

### 1\. Install the client library [\#](https://supabase.com/docs/guides/realtime/getting_started\#1-install-the-client-library)

TypeScriptFlutterSwiftPython - PIPPython - Conda

```
1
npm install @supabase/supabase-js
```

### 2\. Initialize the client [\#](https://supabase.com/docs/guides/realtime/getting_started\#2-initialize-the-client)

Get your project URL and key.

### Get API details [\#](https://supabase.com/docs/guides/realtime/getting_started\#get-api-details)

Now that you've created some database tables, you are ready to insert data using the auto-generated API.

To do this, you need to get the Project URL and key from [the project **Connect** dialog](https://supabase.com/dashboard/project/_?showConnect=true&connectTab=&framework=).

[Read the API keys docs](https://supabase.com/docs/guides/api/api-keys) for a full explanation of all key types and their uses.

##### Changes to API keys

Supabase is changing the way keys work to improve project security and developer experience. You can [read the full announcement](https://github.com/orgs/supabase/discussions/29260), but in the transition period, you can use both the current `anon` and `service_role` keys and the new publishable key with the form `sb_publishable_xxx` which will replace the older keys.

**The legacy keys will be deprecated shortly, so we strongly encourage switching to and using the new publishable and secret API keys**.

In most cases, you can get the correct key from [the Project's **Connect** dialog](https://supabase.com/dashboard/project/_?showConnect=true&connectTab=&framework=), but if you want a specific key, you can find all keys in [the API Keys section of a Project's Settings page](https://supabase.com/dashboard/project/_/settings/api-keys/):

**For new keys**, open the **API Keys** tab, if you don't have a publishable key already, click **Create new API Keys**, and copy the value from the **Publishable key** section.

TypeScriptFlutterSwiftPython

```
1
import { createClient } from '@supabase/supabase-js'
2

3
const supabase = createClient('https://<project>.supabase.co', '<anon_key or sb_publishable_key>')
```

### 3\. Create your first Channel [\#](https://supabase.com/docs/guides/realtime/getting_started\#3-create-your-first-channel)

Channels are the foundation of Realtime. Think of them as rooms where clients can communicate. Each channel is identified by a topic name and if they are public or private.

TypeScriptFlutterSwiftPython

```
1
// Create a channel with a descriptive topic name
2
const channel = supabase.channel('room:lobby:messages', {
3
  config: { private: true }, // Recommended for production
4
})
```

### 4\. Set up authorization [\#](https://supabase.com/docs/guides/realtime/getting_started\#4-set-up-authorization)

Since we're using a private channel, you need to create a basic RLS policy on the `realtime.messages` table to allow authenticated users to connect. Row Level Security (RLS) policies control who can access your Realtime channels based on user authentication and custom rules:

```
1
-- Allow authenticated users to receive broadcasts
2
CREATE POLICY "authenticated_users_can_receive" ON realtime.messages
3
  FOR SELECT TO authenticated USING (true);
4

5
-- Allow authenticated users to send broadcasts
6
CREATE POLICY "authenticated_users_can_send" ON realtime.messages
7
  FOR INSERT TO authenticated WITH CHECK (true);
```

### 5\. Send and receive messages [\#](https://supabase.com/docs/guides/realtime/getting_started\#5-send-and-receive-messages)

There are three main ways to send messages with Realtime:

#### 5.1 using client libraries [\#](https://supabase.com/docs/guides/realtime/getting_started\#51-using-client-libraries)

Send and receive messages using the Supabase client:

TypeScriptFlutterSwiftPython

```
1
// Listen for messages
2
channel
3
  .on('broadcast', { event: 'message_sent' }, (payload: { payload: any }) => {
4
    console.log('New message:', payload.payload)
5
  })
6
  .subscribe()
7

8
// Send a message
9
channel.send({
10
  type: 'broadcast',
11
  event: 'message_sent',
12
  payload: {
13
    text: 'Hello, world!',
14
    user: 'john_doe',
15
    timestamp: new Date().toISOString(),
16
  },
17
})
```

#### 5.2 using HTTP/REST API [\#](https://supabase.com/docs/guides/realtime/getting_started\#52-using-httprest-api)

Send messages via HTTP requests, perfect for server-side applications:

TypeScriptFlutterSwiftPython

```
1
// Send message via REST API
2
const response = await fetch(`https://<project>.supabase.co/rest/v1/rpc/broadcast`, {
3
  method: 'POST',
4
  headers: {
5
    'Content-Type': 'application/json',
6
    Authorization: `Bearer <your-service-role-key>`,
7
    apikey: '<your-service-role-key>',
8
  },
9
  body: JSON.stringify({
10
    topic: 'room:lobby:messages',
11
    event: 'message_sent',
12
    payload: {
13
      text: 'Hello from server!',
14
      user: 'system',
15
      timestamp: new Date().toISOString(),
16
    },
17
    private: true,
18
  }),
19
})
```

#### 5.3 using database triggers [\#](https://supabase.com/docs/guides/realtime/getting_started\#53-using-database-triggers)

Automatically broadcast database changes using triggers. Choose the approach that best fits your needs:

**Using `realtime.broadcast_changes` (Best for mirroring database changes)**

```
1
-- Create a trigger function for broadcasting database changes
2
CREATE OR REPLACE FUNCTION broadcast_message_changes()
3
RETURNS TRIGGER AS $$
4
BEGIN
5
  -- Broadcast to room-specific channel
6
  PERFORM realtime.broadcast_changes(
7
    'room:' || NEW.room_id::text || ':messages',
8
    TG_OP,
9
    TG_OP,
10
    TG_TABLE_NAME,
11
    TG_TABLE_SCHEMA,
12
    NEW,
13
    OLD
14
  );
15
  RETURN NULL;
16
END;
17
$$ LANGUAGE plpgsql SECURITY DEFINER;
18

19
-- Apply trigger to your messages table
20
CREATE TRIGGER messages_broadcast_trigger
21
  AFTER INSERT OR UPDATE OR DELETE ON messages
22
  FOR EACH ROW EXECUTE FUNCTION broadcast_message_changes();
```

**Using `realtime.send` (Best for custom notifications and filtered data)**

```
1
-- Create a trigger function for custom notifications
2
CREATE OR REPLACE FUNCTION notify_message_activity()
3
RETURNS TRIGGER AS $$
4
BEGIN
5
  -- Send custom notification when new message is created
6
  IF TG_OP = 'INSERT' THEN
7
    PERFORM realtime.send(
8
      jsonb_build_object(
9
        'message_id', NEW.id,
10
        'user_id', NEW.user_id,
11
        'room_id', NEW.room_id,
12
        'created_at', NEW.created_at
13
      ),
14
      'message_created',
15
      'room:' || NEW.room_id::text || ':notifications',
16
      true  -- private channel
17
    );
18
  END IF;
19

20
  RETURN NULL;
21
END;
22
$$ LANGUAGE plpgsql SECURITY DEFINER;
23

24
-- Apply trigger to your messages table
25
CREATE TRIGGER messages_notification_trigger
26
  AFTER INSERT ON messages
27
  FOR EACH ROW EXECUTE FUNCTION notify_message_activity();
```

- **`realtime.broadcast_changes`** sends the full database change with metadata
- **`realtime.send`** allows you to send custom payloads and control exactly what data is broadcast

## Essential best practices [\#](https://supabase.com/docs/guides/realtime/getting_started\#essential-best-practices)

### Use private channels [\#](https://supabase.com/docs/guides/realtime/getting_started\#use-private-channels)

Always use private channels for production applications to ensure proper security and authorization:

```
1
const channel = supabase.channel('room:123:messages', {
2
  config: { private: true },
3
})
```

### Follow naming conventions [\#](https://supabase.com/docs/guides/realtime/getting_started\#follow-naming-conventions)

**Channel Topics:** Use the pattern `scope:id:entity`

- `room:123:messages` \- Messages in room 123
- `game:456:moves` \- Game moves for game 456
- `user:789:notifications` \- Notifications for user 789

### Clean up subscriptions [\#](https://supabase.com/docs/guides/realtime/getting_started\#clean-up-subscriptions)

Always unsubscribe when you are done with a channel to ensure you free up resources:

TypeScriptFlutterSwiftPython

```
1
// React example
2
import { useEffect } from 'react'
3

4
useEffect(() => {
5
  const channel = supabase.channel('room:123:messages')
6

7
  return () => {
8
    supabase.removeChannel(channel)
9
  }
10
}, [])
```

## Choose the right feature [\#](https://supabase.com/docs/guides/realtime/getting_started\#choose-the-right-feature)

### When to use Broadcast [\#](https://supabase.com/docs/guides/realtime/getting_started\#when-to-use-broadcast)

- Real-time messaging and notifications
- Custom events and game state
- Database change notifications (with triggers)
- High-frequency updates (e.g. Cursor tracking)
- Most use cases

### When to use Presence [\#](https://supabase.com/docs/guides/realtime/getting_started\#when-to-use-presence)

- User online/offline status
- Active user counters
- Use minimally due to computational overhead

### When to use Postgres Changes [\#](https://supabase.com/docs/guides/realtime/getting_started\#when-to-use-postgres-changes)

- Quick testing and development
- Low amount of connected users

## Next steps [\#](https://supabase.com/docs/guides/realtime/getting_started\#next-steps)

Now that you understand the basics, dive deeper into each feature:

### Core features [\#](https://supabase.com/docs/guides/realtime/getting_started\#core-features)

- **[Broadcast](https://supabase.com/docs/guides/realtime/broadcast)** \- Learn about sending messages, database triggers, and REST API usage
- **[Presence](https://supabase.com/docs/guides/realtime/presence)** \- Implement user state tracking and online indicators
- **[Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)** \- Understanding database change listeners (consider migrating to Broadcast)

### Security & configuration [\#](https://supabase.com/docs/guides/realtime/getting_started\#security--configuration)

- **[Authorization](https://supabase.com/docs/guides/realtime/authorization)** \- Set up RLS policies for private channels
- **[Settings](https://supabase.com/docs/guides/realtime/settings)** \- Configure your Realtime instance for optimal performance

### Advanced topics [\#](https://supabase.com/docs/guides/realtime/getting_started\#advanced-topics)

- **[Architecture](https://supabase.com/docs/guides/realtime/architecture)** \- Understand how Realtime works under the hood
- **[Benchmarks](https://supabase.com/docs/guides/realtime/benchmarks)** \- Performance characteristics and scaling considerations
- **[Limits](https://supabase.com/docs/guides/realtime/limits)** \- Usage limits and best practices

### Integration guides [\#](https://supabase.com/docs/guides/realtime/getting_started\#integration-guides)

- **[Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs)** \- Build real-time Next.js applications
- **[User Presence](https://supabase.com/docs/guides/realtime/realtime-user-presence)** \- Implement user presence features
- **[Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)** \- Listen to database changes

### Framework examples [\#](https://supabase.com/docs/guides/realtime/getting_started\#framework-examples)

- **[Flutter Integration](https://supabase.com/docs/guides/realtime/realtime-listening-flutter)** \- Build real-time Flutter applications

Ready to build something amazing? Start with the [Broadcast guide](https://supabase.com/docs/guides/realtime/broadcast) to create your first real-time feature!

### Is this helpful?

NoYes

### AI Tools

Copy as Markdown [Ask ChatGPT](https://chatgpt.com/?hint=search&q=Read%20from%20https://supabase.com/docs/guides/realtime/getting_started%20so%20I%20can%20ask%20questions%20about%20its%20contents) [Ask Claude](https://claude.ai/new?q=Read%20from%20https://supabase.com/docs/guides/realtime/getting_started%20so%20I%20can%20ask%20questions%20about%20its%20contents)

### On this page

[Quick start](https://supabase.com/docs/guides/realtime/getting_started#quick-start) [1\. Install the client library](https://supabase.com/docs/guides/realtime/getting_started#1-install-the-client-library) [2\. Initialize the client](https://supabase.com/docs/guides/realtime/getting_started#2-initialize-the-client) [Get API details](https://supabase.com/docs/guides/realtime/getting_started#get-api-details) [3\. Create your first Channel](https://supabase.com/docs/guides/realtime/getting_started#3-create-your-first-channel) [4\. Set up authorization](https://supabase.com/docs/guides/realtime/getting_started#4-set-up-authorization) [5\. Send and receive messages](https://supabase.com/docs/guides/realtime/getting_started#5-send-and-receive-messages) [Essential best practices](https://supabase.com/docs/guides/realtime/getting_started#essential-best-practices) [Use private channels](https://supabase.com/docs/guides/realtime/getting_started#use-private-channels) [Follow naming conventions](https://supabase.com/docs/guides/realtime/getting_started#follow-naming-conventions) [Clean up subscriptions](https://supabase.com/docs/guides/realtime/getting_started#clean-up-subscriptions) [Choose the right feature](https://supabase.com/docs/guides/realtime/getting_started#choose-the-right-feature) [When to use Broadcast](https://supabase.com/docs/guides/realtime/getting_started#when-to-use-broadcast) [When to use Presence](https://supabase.com/docs/guides/realtime/getting_started#when-to-use-presence) [When to use Postgres Changes](https://supabase.com/docs/guides/realtime/getting_started#when-to-use-postgres-changes) [Next steps](https://supabase.com/docs/guides/realtime/getting_started#next-steps) [Core features](https://supabase.com/docs/guides/realtime/getting_started#core-features) [Security & configuration](https://supabase.com/docs/guides/realtime/getting_started#security--configuration) [Advanced topics](https://supabase.com/docs/guides/realtime/getting_started#advanced-topics) [Integration guides](https://supabase.com/docs/guides/realtime/getting_started#integration-guides) [Framework examples](https://supabase.com/docs/guides/realtime/getting_started#framework-examples)