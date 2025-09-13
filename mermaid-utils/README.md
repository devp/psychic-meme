# Mermaid Utils

This directory contains a set of utilities for working with [Mermaid](https://mermaid-js.github.io/mermaid/#/) diagrams.

## Requirements

- [Mermaid CLI](https://github.com/mermaid-js/mermaid-cli)
- [Just](https://github.com/casey/just)
- [fswatch](https://github.com/emcrisostomo/fswatch)
- Python 3

## Tasks

The following tasks are available via the `justfile`:

- `just init <filename>`: Creates a new Mermaid file with a quickstart template.
- `just build <filename> <format>`: Builds a Mermaid file into an image.
  - `filename`: The path to the Mermaid file.
  - `format`: The output format. Can be `svg`, `png`, or `both`. Defaults to `svg`.
- `just watch <filenames...>`: Watches a space-separated list of Mermaid files and rebuilds them on change.
- `just serve <filenames...>`: Watches a space-separated list of Mermaid files, rebuilds them on change, and serves the output directory on `http://localhost:8000`.
