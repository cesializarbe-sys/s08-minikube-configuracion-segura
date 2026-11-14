# Imagen del backend (Node.js 20 LTS sobre Alpine)
FROM node:20-alpine
WORKDIR /app

# Se copian primero los manifiestos de dependencias para aprovechar la caché de capas
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Se ejecuta con el usuario no privilegiado "node"
USER node

# Puerto por defecto; el real lo define APP_PORT (ConfigMap)
EXPOSE 3000
CMD ["node", "server.js"]
