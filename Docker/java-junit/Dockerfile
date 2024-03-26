# A Dockerfile for a Java image with JUnit and the custom test execution listener (CustomTestExecutionListener) installed

FROM eclipse-temurin:21-jdk-alpine

# Set up working directory
WORKDIR /usr/src/app

# Install jo (for JSON parsing)
RUN apk update && apk add --no-cache jo && rm -rf /var/cache/apk/*

# JUnit Platform Console Standalone (for running tests)
RUN mkdir /junit && \
    wget -O /junit/junit-platform-console-standalone-1.9.0.jar "https://repo1.maven.org/maven2/org/junit/platform/junit-platform-console-standalone/1.9.0/junit-platform-console-standalone-1.9.0.jar"

# JSON Simple
RUN wget -O /junit/json-simple-1.1.1.jar "https://repo1.maven.org/maven2/com/googlecode/json-simple/json-simple/1.1.1/json-simple-1.1.1.jar"

# Custom JUnit Test Runner
COPY CustomRunners/CustomTestExecutionListener/target/custom-test-execution-listener-1.0-SNAPSHOT.jar /junit/CustomTestExecutionListener.jar
