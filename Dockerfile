# Use an official Node.js runtime as the base image
FROM node:20-alpine

# Create and change to the working directory
WORKDIR /app

# Install dependencies based on the lockfile when present
COPY package*.json ./
RUN npm install

# Copy the rest of the application source
COPY . .

# Expose the port the Vite dev server will run on
EXPOSE 5177

# Start the Vite development server on all interfaces
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5177"]
