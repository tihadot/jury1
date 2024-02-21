# Load environment variables from .env file
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        $line = $_ -split '='
        [System.Environment]::SetEnvironmentVariable($line[0], $line[1], [System.EnvironmentVariableTarget]::Process)
    }
}

# Ensure default values are used if no environment variable is set
$DOCKER_RUNTIME = [System.Environment]::GetEnvironmentVariable("DOCKER_RUNTIME", [System.EnvironmentVariableTarget]::Process)
if (-not $DOCKER_RUNTIME) { $DOCKER_RUNTIME = "runc" }

$DOCKER_IMAGE_PYTHON = [System.Environment]::GetEnvironmentVariable("DOCKER_IMAGE_PYTHON", [System.EnvironmentVariableTarget]::Process)
if (-not $DOCKER_IMAGE_PYTHON) { $DOCKER_IMAGE_PYTHON = "python:3.12.0-alpine" }

$DOCKER_IMAGE_PYTHON_UNITTEST = [System.Environment]::GetEnvironmentVariable("DOCKER_IMAGE_PYTHON_UNITTEST", [System.EnvironmentVariableTarget]::Process)
if (-not $DOCKER_IMAGE_PYTHON_UNITTEST) { $DOCKER_IMAGE_PYTHON_UNITTEST = "python-unittest" }

$DOCKER_IMAGE_JAVA = [System.Environment]::GetEnvironmentVariable("DOCKER_IMAGE_JAVA", [System.EnvironmentVariableTarget]::Process)
if (-not $DOCKER_IMAGE_JAVA) { $DOCKER_IMAGE_JAVA = "eclipse-temurin:21.0.2_13-jdk-alpine" }

$DOCKER_IMAGE_JAVA_JUNIT = [System.Environment]::GetEnvironmentVariable("DOCKER_IMAGE_JAVA_JUNIT", [System.EnvironmentVariableTarget]::Process)
if (-not $DOCKER_IMAGE_JAVA_JUNIT) { $DOCKER_IMAGE_JAVA_JUNIT = "java-junit" }

# Pull Docker images
docker pull $DOCKER_IMAGE_PYTHON
docker pull $DOCKER_IMAGE_JAVA

# Build custom Docker images
docker build -t $DOCKER_IMAGE_PYTHON_UNITTEST -f ./Docker/python-unittest/Dockerfile .
docker build -t $DOCKER_IMAGE_JAVA_JUNIT -f ./Docker/java-junit/Dockerfile .

Write-Host "Prepare script completed."
