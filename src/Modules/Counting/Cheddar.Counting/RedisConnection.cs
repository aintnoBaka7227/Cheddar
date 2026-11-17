using StackExchange.Redis;

namespace Cheddar.Counting;

public static class RedisConnection
{
    public static ConfigurationOptions Parse(string connection)
    {
        // Parser exceptions can echo the input, so they are replaced with a message that never carries the secret.
        try
        {
            var options = IsUrl(connection) ? FromUrl(connection) : ConfigurationOptions.Parse(connection);
            options.AbortOnConnectFail = false;
            return options;
        }
        catch (Exception)
        {
            throw new ArgumentException("Counting:Redis is not a valid Redis connection string or redis(s):// URL.");
        }
    }

    private static bool IsUrl(string s) =>
        s.StartsWith("redis://", StringComparison.OrdinalIgnoreCase) || s.StartsWith("rediss://", StringComparison.OrdinalIgnoreCase);

    private static ConfigurationOptions FromUrl(string url)
    {
        var uri = new Uri(url);
        // Upstash accepts only TLS, yet its own redis-cli snippet shows a redis:// URL, so a
        // copied one-s URL would silently time out on every call.
        var options = new ConfigurationOptions
        {
            Ssl = uri.Scheme.Equals("rediss", StringComparison.OrdinalIgnoreCase)
                || uri.Host.EndsWith(".upstash.io", StringComparison.OrdinalIgnoreCase),
        };
        options.EndPoints.Add(uri.Host, uri.Port > 0 ? uri.Port : 6379);
        if (uri.UserInfo.Length > 0)
        {
            var parts = uri.UserInfo.Split(':', 2);
            if (parts.Length == 2)
            {
                options.User = Uri.UnescapeDataString(parts[0]);
                options.Password = Uri.UnescapeDataString(parts[1]);
            }
            else
            {
                options.Password = Uri.UnescapeDataString(parts[0]);
            }
        }
        return options;
    }
}
