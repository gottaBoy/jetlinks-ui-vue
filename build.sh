#!/usr/bin/env bash
# Build for Linux x86_64 (from Mac ARM64 or any host)
# docker pull --platform linux/amd64 nginx:1.20.2-alpine
# docker tag nginx:1.20.2-alpine harbor.intra.zeron.ai/library/nginx:1.20.2-alpine
# docker push harbor.intra.zeron.ai/library/nginx:1.20.2-alpine
docker build --platform linux/amd64 -t harbor.intra.zeron.ai/sophon-dev/ziot-ui-vue:2.10.2.3 .
# docker push harbor.intra.zeron.ai/sophon-dev/ziot-ui-vue:2.10.2.3
