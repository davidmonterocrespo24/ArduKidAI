FROM node:24-alpine AS build

WORKDIR /app

# Install deps first so we cache them when only source changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Same-origin in production: the reverse proxy maps /api -> backend.
ENV VITE_API_BASE=""
RUN npm run build


FROM nginx:1.29-alpine AS runtime

# Trim the default site and replace it with our SPA config (index.html
# fallback for any unknown path so client-side routing works).
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/ardukid.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
