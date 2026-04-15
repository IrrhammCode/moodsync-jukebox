# Use Node 20 Alpine (Required for Next.js 16 and Supabase dependencies)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy the entire monorepo structure
COPY . .

# Move into the server directory
WORKDIR /app/apps/server

# Install dependencies (will find package.json in apps/server)
RUN npm install

# Build the TypeScript project
RUN npm run build

# Hugging Face Spaces port requirement: 7860
EXPOSE 7860

# Metadata for Hugging Face
ENV PORT=7860

# Start the server (from apps/server context)
CMD ["npm", "start"]
