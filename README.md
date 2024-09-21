# ASCII - Demohäsä 2024

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

Install [wgslminify](https://github.com/mgnauck/wgslminify) and make it available on your path.

Install `java` and get [Google Closure Compiler](https://mvnrepository.com/artifact/com.google.javascript/closure-compiler/v20231112) jar. COpy of this executable is included under `tools/closure-compiler`.

Install `ruby` for `tools/pnginator.rb` script to compress the demo as PNG image.

To build the entry, run

```shell
npm run build
```

which should produce a build of the entry under `entry/` directory.
