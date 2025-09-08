# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app

# 의존성 먼저 설치(캐시 최적화)
COPY package*.json ./
RUN npm ci

# 소스 복사 후 빌드
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- run stage ---
FROM node:20-alpine
WORKDIR /app

# 런타임 의존성만
COPY package*.json ./
RUN npm ci --omit=dev

# 빌드 산출물 복사
COPY --from=build /app/dist ./dist

# 업로드 보존 폴더
RUN mkdir -p /app/uploads

ENV PORT=3020 NODE_ENV=production
EXPOSE 3020
CMD ["node", "dist/index.js"]
