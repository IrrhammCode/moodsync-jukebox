# Use Node 18 Alpine for a small footprint
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the server code
COPY . .

# Build the TypeScript project
RUN npm run build

# Hugging Face Spaces port requirement: 7860
EXPOSE 7860

# Metadata for Hugging Face
ENV PORT=7860

# Start the server
CMD ["npm", "start"]
