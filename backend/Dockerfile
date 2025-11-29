# Use a specific, stable slim version of Python to avoid bloat
FROM python:3.11-slim-bookworm

# Set working directory
WORKDIR /app

# Install system dependencies (Fixes 'No matching distribution' for complex packages)
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# 1. Upgrade build tools CRITICAL STEP
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# 2. Install Google AI explicitly using quotes to prevent character issues
RUN pip install --no-cache-dir "google-generative-ai"

# 3. Install the rest of the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . .

# Run command
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]