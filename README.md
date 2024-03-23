# Vesi.

## Getting started

Install Node (tested on v20.11.1). Install dev depenedencies with

```shell
npm ci
```

and start the dev server with

```shell
npm run dev
```

and open http://localhost:3000 on the browser.

## Building the entry

A lot of this is based on [lörtsy](https://gitlab.com/tmptknn/pipeline) but I decided to build the pipeline on my own to fully understand it.

Clone [Sointu](https://github.com/vsariola/sointu) and install Golang. Build `sointu-compile` binary with

```shell
go build -o sointu-compile cmd/sointu-compile/main.go
```

Install `wat2wasm` from [wabt](https://github.com/WebAssembly/wabt). On MacOS you can use `brew install wabt`.

Install `wasm-opt` from [binaryen](https://github.com/WebAssembly/binaryen). On MacOS you can use `brew install binaryen`.

Install [wgslminify](https://github.com/mgnauck/wgslminify) and make it available on your path.

Install `java` and get [Google Closure Compiler](https://mvnrepository.com/artifact/com.google.javascript/closure-compiler/v20231112) jar.
