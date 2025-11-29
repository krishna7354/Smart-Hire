# Use the FULL Python image (contains all C++ compilers for grpcio)
FROM python:3.11

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# 1. Upgrade pip to the latest version
RUN pip install --no-cache-dir --upgrade pip

# 2. Install Google AI (The full image can handle the C++ build)
RUN pip install --no-cache-dir google-generativeai

# 3. Install the rest of the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Run the application
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]