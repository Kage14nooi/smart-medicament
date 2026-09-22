FROM alpine:3.20

RUN apk add --no-cache mysql-client bash coreutils tzdata

WORKDIR /app
COPY backup.sh /app/backup.sh
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/backup.sh /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
