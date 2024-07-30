# Stage 1: Build the headers
FROM alpine:latest as builder

# Install build dependencies
RUN apk add --no-cache g++ musl-dev

# Set the working directory to /usr/src/app
WORKDIR /usr/src/app

# Copy the necessary headers to the working directory
COPY CustomRunners/CustomReporter/ /usr/include/

# Precompile headers
RUN g++ -O2 -x c++-header /usr/include/doctest.h -o /usr/include/doctest.h.gch && \
    g++ -O2 -x c++-header /usr/include/JsonReporter.h -o /usr/include/JsonReporter.h.gch

# Stage 2: Final image
FROM alpine:latest

# Install build dependencies
RUN apk add --no-cache g++ musl-dev

# Set the working directory to /usr/src/app
WORKDIR /usr/src/app

# Copy the precompiled headers from the builder stage
COPY --from=builder /usr/include/doctest.h /usr/include/doctest.h.gch /usr/include/JsonReporter.h /usr/include/JsonReporter.h.gch /usr/include/
