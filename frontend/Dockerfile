# Etape 1 : build de l'application Vite/React
FROM node:20-slim AS build
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
# En Docker, le frontend appelle le gateway via son nom de service reseau (voir docker-compose.yml)
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Etape 2 : service du build statique via nginx (choix documente dans le README :
# plus simple et plus proche d'un deploiement de production que de garder le serveur de dev Vite)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
