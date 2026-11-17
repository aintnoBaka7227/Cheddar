namespace Cheddar.Counting.Tests;

public abstract class GlobalCounterContract
{
    protected abstract IGlobalCounter NewCounter(string store);

    private static string NewStore() => Guid.NewGuid().ToString("N");

    [Fact]
    public async Task Increments_persist_to_a_new_counter_on_the_same_store()
    {
        var store = NewStore();
        var first = NewCounter(store);
        await first.IncrementAsync();
        await first.IncrementAsync();

        var second = NewCounter(store);

        Assert.Equal(2, await second.GetAsync());
        Assert.Equal(3, await second.IncrementAsync());
    }

    [Fact]
    public async Task One_hundred_concurrent_increments_end_at_exactly_one_hundred()
    {
        var store = NewStore();
        var counter = NewCounter(store);

        var results = await Task.WhenAll(Enumerable.Range(0, 100).Select(_ => counter.IncrementAsync()));

        Assert.Equal(100, await counter.GetAsync());
        Assert.Equal(100, await NewCounter(store).GetAsync());
        Assert.Equal(Enumerable.Range(1, 100).Select(i => (long)i), results.Order());
    }

    [Fact]
    public async Task Missing_data_starts_at_zero()
    {
        Assert.Equal(0, await NewCounter(NewStore()).GetAsync());
    }
}
