FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/src ./src
EXPOSE 8080
CMD ["node", "src/index.js"]