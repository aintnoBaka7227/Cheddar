using StackExchange.Redis;

namespace Cheddar.Counting;

public sealed class RedisGlobalCounter(IConnectionMultiplexer redis, string key = RedisGlobalCounter.DefaultKey) : IGlobalCounter
{
    public const string DefaultKey = "cheddar:global-count";

    public async Task<long> GetAsync(CancellationToken ct = default)
    {
        var value = await redis.GetDatabase().StringGetAsync(key).WaitAsync(ct);
        return value.HasValue ? (long)value : 0;
    }

    public Task<long> IncrementAsync(CancellationToken ct = default) =>
        redis.GetDatabase().StringIncrementAsync(key).WaitAsync(ct);
}
