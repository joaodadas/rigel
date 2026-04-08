[Skip to main content](https://upstash.com/docs/redis/sdks/ts/commands/overview#content-area)

[Upstash Documentation home page![light logo](https://mintlify.s3.us-west-1.amazonaws.com/upstash/logo/upstash-white-bg.svg)![dark logo](https://mintlify.s3.us-west-1.amazonaws.com/upstash/logo/upstash-dark-bg.svg)](https://upstash.com/docs)

Search...

Ctrl KAsk AI

Search...

Navigation

Commands

Overview

[Overview](https://upstash.com/docs/introduction) [Redis](https://upstash.com/docs/redis/overall/getstarted) [Vector](https://upstash.com/docs/vector/overall/getstarted) [QStash](https://upstash.com/docs/qstash/overall/getstarted) [Workflow](https://upstash.com/docs/workflow/getstarted) [Search](https://upstash.com/docs/search/overall/getstarted) [Box](https://upstash.com/docs/box/overall/quickstart) [Realtime](https://upstash.com/docs/realtime/overall/quickstart) [Developer API](https://upstash.com/docs/devops/developer-api/introduction)

Auth

[**ECHO** \\
\\
Echo the given string.](https://upstash.com/docs/redis/sdks/ts/commands/auth/echo)

[**PING** \\
\\
Ping the server.](https://upstash.com/docs/redis/sdks/ts/commands/auth/ping)

Connection

[**CLIENT SETINFO** \\
\\
Set client library name and version information.](https://upstash.com/docs/redis/sdks/ts/commands/connection/client_setinfo)

Bitmap

[**BITCOUNT** \\
\\
Count set bits in a string.](https://upstash.com/docs/redis/sdks/ts/commands/bitmap/bitcount)

[**BITOP** \\
\\
Perform bitwise operations between strings (includes DIFF, DIFF1, ANDOR, ONE).](https://upstash.com/docs/redis/sdks/ts/commands/bitmap/bitop)

[**BITPOS** \\
\\
Find first bit set or clear in a string.](https://upstash.com/docs/redis/sdks/ts/commands/bitmap/bitpos)

[**GETBIT** \\
\\
Returns the bit value at offset in the string value stored at key.](https://upstash.com/docs/redis/sdks/ts/commands/bitmap/getbit)

[**SETBIT** \\
\\
Sets or clears the bit at offset in the string value stored at key.](https://upstash.com/docs/redis/sdks/ts/commands/bitmap/setbit)

Functions

[**FCALL** \\
\\
Invoke a redis function.](https://upstash.com/docs/redis/sdks/ts/commands/functions/call)

[**FCALL\_RO** \\
\\
Invoke a read-only redis function.](https://upstash.com/docs/redis/sdks/ts/commands/functions/call_ro)

[**FUNCTION DELETE** \\
\\
Delete a library and all its functions.](https://upstash.com/docs/redis/sdks/ts/commands/functions/delete)

[**FUNCTION FLUSH** \\
\\
Delete all the libraries and functions.](https://upstash.com/docs/redis/sdks/ts/commands/functions/flush)

[**FUNCTION LIST** \\
\\
List information about all the libraries.](https://upstash.com/docs/redis/sdks/ts/commands/functions/list)

[**FUNCTION LOAD** \\
\\
Load a library to Redis.](https://upstash.com/docs/redis/sdks/ts/commands/functions/load)

[**FUNCTION STATS** \\
\\
Returns the number of registered functions and libraries.](https://upstash.com/docs/redis/sdks/ts/commands/functions/stats)

Generic

[**DEL** \\
\\
Delete one or multiple keys.](https://upstash.com/docs/redis/sdks/ts/commands/generic/del)

[**EXISTS** \\
\\
Determine if a key exists.](https://upstash.com/docs/redis/sdks/ts/commands/generic/exists)

[**EXPIRE** \\
\\
Set a key’s time to live in seconds.](https://upstash.com/docs/redis/sdks/ts/commands/generic/expire)

[**EXPIREAT** \\
\\
Set the expiration for a key as a UNIX timestamp.](https://upstash.com/docs/redis/sdks/ts/commands/generic/expireat)

[**KEYS** \\
\\
Find all keys matching the given pattern.](https://upstash.com/docs/redis/sdks/ts/commands/generic/keys)

[**PERSIST** \\
\\
Remove the expiration from a key.](https://upstash.com/docs/redis/sdks/ts/commands/generic/persist)

[**PEXPIRE** \\
\\
Set a key’s time to live in milliseconds.](https://upstash.com/docs/redis/sdks/ts/commands/generic/pexpire)

[**PEXPIREAT** \\
\\
Set the expiration for a key as a UNIX timestamp specified in milliseconds.](https://upstash.com/docs/redis/sdks/ts/commands/generic/pexpireat)

[**PTTL** \\
\\
Get the time to live for a key in milliseconds.](https://upstash.com/docs/redis/sdks/ts/commands/generic/pttl)

[**RANDOMKEY** \\
\\
Return a random key from the keyspace.](https://upstash.com/docs/redis/sdks/ts/commands/generic/randomkey)

[**RENAME** \\
\\
Rename a key.](https://upstash.com/docs/redis/sdks/ts/commands/generic/rename)

[**RENAMENX** \\
\\
Rename a key, only if the new key does not exist.](https://upstash.com/docs/redis/sdks/ts/commands/generic/renamenx)

[**SCAN** \\
\\
Incrementally iterate the keys space.](https://upstash.com/docs/redis/sdks/ts/commands/generic/scan)

[**TOUCH** \\
\\
Alters the last access time of a key(s). Returns the number of existing keys specified.](https://upstash.com/docs/redis/sdks/ts/commands/generic/touch)

[**TTL** \\
\\
Get the time to live for a key.](https://upstash.com/docs/redis/sdks/ts/commands/generic/ttl)

[**TYPE** \\
\\
Determine the type stored at key.](https://upstash.com/docs/redis/sdks/ts/commands/generic/type)

[**UNLINK** \\
\\
Delete one or more keys.](https://upstash.com/docs/redis/sdks/ts/commands/generic/unlink)

Hash

[**HDEL**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hdel)

[**HEXISTS**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hexists)

[**HEXPIRE**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hexpire)

[**HEXPIREAT**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hexpireat)

[**HEXPIRETIME**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hexpiretime)

[**HGET**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hget)

[**HGETALL**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hgetall)

[**HGETDEL** \\
\\
Get and delete hash fields atomically.](https://upstash.com/docs/redis/sdks/ts/commands/hash/hgetdel)

[**HGETEX** \\
\\
Get hash fields with expiration support.](https://upstash.com/docs/redis/sdks/ts/commands/hash/hgetex)

[**HINCRBY**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hincrby)

[**HINCRBYFLOAT**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hincrbyfloat)

[**HKEYS**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hkeys)

[**HLEN**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hlen)

[**HMGET**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hmget)

[**HPERSIST**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hpersist)

[**HPEXPIRE**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hpexpire)

[**HPEXPIREAT**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hpexpireat)

[**HPEXPIRETIME**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hpexpiretime)

[**HPTTL**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hpttl)

[**HRANDFIELD**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hrandfield)

[**HSCAN**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hscan)

[**HSET**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hset)

[**HSETEX** \\
\\
Set hash fields with expiration support.](https://upstash.com/docs/redis/sdks/ts/commands/hash/hsetex)

[**HSETNX**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hsetnx)

[**HSTRLEN**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hstrlen)

[**HTTL**](https://upstash.com/docs/redis/sdks/ts/commands/hash/httl)

[**HVALS**](https://upstash.com/docs/redis/sdks/ts/commands/hash/hvals)

JSON

[**ARRAPPEND**](https://upstash.com/docs/redis/sdks/ts/commands/json/arrappend)

[**ARRINDEX**](https://upstash.com/docs/redis/sdks/ts/commands/json/arrindex)

[**ARRINSERT**](https://upstash.com/docs/redis/sdks/ts/commands/json/arrinsert)

[**ARRLEN**](https://upstash.com/docs/redis/sdks/ts/commands/json/arrlen)

[**ARRPOP**](https://upstash.com/docs/redis/sdks/ts/commands/json/arrpop)

[**ARRTRIM**](https://upstash.com/docs/redis/sdks/ts/commands/json/arrtrim)

[**CLEAR**](https://upstash.com/docs/redis/sdks/ts/commands/json/clear)

[**DEL**](https://upstash.com/docs/redis/sdks/ts/commands/json/del)

[**FORGET**](https://upstash.com/docs/redis/sdks/ts/commands/json/forget)

[**GET**](https://upstash.com/docs/redis/sdks/ts/commands/json/get)

[**MGET**](https://upstash.com/docs/redis/sdks/ts/commands/json/mget)

[**MSET**](https://upstash.com/docs/redis/sdks/ts/commands/json/mset)

[**MERGE**](https://upstash.com/docs/redis/sdks/ts/commands/json/merge)

[**NUMINCRBY**](https://upstash.com/docs/redis/sdks/ts/commands/json/numincrby)

[**NUMMULTBY**](https://upstash.com/docs/redis/sdks/ts/commands/json/nummultby)

[**OBJKEYS**](https://upstash.com/docs/redis/sdks/ts/commands/json/objkeys)

[**OBJLEN**](https://upstash.com/docs/redis/sdks/ts/commands/json/objlen)

[**SET**](https://upstash.com/docs/redis/sdks/ts/commands/json/set)

[**STRAPPEND**](https://upstash.com/docs/redis/sdks/ts/commands/json/strappend)

[**STRLEN**](https://upstash.com/docs/redis/sdks/ts/commands/json/strlen)

[**TOGGLE**](https://upstash.com/docs/redis/sdks/ts/commands/json/toggle)

[**TYPE**](https://upstash.com/docs/redis/sdks/ts/commands/json/type)

List

[**LINDEX**](https://upstash.com/docs/redis/sdks/ts/commands/list/lindex)

[**LINSERT**](https://upstash.com/docs/redis/sdks/ts/commands/list/linsert)

[**LLEN**](https://upstash.com/docs/redis/sdks/ts/commands/list/llen)

[**LMOVE**](https://upstash.com/docs/redis/sdks/ts/commands/list/lmove)

[**LPOP**](https://upstash.com/docs/redis/sdks/ts/commands/list/lpop)

[**LPOS**](https://upstash.com/docs/redis/sdks/ts/commands/list/lpos)

[**LPUSH**](https://upstash.com/docs/redis/sdks/ts/commands/list/lpush)

[**LPUSHX**](https://upstash.com/docs/redis/sdks/ts/commands/list/lpushx)

[**LRANGE**](https://upstash.com/docs/redis/sdks/ts/commands/list/lrange)

[**LREM**](https://upstash.com/docs/redis/sdks/ts/commands/list/lrem)

[**LSET**](https://upstash.com/docs/redis/sdks/ts/commands/list/lset)

[**LTRIM**](https://upstash.com/docs/redis/sdks/ts/commands/list/ltrim)

[**RPOP**](https://upstash.com/docs/redis/sdks/ts/commands/list/rpop)

[**RPUSH**](https://upstash.com/docs/redis/sdks/ts/commands/list/rpush)

[**RPUSHX**](https://upstash.com/docs/redis/sdks/ts/commands/list/rpushx)

PubSub

[**PUBLISH** \\
\\
Publish messages to many clients](https://upstash.com/docs/redis/sdks/ts/commands/pubsub/publish)

Scripts

[**EVAL**](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval)

[**EVAL\_RO**](https://upstash.com/docs/redis/sdks/ts/commands/scripts/eval_ro)

[**EVALSHA**](https://upstash.com/docs/redis/sdks/ts/commands/scripts/evalsha)

[**EVALSHA\_RO**](https://upstash.com/docs/redis/sdks/ts/commands/scripts/evalsha_ro)

[**SCRIPT EXISTS**](https://upstash.com/docs/redis/sdks/ts/commands/scripts/script_exists)

[**SCRIPT FLUSH**](https://upstash.com/docs/redis/sdks/ts/commands/scripts/script_flush)

[**SCRIPT LOAD**](https://upstash.com/docs/redis/sdks/ts/commands/scripts/script_load)

Server

[**DBSIZE**](https://upstash.com/docs/redis/sdks/ts/commands/server/dbsize)

[**FLUSHALL**](https://upstash.com/docs/redis/sdks/ts/commands/server/flushall)

[**FLUSHDB**](https://upstash.com/docs/redis/sdks/ts/commands/server/flushdb)

Set

[**SADD**](https://upstash.com/docs/redis/sdks/ts/commands/set/sadd)

[**SCARD**](https://upstash.com/docs/redis/sdks/ts/commands/set/scard)

[**SDIFF**](https://upstash.com/docs/redis/sdks/ts/commands/set/sdiff)

[**SDIFFSTORE**](https://upstash.com/docs/redis/sdks/ts/commands/set/sdiffstore)

[**SINTER**](https://upstash.com/docs/redis/sdks/ts/commands/set/sinter)

[**SINTERSTORE**](https://upstash.com/docs/redis/sdks/ts/commands/set/sinterstore)

[**SISMEMBER**](https://upstash.com/docs/redis/sdks/ts/commands/set/sismember)

[**SMEMBERS**](https://upstash.com/docs/redis/sdks/ts/commands/set/smembers)

[**SMISMEMBER**](https://upstash.com/docs/redis/sdks/ts/commands/set/smismember)

[**SMOVE**](https://upstash.com/docs/redis/sdks/ts/commands/set/smove)

[**SPOP**](https://upstash.com/docs/redis/sdks/ts/commands/set/spop)

[**SRANDMEMBER**](https://upstash.com/docs/redis/sdks/ts/commands/set/srandmember)

[**SREM**](https://upstash.com/docs/redis/sdks/ts/commands/set/srem)

[**SSCAN**](https://upstash.com/docs/redis/sdks/ts/commands/set/sscan)

[**SUNION**](https://upstash.com/docs/redis/sdks/ts/commands/set/sunion)

[**SUNIONSTORE**](https://upstash.com/docs/redis/sdks/ts/commands/set/sunionstore)

Sorted Set

[**ZADD**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zadd)

[**ZCARD**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zcard)

[**ZCOUNT**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zcount)

[**ZDIFFSTORE**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zdiffstore)

[**ZINCRBY**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zincrby)

[**ZINTERSTORE**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zinterstore)

[**ZLEXCOUNT**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zlexcount)

[**ZMSCORE**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zmscore)

[**ZPOPMAX**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zpopmax)

[**ZPOPMIN**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zpopmin)

[**ZRANGE**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zrange)

[**ZRANK**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zrank)

[**ZREM**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zrem)

[**ZREMRANGEBYLEX**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zremrangebylex)

[**ZREMRANGEBYRANK**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zremrangebyrank)

[**ZREMRANGEBYSCORE**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zremrangebyscore)

[**ZREVRANK**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zrevrank)

[**ZSCAN**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zscan)

[**ZSCORE**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zscore)

[**ZUNIONSTORE**](https://upstash.com/docs/redis/sdks/ts/commands/zset/zunionstore)

Stream

[**XADD** \\
\\
Appends a new entry to a stream.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xadd)

[**XRANGE** \\
\\
Return a range of elements in a stream, with IDs matching the specified IDs interval.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xrange)

String

[**APPEND** \\
\\
Append a value to a string stored at key.](https://upstash.com/docs/redis/sdks/ts/commands/string/append)

[**DECR** \\
\\
Decrement the integer value of a key by one.](https://upstash.com/docs/redis/sdks/ts/commands/string/decr)

[**DECRBY** \\
\\
Decrement the integer value of a key by the given number.](https://upstash.com/docs/redis/sdks/ts/commands/string/decrby)

[**GET** \\
\\
Get the value of a key.](https://upstash.com/docs/redis/sdks/ts/commands/string/get)

[**GETDEL** \\
\\
Get the value of a key and delete the key.](https://upstash.com/docs/redis/sdks/ts/commands/string/getdel)

[**GETRANGE** \\
\\
Get a substring of the string stored at a key.](https://upstash.com/docs/redis/sdks/ts/commands/string/getrange)

[**GETSET** \\
\\
Set the string value of a key and return its old value.](https://upstash.com/docs/redis/sdks/ts/commands/string/getset)

[**INCR** \\
\\
Increment the integer value of a key by one.](https://upstash.com/docs/redis/sdks/ts/commands/string/incr)

[**INCRBY** \\
\\
Increment the integer value of a key by the given amount.](https://upstash.com/docs/redis/sdks/ts/commands/string/incrby)

[**INCRBYFLOAT** \\
\\
Increment the float value of a key by the given amount.](https://upstash.com/docs/redis/sdks/ts/commands/string/incrbyfloat)

[**MGET** \\
\\
Get the values of all the given keys.](https://upstash.com/docs/redis/sdks/ts/commands/string/mget)

[**MSET** \\
\\
Set multiple keys to multiple values.](https://upstash.com/docs/redis/sdks/ts/commands/string/mset)

[**MSETNX** \\
\\
Set multiple keys to multiple values, only if none of the keys exist.](https://upstash.com/docs/redis/sdks/ts/commands/string/msetnx)

[**SET** \\
\\
Set the string value of a key.](https://upstash.com/docs/redis/sdks/ts/commands/string/set)

[**SETRANGE** \\
\\
Overwrite part of a string at key starting at the specified offset.](https://upstash.com/docs/redis/sdks/ts/commands/string/setrange)

[**STRLEN** \\
\\
Get the length of the value stored in a key.](https://upstash.com/docs/redis/sdks/ts/commands/string/strlen)

Stream

[**XACK** \\
\\
Acknowledge one or multiple messages as processed for a consumer group.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xack)

[**XACKDEL** \\
\\
Acknowledge and delete stream entries atomically.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xackdel)

[**XADD** \\
\\
Append a new entry to a stream (supports auto sequence numbers).](https://upstash.com/docs/redis/sdks/ts/commands/stream/xadd)

[**XAUTOCLAIM** \\
\\
Transfer ownership of pending messages to another consumer automatically.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xautoclaim)

[**XCLAIM** \\
\\
Transfer ownership of pending messages to another consumer.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xclaim)

[**XDEL** \\
\\
Remove one or multiple entries from a stream.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xdel)

[**XDELEX** \\
\\
Extended delete for streams with reference control.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xdelex)

[**XGROUP** \\
\\
Manage consumer groups for Redis streams.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xgroup)

[**XINFO** \\
\\
Get information about streams, consumer groups, and consumers.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xinfo)

[**XLEN** \\
\\
Get the number of entries in a stream.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xlen)

[**XPENDING** \\
\\
Get information about pending messages in a consumer group.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xpending)

[**XRANGE** \\
\\
Get entries from a stream within a range of IDs.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xrange)

[**XREAD** \\
\\
Read data from one or multiple streams.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xread)

[**XREADGROUP** \\
\\
Read data from streams as part of a consumer group.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xreadgroup)

[**XREVRANGE** \\
\\
Get entries from a stream within a range of IDs in reverse order.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xrevrange)

[**XTRIM** \\
\\
Trim a stream to a specified size.](https://upstash.com/docs/redis/sdks/ts/commands/stream/xtrim)

Transactions

[**TRANSACTION** \\
\\
Run multiple commands in a transaction.](https://upstash.com/docs/redis/sdks/ts/commands/transaction)

Was this page helpful?

YesNo

[Suggest edits](https://github.com/upstash/docs/edit/main/redis/sdks/ts/commands/overview.mdx) [Raise issue](https://github.com/upstash/docs/issues/new?title=Issue%20on%20docs&body=Path:%20/redis/sdks/ts/commands/overview)

[Get Started](https://upstash.com/docs/redis/sdks/ts/getstarted) [ECHO](https://upstash.com/docs/redis/sdks/ts/commands/auth/echo)

Ctrl+I

Assistant

Responses are generated using AI and may contain mistakes.