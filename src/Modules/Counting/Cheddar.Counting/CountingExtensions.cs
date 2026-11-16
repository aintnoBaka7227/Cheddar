using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Cheddar.Counting;

public sealed record CountResponse(long Count);

public static class CountingExtensions
{
    public static IServiceCollection AddCounting(this IServiceCollection services, string filePath) =>
        services.AddSingleton<IGlobalCounter>(sp => new FileGlobalCounter(filePath, sp.GetRequiredService<ILogger<FileGlobalCounter>>()));

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
