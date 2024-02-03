# Docker in Docker Image
FROM docker:dind

# Install Node.js and NPM
RUN apk add --update nodejs npm

# Copy and Install everything
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci
COPY . .

# Port
EXPOSE 3000

# Start in dev mode for debugging
CMD ["sh", "start.sh"]