# Base Image
FROM node:current-alpine

# Install Docker CLI
RUN apk add --no-cache docker-cli

# Install NestJS CLI
RUN npm install -g @nestjs/cli

# Copy and Install everything
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .

# Port
EXPOSE 3000

# Start in dev mode for debugging
CMD ["npm", "run", "start:dev"]
