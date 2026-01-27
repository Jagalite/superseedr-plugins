# Production-ready Dockerfile for Superseedr Notification Plugin
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    STATUS_FILE=/superseedr-status/app_state.json \
    DATA_DIR=/data

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .
COPY templates/ templates/

# Create data directory
RUN mkdir -p /data /superseedr-status

# Expose Flask port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:5000/api/status', timeout=3)"

# Run the application
CMD ["python", "app.py"]
