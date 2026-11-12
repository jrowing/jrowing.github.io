#!/bin/sh
# Rebuild the JupyterLite site after changing/adding notebooks in lite-source/
pip install jupyterlite-core jupyterlite-pyodide-kernel jupyter-server
rm -rf lite
jupyter lite build --contents lite-source --output-dir lite --base-url /lite/
find lite -name '*.map' -delete
