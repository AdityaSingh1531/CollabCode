# Use ultra-lightweight Alpine Linux as the base
FROM alpine:3.18

# Install minimal runtimes for Python, C/C++, and JavaScript (Node)
# Also install py3-pip and flask for the HTTP execution server
RUN apk add --no-cache \
    python3 \
    py3-pip \
    gcc \
    g++ \
    libc-dev \
    nodejs \
    bash

# Install Flask (the lightweight HTTP server that Cloud Run will talk to)
RUN pip3 install flask --break-system-packages

# Create an absolute low-privilege sandbox user
RUN adduser -D -g "" sandboxuser

# Set up a secure workspace directory
WORKDIR /app

# Copy the Flask execution server into the image
COPY main.py .
RUN chown -R sandboxuser:sandboxuser /app

# Switch to the low-privilege user so code can never run as root
USER sandboxuser

# Cloud Run requires the container to listen on port 8080
EXPOSE 8080

# Start the Flask HTTP server (replaces the bare bash CMD)
CMD ["python3", "main.py"]
