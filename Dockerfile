FROM harbor.intra.zeron.ai/library/nginx:1.20.2
ADD nginx.conf /etc/nginx/conf.d/default.conf
ADD docker-entrypoint.sh /docker-entrypoint.sh
# Base image ENTRYPOINT execs this path; ADD does not preserve +x
RUN chmod +x /docker-entrypoint.sh
COPY dist /usr/share/nginx/html

# Nginx listens on 80 inside the container. Default host mapping: 9100 → 80
# docker run -d --name ziot-ui -p 9100:80 -e API_BASE_PATH="http://10.7.30.44:8848/" -e SERVER_NAME="10.7.30.44" harbor.intra.zeron.ai/sophon-dev/ziot-ui-vue:2.10.1.1
EXPOSE 80

CMD ["sh","/docker-entrypoint.sh"]
#ADD oauth2 /usr/share/nginx/html/oauth2
