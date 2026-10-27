# Product pictures (not in git)

The database stores paths like:

```text
store/assets/catalog/Amazon.in _ ceiling fans/imgi_….jpg
```

Those files must sit on the API host here:

```text
server/catalog/catalog/<folder>/<file>
```

Staff uploads from the portal go under:

```text
server/catalog/catalog/staff/<productId>/
```

## Local

1. Copy the image tree from the VPS (or unzip `catalog.zip`) into `server/catalog/catalog/`.
2. Start the API from `server/` (`npm run dev`).
3. Open a product: `imageUrl` should be `http://localhost:5001/store/assets/catalog/…`.

## Live (VPS)

1. Upload the same `catalog/` tree onto the API server next to the running app (see [`docs/DEPLOY_VPS.md`](../../docs/DEPLOY_VPS.md)).
2. Set `PUBLIC_API_ORIGIN=https://<your-api-host>` in `server/.env`.
3. Do **not** commit these files. They stay on the VPS and in backups.

Mapping CSVs / spreadsheets in this folder are research only. The API does not read them.
