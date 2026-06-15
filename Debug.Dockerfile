FROM gcr.io/distroless/nodejs20-debian12:latest
FROM debian:12-slim
COPY --from=0 / /distroless_root
