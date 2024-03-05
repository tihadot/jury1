FROM eclipse-temurin:21.0.2_13-jdk-alpine

# Install Node.js and npm
RUN apk update && apk add --no-cache nodejs \
    && apk add --no-cache npm

# Set the working directory
WORKDIR /commandListener

# Copy the command listener script and package.json into the image
COPY CommandListener/commandListenerJava.js /commandListener/commandListener.js
COPY CommandListener/package.json /commandListener/

# Install NPM dependencies (including chokidar)
RUN npm install

# Create the commands.txt file for listening to commands
RUN touch /commandListener/commands.txt

CMD ["node", "commandListener.js"]
