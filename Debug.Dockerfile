FROM gcr.io/distroless/nodejs20-debian12@sha256:acf54dbb72efccb840d113f017742bb325fcbdfbe27757cccecb62521cba0f6c
FROM debian:12-slim
COPY --from=0 / /distroless_root
