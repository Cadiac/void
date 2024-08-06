#!/bin/bash
set -e

mkdir -p tmp
mkdir -p entry

sointu-compile -o tmp/ -arch=wasm audio/song.yml

wat2wasm tmp/song.wat -o tmp/song.wasm

wasm-opt --enable-bulk-memory \
    --enable-multivalue \
    --strip-debug \
    --disable-gc \
    -O tmp/song.wasm \
    -o tmp/song_optimized.wasm

wgslminify -e vs src/shader/vertex.wgsl > tmp/vertex.min.wgsl
wgslminify -e fs src/shader/raymarch.wgsl > tmp/raymarch.min.wgsl
wgslminify -e main src/shader/sobel.wgsl > tmp/sobel.min.wgsl
wgslminify -e fs src/shader/ascii.wgsl > tmp/ascii.min.wgsl
wgslminify -e fs src/shader/brightness.wgsl > tmp/brightness.min.wgsl
wgslminify -e horizontal_blur,vertical_blur src/shader/blur.wgsl > tmp/blur.min.wgsl
wgslminify -e fs src/shader/bloom.wgsl > tmp/bloom.min.wgsl

DEBUG=false \
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

ruby tools/png/pnginator.rb tmp/bundle.min.js tmp/song_optimized.wasm entry/index.html

wc -c entry/index.html
