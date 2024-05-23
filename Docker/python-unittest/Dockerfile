# A Dockerfile for a Python image with the custom test runner script (json_test_runner.py) installed

FROM python:alpine

# Copy the custom test runner script into the container at /usr/src/app
COPY CustomRunners/CustomTestRunner/json_test_runner.py /custom-test-runner/json_test_runner.py

RUN pip install pyflakes
