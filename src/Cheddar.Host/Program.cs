using Cheddar.Counting;
using Cheddar.Host.Components;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorComponents()
    .AddInteractiveWebAssemblyComponents();
builder.Services.AddCounting(Path.Combine(builder.Environment.ContentRootPath, "App_Data", "global-count.json"));

var app = builder.Build();

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

// Razor component endpoints only answer GET, so HEAD / would 404 for link checkers and probes.
// Rewrites before UseRouting so the GET endpoint matches.
app.Use((context, next) =>
{
    if (HttpMethods.IsHead(context.Request.Method) && context.Request.Path == "/")
    {
        context.Request.Method = HttpMethods.Get;
    }
    return next();
});

app.UseRouting();
app.UseAntiforgery();

app.MapStaticAssets();
app.MapCountingEndpoints();
app.MapRazorComponents<App>()
    .AddInteractiveWebAssemblyRenderMode()
    .AddAdditionalAssemblies(typeof(Cheddar.Host.Client._Imports).Assembly);

app.Run();
