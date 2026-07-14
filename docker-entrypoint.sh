#!/bin/sh

# Get nameservers from /etc/resolv.conf
NAMESERVERS=$(grep "^nameserver" /etc/resolv.conf | awk '{print $2}' | tr '\n' ' ')

# Set default API_BASE_PATH if not provided
if [ -z "$API_BASE_PATH" ]; then
   # API_BASE_PATH="http://10.7.30.44:8848/"
    API_BASE_PATH="http://10.7.20.145:8848/"
fi

# Update resolver line in nginx config
resolver="resolver $NAMESERVERS ipv6=off;"
sed -i "11c $resolver" /etc/nginx/conf.d/default.conf

# Replace API_BASE_PATH placeholder if it exists
sed -i "s%{API_BASE_PATH}%$API_BASE_PATH%g" /etc/nginx/conf.d/default.conf

# Handle SERVER_NAME configuration
if [ -z "$SERVER_NAME" ]; then
    serverName="server_name localhost;"
    sed -i "4c $serverName" /etc/nginx/conf.d/default.conf
    # Set SERVER_NAME to "0" to disable hostname checking (see nginx.conf line 31)
    sed -i "s%{SERVER_NAME}%\"0\"%g" /etc/nginx/conf.d/default.conf
else
    serverName="server_name $SERVER_NAME;"
    sed -i "4c $serverName" /etc/nginx/conf.d/default.conf
    sed -i "s%{SERVER_NAME}%$SERVER_NAME%g" /etc/nginx/conf.d/default.conf
fi

# Start nginx in foreground (container :80; default host mapping 9100:80)
echo "[docker-entrypoint] API_BASE_PATH=$API_BASE_PATH"
echo "[docker-entrypoint] listening on :80 — map with -p 9100:80 for http://localhost:9100"
nginx -g "daemon off;"

