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
        _count = await ReadFileAsync(ct);
        return _count.Value;
    }

    private async Task<long> ReadFileAsync(CancellationToken ct)
    {
        string text;
        try
        {
            text = await File.ReadAllTextAsync(_path, ct);
        }
        catch (Exception e) when (e is FileNotFoundException or DirectoryNotFoundException)
        {
            return 0;
        }

        try
        {
            var count = JsonSerializer.Deserialize<long>(text);
            if (count >= 0) return count;
        }
        catch (JsonException)
        {
        }

        // The total must never silently reset, so an unreadable file is kept for recovery, not overwritten.
        File.Move(_path, $"{_path}.corrupt-{DateTime.UtcNow:yyyyMMddHHmmss}", overwrite: true);
        return 0;
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
