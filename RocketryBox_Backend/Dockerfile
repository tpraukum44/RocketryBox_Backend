# Use Node.js 22 LTS as base image
FROM node:22-alpine

# Install security updates and required packages for Sharp
RUN apk update && apk upgrade && apk add --no-cache \
  dumb-init \
  vips-dev \
  build-base \
  python3 \
  make \
  g++

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
  adduser -S nodeuser -u 1001 -G nodejs

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies with platform-specific Sharp installation
RUN npm ci --include=optional && \
  npm install --platform=linux --arch=x64 sharp && \
  npm cache clean --force

# Create necessary directories with proper permissions
RUN mkdir -p uploads/admin-documents uploads/bulk-orders uploads/customers/profile-images uploads/seller-documents logs && \
  chown -R nodeuser:nodejs /app

# Copy source code
COPY --chown=nodeuser:nodejs . .

# Switch to non-root user
USER nodeuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["npm", "start"]
