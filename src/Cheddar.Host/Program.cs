using Cheddar.Counting;
using Cheddar.Host.Components;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorComponents()
    .AddInteractiveWebAssemblyComponents();
builder.Services.AddCounting(builder.Configuration, builder.Environment.ContentRootPath);

var app = builder.Build();

app.Logger.LogInformation("Global counter: {Counter}", app.Services.GetRequiredService<CountingInfo>().Counter);

if (app.Environment.IsDevelopment())
{
    app.UseWebAssemblyDebugging();
}

var assetsDir = Path.GetFullPath(
    builder.Configuration["Assets:Path"] ?? throw new InvalidOperationException("Assets:Path is not configured."),
    app.Environment.ContentRootPath);
var contentTypes = new FileExtensionContentTypeProvider();
contentTypes.Mappings[".m4a"] = "audio/mp4";
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(assetsDir),
    RequestPath = "/assets",
    ContentTypeProvider = contentTypes,
});

app.UseRouting();
app.UseAntiforgery();

app.MapStaticAssets();
app.MapCountingEndpoints();
app.MapGet("/healthz", (CountingInfo counting) => new
{
    status = "ok",
    commit = Environment.GetEnvironmentVariable("RENDER_GIT_COMMIT"),
    counter = counting.Counter,
});
app.MapRazorComponents<App>()
    .AddInteractiveWebAssemblyRenderMode()
    .AddAdditionalAssemblies(typeof(Cheddar.Host.Client._Imports).Assembly);

app.Run();
