using System.Text.Json;

namespace Cheddar.Counting;

public sealed class FileGlobalCounter : IGlobalCounter
{
    private readonly string _path;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private long? _count;

    public FileGlobalCounter(string path) => _path = path;

    public async Task<long> GetAsync(CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            return await LoadAsync(ct);
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<long> IncrementAsync(CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            var next = await LoadAsync(ct) + 1;
            await SaveAsync(next, ct);
            _count = next;
            return next;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task<long> LoadAsync(CancellationToken ct)
    {
        if (_count is { } cached) return cached;

        long loaded = 0;
        try
        {
            await using var stream = File.OpenRead(_path);
            loaded = await JsonSerializer.DeserializeAsync<long>(stream, cancellationToken: ct);
            if (loaded < 0) loaded = 0;
        }
        catch (Exception e) when (e is IOException or JsonException or UnauthorizedAccessException)
        {
            // Missing or corrupt file: start over rather than refuse to serve clicks.
        }

        _count = loaded;
        return loaded;
    }

    private async Task SaveAsync(long value, CancellationToken ct)
    {
        var dir = Path.GetDirectoryName(Path.GetFullPath(_path))!;
        Directory.CreateDirectory(dir);
        // Same-directory temp file so the move is an atomic rename.
        var temp = _path + ".tmp";
        await File.WriteAllTextAsync(temp, JsonSerializer.Serialize(value), ct);
        File.Move(temp, _path, overwrite: true);
    }
}
