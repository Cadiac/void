# ASCII - Demohäsä 2024

## Online version

https://ascii.cadi.ac/

## Running locally

Open `entry/index.html` in Google Chrome or other Chromium based browser. A fairly recent version of Chrome is required, tested on Chrome v127.0.6533.120, as WebGPU support is still experimental.

To be able to unpack the PNG compressed demo you need to bypass CORS-security settings, that block reading the canvas values on file:// origin. You can do this either by passing `--disable-web-security` flag to Chrome on startup, or by running a local web server that serves the file from `localhost` origin which bypasses the need for CORS security settings override.

To start up a minimal python3 server to host the entry run

```
$ python3 -m http.server
```

and open http://localhost:8000/entry/index.html on the browser.

On windows, to temporarily disable CORS-security settings you can start Chrome temporarily with:

```
"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --disable-web-security --user-data-dir=[some directory]
```

## Development

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
