using Cheddar.Counting;

namespace Cheddar.Counting.Tests;

public sealed class GlobalCounterTests : IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "cheddar-tests-" + Guid.NewGuid().ToString("N"));
    private string FilePath => Path.Combine(_dir, "global-count.json");

    public void Dispose()
    {
        if (Directory.Exists(_dir)) Directory.Delete(_dir, recursive: true);
    }

    [Fact]
    public async Task Increments_persist_to_a_new_counter_on_the_same_file()
    {
        var first = new FileGlobalCounter(FilePath);
        await first.IncrementAsync();
        await first.IncrementAsync();

        var second = new FileGlobalCounter(FilePath);

        Assert.Equal(2, await second.GetAsync());
        Assert.Equal(3, await second.IncrementAsync());
    }

    [Fact]
    public async Task One_hundred_concurrent_increments_end_at_exactly_one_hundred()
    {
        var counter = new FileGlobalCounter(FilePath);

        var results = await Task.WhenAll(Enumerable.Range(0, 100).Select(_ => counter.IncrementAsync()));

        Assert.Equal(100, await counter.GetAsync());
        Assert.Equal(100, await new FileGlobalCounter(FilePath).GetAsync());
        Assert.Equal(Enumerable.Range(1, 100).Select(i => (long)i), results.Order());
    }

    [Fact]
    public async Task Missing_file_starts_at_zero()
    {
        Assert.Equal(0, await new FileGlobalCounter(FilePath).GetAsync());
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("")]
    [InlineData("{\"count\": 5}")]
    [InlineData("-7")]
    public async Task Corrupt_file_starts_at_zero_and_recovers(string contents)
    {
        Directory.CreateDirectory(_dir);
        await File.WriteAllTextAsync(FilePath, contents);
        var counter = new FileGlobalCounter(FilePath);

        Assert.Equal(0, await counter.GetAsync());
        Assert.Equal(1, await counter.IncrementAsync());
        Assert.Equal(1, await new FileGlobalCounter(FilePath).GetAsync());
    }
}
