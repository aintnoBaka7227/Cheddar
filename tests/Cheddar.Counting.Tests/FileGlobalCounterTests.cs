namespace Cheddar.Counting.Tests;

public sealed class FileGlobalCounterTests : GlobalCounterContract, IDisposable
{
    private readonly string _dir = Path.Combine(Path.GetTempPath(), "cheddar-tests-" + Guid.NewGuid().ToString("N"));
    private string FilePath => Path.Combine(_dir, "global-count.json");

    public void Dispose()
    {
        if (Directory.Exists(_dir)) Directory.Delete(_dir, recursive: true);
    }

    protected override IGlobalCounter NewCounter(string store) =>
        new FileGlobalCounter(Path.Combine(_dir, store, "global-count.json"));

    [Theory]
    [InlineData("not json")]
    [InlineData("")]
    [InlineData("{\"count\": 5}")]
    [InlineData("-7")]
    public async Task Corrupt_file_is_kept_aside_and_counting_restarts(string contents)
    {
        Directory.CreateDirectory(_dir);
        await File.WriteAllTextAsync(FilePath, contents);
        var counter = new FileGlobalCounter(FilePath);

        Assert.Equal(0, await counter.GetAsync());
        Assert.Equal(1, await counter.IncrementAsync());
        Assert.Equal(1, await new FileGlobalCounter(FilePath).GetAsync());

        var kept = Assert.Single(Directory.GetFiles(_dir, "global-count.json.corrupt-*"));
        Assert.Equal(contents, await File.ReadAllTextAsync(kept));
    }
}
