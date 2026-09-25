#!/bin/sh
# Rigenera la guida PDF da guida.html con Chrome (serve Google Chrome installato).
cd "$(dirname "$0")"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$PWD/Guida_Segnali_d_uscita.pdf" "file://$PWD/guida.html"
