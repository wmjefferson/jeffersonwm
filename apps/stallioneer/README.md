# Stallioneer

Self-hosted personal library inventory for Windows server use. The first milestone is an ASP.NET Core web app with local SQLite storage, account login, ISBN lookup through Open Library, quantity-based inventory, search, and editable book records.

## Current Stack

- ASP.NET Core Razor Pages on .NET 10
- SQLite through Entity Framework Core
- ASP.NET Core Identity for multiple accounts
- Open Library ISBN metadata lookup with Google Books fallback
- Managed tags and locations

SQLite keeps the project free to run on a Windows 10 home server. The data model is kept behind Entity Framework so PostgreSQL can be added later if a hosting option becomes available.

## Run Locally

```powershell
dotnet tool restore
dotnet tool run dotnet-ef database update --project src/LibraryScanner.Web/LibraryScanner.Web.csproj
dotnet run --project src/LibraryScanner.Web/LibraryScanner.Web.csproj --urls http://localhost:5107
```

Open:

```text
http://localhost:5107
```

Register a local account, then use Inventory > Add book.

## Windows Server Notes

For a normal Windows 10 server install, use the .NET 10 Hosting Bundle from Microsoft, then publish the app and run it behind IIS, Caddy, Nginx, or an existing reverse proxy.

For a no-runtime deployment, publish self-contained:

```powershell
dotnet publish src/LibraryScanner.Web/LibraryScanner.Web.csproj -c Release -r win-x64 --self-contained true -o publish
```

The production database file should live in a backed-up server folder, not inside the source repo.

## First Milestone Scope

- Account registration and login
- ISBN-10 or ISBN-13 entry
- Open Library metadata lookup
- Google Books fallback lookup
- Manual metadata correction
- Quantity tracking for duplicates
- Location, condition, status, and notes
- Tags with inline creation and a management page
- Managed locations with inline creation and a management page
- Additional metadata fields: description, page count, categories, language, and source URL
- Inventory search
- Inventory event history in the database

## Next Milestones

- Admin/user role management
- CSV export/import
- Android API endpoints and scanner app
- Backup/restore scripts
- Remote-access deployment guide for the existing server setup
