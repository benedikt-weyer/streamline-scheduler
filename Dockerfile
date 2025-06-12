FROM node:lts

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Install supabase CLI
RUN pnpm add supabase --save-dev --allow-build=supabase

# Add node_modules/.bin to PATH
ENV PATH="/app/node_modules/.bin:${PATH}"

ARG SUPABASE_DB_URL

ENV SUPABASE_DB_URL=${SUPABASE_DB_URL}

# Create scripts directory and add scripts
RUN mkdir -p /scripts \
    && echo '#!/bin/sh\npnpm supabase db push --db-url "${SUPABASE_DB_URL}"' > /scripts/db-push \
    && echo '#!/bin/sh\nprintenv' > /scripts/print-env \
    && chmod +x /scripts/db-push \
    && chmod +x /scripts/print-env

# Add scripts directory to PATH
ENV PATH="/scripts:${PATH}"
