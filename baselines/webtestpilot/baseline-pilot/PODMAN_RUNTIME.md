# Podman runtime verification

Captured 2026-08-18T22:30:29Z on Darwin arm64.

## 1. `podman machine`

```
NAME                     VM TYPE     CREATED         LAST UP            CPUS        MEMORY      DISK SIZE
podman-machine-default*  applehv     11 minutes ago  Currently running  4           8GiB        60GiB
```

## 2. `podman info`

```
arch:     arm64
os:       linux
version:  6.1.0
rootless: true
runtime:  crun
provider: applehv
```

## 3. `podman compose`

```
>>>> Executing external compose provider "/opt/homebrew/bin/podman-compose". Please see podman-compose(1) for how to disable this message. <<<<

podman version 6.1.0
podman-compose version 1.6.0
```

## 4. amd64 emulation (BookStack image is amd64-only)

The VM is arm64, so `solidnerd/bookstack:25.2.1` (amd64-only, and hard-pinned
`--platform=linux/amd64` in the Dockerfile) runs under emulation. Both platforms
resolve, requested explicitly so a cached image of the other arch cannot mask the
result:

```
$ podman run --rm --platform linux/arm64 alpine uname -m  -> aarch64
$ podman run --rm --platform linux/amd64 alpine uname -m  -> x86_64
```

Note: BookStack's `db` service (`mysql:8.4`) carries no platform pin, so it runs
native arm64 while the app container runs emulated amd64. Same MySQL version and
same seed data as upstream; the compose files were not modified.

## 5. BookStack under CONTAINER_CLI=podman

```
bookstack_app_1  localhost/bookstack_app:latest  Up 25 seconds
bookstack_db_1  docker.io/library/mysql:8.4  Up 25 seconds
```

Seeded state after `CONTAINER_CLI=podman bash webapps/start_app.sh bookstack`:

```
books   = 3
pages   = 6
comments= 5
```
