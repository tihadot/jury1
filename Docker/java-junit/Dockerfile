FROM openjdk:22-slim

# Set up working directory
WORKDIR /usr/src/app

# Install wget
RUN apt-get update && apt-get install -y wget

# JUnit Jupiter API
RUN mkdir /junit && \
    wget -O /junit/junit-jupiter-api-5.9.0.jar "https://repo1.maven.org/maven2/org/junit/jupiter/junit-jupiter-api/5.9.0/junit-jupiter-api-5.9.0.jar"

# JUnit Jupiter Engine
RUN wget -O /junit/junit-jupiter-engine-5.9.0.jar "https://repo1.maven.org/maven2/org/junit/jupiter/junit-jupiter-engine/5.9.0/junit-jupiter-engine-5.9.0.jar"

# JUnit Jupiter Params
RUN wget -O /junit/junit-jupiter-params-5.9.0.jar "https://repo1.maven.org/maven2/org/junit/jupiter/junit-jupiter-params/5.9.0/junit-jupiter-params-5.9.0.jar"

# JUnit Platform Commons
RUN wget -O /junit/junit-platform-commons-1.9.0.jar "https://repo1.maven.org/maven2/org/junit/platform/junit-platform-commons/1.9.0/junit-platform-commons-1.9.0.jar"

# JUnit Platform Console Standalone (for running tests)
RUN wget -O /junit/junit-platform-console-standalone-1.9.0.jar "https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/1.9.0/junit-platform-console-standalone-1.9.0.jar"

# Cleanup
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/*