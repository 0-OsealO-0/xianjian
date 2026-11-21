FROM node:24-alpine
WORKDIR /app
COPY 大报告 ./大报告
ENV HOST=0.0.0.0 PORT=8787
EXPOSE 8787
CMD ["node", "大报告/服务/server.mjs"]
