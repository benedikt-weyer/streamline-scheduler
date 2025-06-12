#!/bin/bash

# Create certs directory if it doesn't exist
mkdir -p ./certs

# Generate self-signed certificate valid for 365 days
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ./certs/key.pem \
    -out ./certs/cert.pem \
    -subj "/C=US/ST=State/L=City/O=Organization/OU=OrgUnit/CN=localhost/emailAddress=admin@localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:127.0.0.1,DNS:home-server.home.arpa,IP:127.0.0.1"

echo "SSL certificates generated successfully!"
echo "Certificate: ./certs/cert.pem"
echo "Private key: ./certs/key.pem"

# Set appropriate permissions
chmod 644 ./certs/key.pem
chmod 644 ./certs/cert.pem

echo "Permissions set correctly." 