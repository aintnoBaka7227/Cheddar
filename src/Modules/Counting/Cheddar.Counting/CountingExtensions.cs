using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Cheddar.Counting;

public sealed record CountResponse(long Count);

public sealed record CountingInfo(string Counter);

public static class CountingExtensions
{
    public static IServiceCollection AddCounting(this IServiceCollection services, IConfiguration config, string contentRoot)
    {
        var redis = config["Counting:Redis"];
        if (!string.IsNullOrWhiteSpace(redis))
        {
            var options = RedisConnection.Parse(redis);
            services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(options));
            services.AddSingleton<IGlobalCounter, RedisGlobalCounter>();
            services.AddSingleton(new CountingInfo("redis"));
        }
        else
        {
            var path = Path.GetFullPath(config["Counting:FilePath"] ?? Path.Combine("App_Data", "global-count.json"), contentRoot);
            services.AddSingleton<IGlobalCounter>(sp => new FileGlobalCounter(path, sp.GetRequiredService<ILogger<FileGlobalCounter>>()));
            services.AddSingleton(new CountingInfo("file"));
        }
        return services;
    }

    public static IEndpointRouteBuilder MapCountingEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/counts/global");

        group.MapGet("/", async (IGlobalCounter counter, CancellationToken ct) =>
            new CountResponse(await counter.GetAsync(ct)));

        group.MapPost("/increment", async (IGlobalCounter counter, CancellationToken ct) =>
            new CountResponse(await counter.IncrementAsync(ct)));

        return routes;
    }
}
