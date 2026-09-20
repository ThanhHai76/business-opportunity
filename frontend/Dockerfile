# Angular app (Home, Opportunity Map, Time Machine, Hanoi Living Score) served by nginx.
# Build context: ./frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/opportunity-map/browser /usr/share/nginx/html
EXPOSE 80
