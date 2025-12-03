#!/bin/bash

# This script installs Windows native modules that npm fails to install due to a bug
# https://github.com/npm/cli/issues/4828

# Only run on Windows
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "cygwin" && "$OSTYPE" != "win32" ]]; then
    echo "Not Windows, skipping native module installation"
    exit 0
fi

echo "Installing Windows native modules..."

# Rollup
if [ ! -f "node_modules/@rollup/rollup-win32-x64-msvc/rollup.win32-x64-msvc.node" ]; then
    echo "Installing @rollup/rollup-win32-x64-msvc..."
    mkdir -p node_modules/@rollup/rollup-win32-x64-msvc
    cd node_modules/@rollup/rollup-win32-x64-msvc
    curl -sL https://registry.npmjs.org/@rollup/rollup-win32-x64-msvc/-/rollup-win32-x64-msvc-4.28.1.tgz | tar xz --strip-components=1
    cd ../../..
fi

# Tailwind CSS Oxide
if [ ! -f "node_modules/@tailwindcss/oxide-win32-x64-msvc/tailwindcss-oxide.win32-x64-msvc.node" ]; then
    echo "Installing @tailwindcss/oxide-win32-x64-msvc..."
    mkdir -p node_modules/@tailwindcss/oxide-win32-x64-msvc
    cd node_modules/@tailwindcss/oxide-win32-x64-msvc
    curl -sL https://registry.npmjs.org/@tailwindcss/oxide-win32-x64-msvc/-/oxide-win32-x64-msvc-4.1.17.tgz | tar xz --strip-components=1
    cd ../../..
fi

# LightningCSS
if [ ! -f "node_modules/lightningcss-win32-x64-msvc/lightningcss.win32-x64-msvc.node" ]; then
    echo "Installing lightningcss-win32-x64-msvc..."
    mkdir -p node_modules/lightningcss-win32-x64-msvc
    cd node_modules/lightningcss-win32-x64-msvc
    curl -sL https://registry.npmjs.org/lightningcss-win32-x64-msvc/-/lightningcss-win32-x64-msvc-1.30.2.tgz | tar xz --strip-components=1
    cd ..
fi

echo "Windows native modules installed successfully!"
