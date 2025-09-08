# build stage
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build   # Vite → dist/

# run stage
FROM nginx:1.27-alpine
# 업로드 크기 제한 늘리려면 client_max_body_size를 conf에서 지정
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
