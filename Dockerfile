FROM joseluisq/static-web-server:2-alpine

COPY index.html style.css /public/
COPY js/ /public/js/

ENV SERVER_ROOT=/public \
    SERVER_PORT=8080 \
    SERVER_LOG_LEVEL=info \
    SERVER_COMPRESSION=true

EXPOSE 8080
