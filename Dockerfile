FROM harbor.intra.zeron.ai/library/nginx:1.20.2-alpine
# harbor registry nginx is arm64-only; use official multi-arch image instead
ADD nginx.conf /etc/nginx/conf.d/default.conf
ADD docker-entrypoint.sh /docker-entrypoint.sh
# Base image ENTRYPOINT execs this path; ADD does not preserve +x
RUN chmod +x /docker-entrypoint.sh
COPY dist /usr/share/nginx/html

# Nginx listens on 80 inside the container. Default host mapping: 9100 → 80

# Build (Mac ARM64 → target Linux x86_64):
#   docker build --platform linux/amd64 -t harbor.intra.zeron.ai/sophon-dev/ziot-ui-vue:2.10.2.2 .
#
# Run:
#   docker run -d --name ziot-ui -p 9100:80 -e API_BASE_PATH="http://10.7.20.145:8848/" -e SERVER_NAME="10.7.20.145" harbor.intra.zeron.ai/sophon-dev/ziot-ui-vue:2.10.2.3
EXPOSE 80

CMD ["sh","/docker-entrypoint.sh"]
#ADD oauth2 /usr/share/nginx/html/oauth2
