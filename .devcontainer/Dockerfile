ARG VARIANT=20-bullseye
FROM mcr.microsoft.com/devcontainers/typescript-node:1-${VARIANT}

# Update packages
RUN apt-get update && apt-get upgrade -y
# Install packages for Cypress testing
RUN apt-get install libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libnss3 libxss1 libasound2 libxtst6 xauth xvfb -y