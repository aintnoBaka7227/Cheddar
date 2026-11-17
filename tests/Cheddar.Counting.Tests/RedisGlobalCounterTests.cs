using StackExchange.Redis;
using Testcontainers.Redis;

namespace Cheddar.Counting.Tests;

public sealed class RedisFixture : IAsyncLifetime
{
    private readonly RedisContainer _container = new RedisBuilder("redis:7-alpine").Build();

    public IConnectionMultiplexer Redis { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
        Redis = await ConnectionMultiplexer.ConnectAsync(_container.GetConnectionString());
    }

    public async Task DisposeAsync()
    {
        await Redis.DisposeAsync();
        await _container.DisposeAsync();
    }
}

public sealed class RedisGlobalCounterTests(RedisFixture fixture) : GlobalCounterContract, IClassFixture<RedisFixture>
{
    protected override IGlobalCounter NewCounter(string store) => new RedisGlobalCounter(fixture.Redis, "test:" + store);
}
