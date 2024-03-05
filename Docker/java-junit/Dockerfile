# A Dockerfile for a Java image with JUnit and the custom test execution listener (CustomTestExecutionListener) installed

FROM eclipse-temurin:21.0.2_13-jdk-alpine

# Set up working directory
WORKDIR /usr/src/app

# Install bash, wget and jo (for JSON parsing)
RUN apk update && apk add --no-cache bash \
    && apk add --no-cache wget \
    && apk add --no-cache jo

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

# JSON Simple
RUN wget -O /junit/json-simple-1.1.1.jar "https://repo1.maven.org/maven2/com/googlecode/json-simple/json-simple/1.1.1/json-simple-1.1.1.jar"

# Custom JUnit Test Runner
COPY CustomRunners/CustomTestExecutionListener/target/custom-test-execution-listener-1.0-SNAPSHOT.jar /junit/CustomTestExecutionListener.jar
