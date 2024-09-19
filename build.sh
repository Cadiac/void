#!/bin/bash
set -e

AUDIO=true
TOUCH=false
DEBUG=false

USE_SOINTU=false
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
    MINIFIED_VERTEX_SHADER=$(cat tmp/vertex.min.wgsl) \
    MINIFIED_RAYMARCH_SHADER=$(cat tmp/raymarch.min.wgsl) \
    MINIFIED_SOBEL_SHADER=$(cat tmp/sobel.min.wgsl) \
    MINIFIED_ASCII_SHADER=$(cat tmp/ascii.min.wgsl) \
    MINIFIED_BRIGHTNESS_SHADER=$(cat tmp/brightness.min.wgsl) \
    MINIFIED_BLUR_SHADER=$(cat tmp/blur.min.wgsl) \
    MINIFIED_BLOOM_SHADER=$(cat tmp/bloom.min.wgsl) \
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
    if [ "$USE_SOINTU" = "true" ]; then
        sointu-compile -o tmp/ -arch=wasm audio/song.yml

        wat2wasm tmp/song.wat -o tmp/song.wasm

        wasm-opt --enable-bulk-memory \
            --enable-multivalue \
            --strip-debug \
            --disable-gc \
            -O tmp/song.wasm \
            -o tmp/song_optimized.wasm

        ruby tools/png/pnginator.rb tmp/bundle.min.js tmp/song_optimized.wasm entry/index.html
    else
        if [ "$USE_BROTLI" ]; then
            printf '...<script>' > tmp/index.html
            cat tmp/bundle.min.js >> tmp/index.html
            printf '</script>' >> tmp/index.html
            
            brotli -f -Z -o entry/index.br.html tmp/index.html
        fi

        if [ "$USE_PNG" ]; then
            ruby tools/png/pnginator.rb tmp/bundle.min.js entry/index.html
        fi
    fi
else
    ruby tools/png/pnginator.rb tmp/bundle.min.js entry/index.html
fi

wc -c tmp/index.html
if [ "$USE_PNG" ]; then
    wc -c entry/index.html
fi

if [ "$USE_BROTLI" ]; then
    wc -c entry/index.br.html
fi