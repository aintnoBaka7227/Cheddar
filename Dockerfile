FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Cheddar.slnx ./
COPY src/Cheddar.Host/Cheddar.Host.csproj src/Cheddar.Host/
COPY src/Cheddar.Host.Client/Cheddar.Host.Client.csproj src/Cheddar.Host.Client/
COPY src/Modules/Counting/Cheddar.Counting/Cheddar.Counting.csproj src/Modules/Counting/Cheddar.Counting/
RUN dotnet restore src/Cheddar.Host
COPY src/ src/
RUN dotnet publish src/Cheddar.Host -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
COPY public/ public/
ENV Assets__Path=/app/public
USER $APP_UID
CMD ["sh", "-c", "ASPNETCORE_HTTP_PORTS=${PORT:-8080} exec dotnet Cheddar.Host.dll"]
