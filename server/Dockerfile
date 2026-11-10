# Veriflow server with Playwright, for Render (PLAN.md 11: "Playwright on Render").
# The official Playwright image already has Node.js, Chromium and every Linux library Chromium needs.
# The image version MUST match the "playwright" version in package-lock.json (now 1.65.0).
# If you update playwright, change this tag too, or Chromium won't be found.
FROM mcr.microsoft.com/playwright:v1.65.0-noble

WORKDIR /app

# Browsers are already in the image, so npm must not download them again
ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install packages first (cached by Docker until package files change = faster rebuilds)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Then the code
COPY src ./src
COPY scripts ./scripts

# Don't run as root (the image comes with a normal user called pwuser)
USER pwuser

# Render tells the app which port to use through the PORT variable
EXPOSE 10000
CMD ["node", "src/index.js"]
