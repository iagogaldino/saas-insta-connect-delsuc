FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=http://127.0.0.1:3000
ARG VITE_APP_BASE_PATH=/
ARG VITE_AUTH_LOGIN_PATH=/auth/login
ARG VITE_AUTH_REGISTER_PATH=/auth/register
ARG VITE_AUTH_TOKEN_STORAGE_KEY=insta_connect_token

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_APP_BASE_PATH=${VITE_APP_BASE_PATH}
ENV VITE_AUTH_LOGIN_PATH=${VITE_AUTH_LOGIN_PATH}
ENV VITE_AUTH_REGISTER_PATH=${VITE_AUTH_REGISTER_PATH}
ENV VITE_AUTH_TOKEN_STORAGE_KEY=${VITE_AUTH_TOKEN_STORAGE_KEY}

RUN npm run build

FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
