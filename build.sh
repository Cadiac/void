#!/bin/bash
set -e

AUDIO=true
TOUCH=false
DEBUG=false
FULLSCREEN=true

USE_BROTLI=true
USE_PNG=true

mkdir -p tmp
mkdir -p entry

wgslminify -e f src/shader/vertex.wgsl > tmp/vertex.min.wgsl
wgslminify -e f src/shader/raymarch.wgsl > tmp/raymarch.min.wgsl
wgslminify -e f src/shader/sobel.wgsl > tmp/sobel.min.wgsl
wgslminify -e f src/shader/ascii.wgsl > tmp/ascii.min.wgsl

DEBUG=$DEBUG \
    AUDIO=$AUDIO \
    TOUCH=$TOUCH \
    FULLSCREEN=$FULLSCREEN \
    MINIFIED_VERTEX_SHADER=$(cat tmp/vertex.min.wgsl) \
    MINIFIED_RAYMARCH_SHADER=$(cat tmp/raymarch.min.wgsl) \
    MINIFIED_SOBEL_SHADER=$(cat tmp/sobel.min.wgsl) \
    MINIFIED_ASCII_SHADER=$(cat tmp/ascii.min.wgsl) \
    npx rollup --config rollup.config.mjs

java -jar tools/closure-compiler/closure-compiler-v20231112.jar \
    -O ADVANCED \
    --language_in ECMASCRIPT_NEXT \
    --language_out ECMASCRIPT_NEXT \
    --assume_function_wrapper true \
    --rewrite_polyfills false \
    --externs src/externs.js \
    --js tmp/bundle.js \
    --js_output_file tmp/bundle.min.js

if [ "$AUDIO" = "true" ]; then
    if [ "$USE_BROTLI" ]; then
        printf '...<script>' > tmp/index.br.html
        cat tmp/bundle.min.js >> tmp/index.br.html
        printf '</script>' >> tmp/index.br.html
        
        brotli -f -Z -o brotli/index.html tmp/index.br.html
    fi

    if [ "$USE_PNG" ]; then
        ruby tools/png/pnginator.rb tmp/bundle.min.js entry/index.html
    fi
else
    ruby tools/png/pnginator.rb tmp/bundle.min.js entry/index.html
fi

wc -c tmp/bundle.min.js
if [ "$USE_PNG" ]; then
    wc -c entry/index.html
fi

if [ "$USE_BROTLI" ]; then
    wc -c brotli/index.html
fi