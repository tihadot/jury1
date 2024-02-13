FROM openjdk:22-slim

# Install Node.js and npm
RUN apt-get update && \
    apt-get install -y curl && \
    curl -sL https://deb.nodesource.com/setup_14.x | bash - && \
    apt-get install -y nodejs && \
    curl -L https://www.npmjs.com/install.sh | sh

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
