#!/bin/bash
set -e

echo "=== 1/4 Building Next.js app ==="
cd precios-ar
npm run build
cd ..

echo ""
echo "=== 2/4 Preparing standalone in _deploy/ ==="
rm -rf _deploy
mkdir -p _deploy

# Copy the standalone output (server.js, node_modules, .next/server, etc.)
cp -r precios-ar/.next/standalone/precios-ar _deploy/precios-ar

echo ""
echo "=== 3/4 Copying static assets and public files ==="
mkdir -p _deploy/precios-ar/.next/static _deploy/precios-ar/public
# .next/static contains the JS/CSS chunks needed at runtime
cp -r precios-ar/.next/static/* _deploy/precios-ar/.next/static/
# public/ files (icons, SVGs, etc.)
cp -r precios-ar/public/* _deploy/precios-ar/public/
# Environment file
cp precios-ar/.env.production _deploy/precios-ar/ 2>/dev/null || true

echo ""
echo "=== 4/4 Creating tarball ==="
cd _deploy
tar czf ../precios-ar-standalone.tar.gz .
cd ..

echo ""
echo "✅ Done! precios-ar-standalone.tar.gz ($(du -h precios-ar-standalone.tar.gz | cut -f1))"
echo ""
echo "Upload to VPS and run:"
echo "  mkdir -p /root/precios-ar/precios-ar/.next/standalone"
echo "  tar xzf precios-ar-standalone.tar.gz \\"
echo "    -C /root/precios-ar/precios-ar/.next/standalone \\"
echo "    --strip-components=1"
echo "  pm2 restart precios-ar --update-env"
