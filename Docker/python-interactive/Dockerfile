FROM node:alpine

# Install Python
RUN apk add --update python3 && ln -sf python3 /usr/bin/python

# Set the working directory
WORKDIR /commandListener

# Copy the command listener script and package.json into the image
COPY CommandListener/commandListener.js /commandListener/
COPY CommandListener/package.json /commandListener/

# Install NPM dependencies (including chokidar)
RUN npm install

# Create the commands.txt file
RUN touch /commandListener/commands.txt
