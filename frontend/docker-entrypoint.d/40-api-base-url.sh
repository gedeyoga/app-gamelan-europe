#!/bin/sh
set -e
: "${VITE_API_BASE_URL:=/api/v1}"
printf "window.__API_BASE_URL__='%s'\n" "$VITE_API_BASE_URL" \
  > /usr/share/nginx/html/config.js
