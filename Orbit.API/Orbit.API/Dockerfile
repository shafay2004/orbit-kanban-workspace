FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 10000
ENV ASPNETCORE_URLS=http://+:10000

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["Orbit.API.csproj", "./"]
RUN dotnet restore "Orbit.API.csproj"
COPY . .
RUN dotnet build "Orbit.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Orbit.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Orbit.API.dll"]
