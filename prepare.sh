#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# Ensure default values are used if no environment variable is set
DOCKER_RUNTIME=${DOCKER_RUNTIME:-runc}
DOCKER_IMAGE_PYTHON=${DOCKER_IMAGE_PYTHON:-python:3.12.0-alpine}
DOCKER_IMAGE_PYTHON_UNITTEST=${DOCKER_IMAGE_PYTHON_UNITTEST:-python-unittest}
DOCKER_IMAGE_JAVA=${DOCKER_IMAGE_JAVA:-eclipse-temurin:21.0.2_13-jdk-alpine}
DOCKER_IMAGE_JAVA_JUNIT=${DOCKER_IMAGE_JAVA_JUNIT:-java-junit}

# Pull Docker images
docker pull "$DOCKER_IMAGE_PYTHON"
docker pull "$DOCKER_IMAGE_JAVA"

# Build custom Docker images
docker build -t "$DOCKER_IMAGE_PYTHON_UNITTEST" -f ./Docker/python-unittest/Dockerfile .
docker build -t "$DOCKER_IMAGE_JAVA_JUNIT" -f ./Docker/java-junit/Dockerfile .

# Install gVisor
set -e
ARCH=$(uname -m)
URL=https://storage.googleapis.com/gvisor/releases/release/latest/${ARCH}
wget ${URL}/runsc ${URL}/runsc.sha512 \
    ${URL}/containerd-shim-runsc-v1 ${URL}/containerd-shim-runsc-v1.sha512
sha512sum -c runsc.sha512 \
    -c containerd-shim-runsc-v1.sha512
rm -f *.sha512
chmod a+rx runsc containerd-shim-runsc-v1
sudo mv runsc containerd-shim-runsc-v1 /usr/local/bin
sudo /usr/local/bin/runsc install
sudo systemctl reload docker
sudo docker run --rm --runtime=runsc hello-world

echo "Prepare script completed."
