# Ritning

A small floor-plan editor: walls, doors, windows, rooms with automatic area, and a library of furniture and devices.

This project is vibe coded.

## Run

```sh
pnpm install
pnpm db:push
pnpm dev
```

Or with Docker:

```sh
docker build -t ritning .
docker run -p 3000:3000 -v ritning-data:/data ritning
```
