#!/usr/bin/env bash
# docker build -t registry.cn-shenzhen.aliyuncs.com/jetlinks/jetlinks-ui-vue:2.10.0 .
# docker push registry.cn-shenzhen.aliyuncs.com/jetlinks/jetlinks-ui-vue:2.10.0
docker build -t harbor.intra.zeron.ai/sophon-dev/ziot-ui-vue:2.10.0.9 .
docker push harbor.intra.zeron.ai/sophon-dev/ziot-ui-vue:2.10.0.9
