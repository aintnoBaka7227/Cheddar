namespace Cheddar.Counting;

public interface IGlobalCounter
{
    Task<long> GetAsync(CancellationToken ct = default);

    Task<long> IncrementAsync(CancellationToken ct = default);
}
