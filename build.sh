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

wgslminify -e vertexMain,fragmentMain,myVariable src/shader/shader.wgsl > tmp/shader.min.wgsl

DEBUG=false MINIFIED_SHADER=$(cat tmp/shader.min.wgsl) npx rollup --config rollup.config.mjs

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
