#!/bin/sh

# Start Docker-Daemon
dockerd &

# Wait for Docker-Daemon
until docker info; do
  sleep 1
done

# Docker-Images
docker pull python:3.12.0-alpine # doesnt work. Needs to be pulled before on hostmachine.
docker pull openjdk:22-slim # doesnt work. Needs to be pulled before on hostmachine.

# Custom Images
docker build ./Docker/python-datascience
docker build ./Docker/python-unittest
docker build  ./Docker/java-junit

# Start as dev-server for testing
npm run start:dev