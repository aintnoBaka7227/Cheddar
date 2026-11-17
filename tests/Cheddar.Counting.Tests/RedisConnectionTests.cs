namespace Cheddar.Counting.Tests;

public sealed class RedisConnectionTests
{
    [Fact]
    public void Rediss_url_enables_tls_and_reads_user_password_host_and_port()
    {
        var options = RedisConnection.Parse("rediss://default:s3cret@eager-cat-1234.upstash.io:6380");

        Assert.True(options.Ssl);
        Assert.Equal("default", options.User);
        Assert.Equal("s3cret", options.Password);
        AssertEndpoint(options, "eager-cat-1234.upstash.io", 6380);
        Assert.False(options.AbortOnConnectFail);
    }

    [Fact]
    public void Redis_url_leaves_tls_off_and_defaults_the_port()
    {
        var options = RedisConnection.Parse("redis://default:pw@localhost");

        Assert.False(options.Ssl);
        AssertEndpoint(options, "localhost", 6379);
    }

    [Fact]
    public void Upstash_host_uses_tls_even_from_a_one_s_redis_url()
    {
        var options = RedisConnection.Parse("redis://default:pw@eager-cat-1234.upstash.io:6379");

        Assert.True(options.Ssl);
        AssertEndpoint(options, "eager-cat-1234.upstash.io", 6379);
    }

    [Fact]
    public void Url_password_is_percent_decoded()
    {
        Assert.Equal("p@ss/word", RedisConnection.Parse("rediss://default:p%40ss%2Fword@host:6379").Password);
    }

    [Fact]
    public void Native_string_passes_through()
    {
        var options = RedisConnection.Parse("myhost:6380,password=abc,ssl=true");

        Assert.True(options.Ssl);
        Assert.Equal("abc", options.Password);
        AssertEndpoint(options, "myhost", 6380);
        Assert.False(options.AbortOnConnectFail);
    }

    [Theory]
    [InlineData("rediss://default:hunter2secret@host:notaport")]
    [InlineData("myhost:6380,password=hunter2secret,ssl=maybe")]
    [InlineData("password=hunter2secret,bogus=1")]
    public void Parse_error_message_does_not_contain_the_password(string connection)
    {
        var e = Assert.ThrowsAny<Exception>(() => RedisConnection.Parse(connection));

        Assert.DoesNotContain("hunter2secret", e.ToString());
    }

    private static void AssertEndpoint(StackExchange.Redis.ConfigurationOptions options, string host, int port)
    {
        var endpoint = Assert.IsType<System.Net.DnsEndPoint>(options.EndPoints.Single());
        Assert.Equal(host, endpoint.Host);
        Assert.Equal(port, endpoint.Port);
    }
}
