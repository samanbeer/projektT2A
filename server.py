#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import http.server
import socketserver
import os
import sys

# --- KONFIGURACE ---
PORT = 8082
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# --- TŘÍDA HANDLERU ---
class StaticFileHandler(http.server.SimpleHTTPRequestHandler):
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    # Přepis metody pro správné odesílání hlaviček
    def end_headers(self):
        
        # 1. Kontrola, zda se jedná o kořenový index.html nebo index.html
        path_segments = self.path.split('/')
        last_segment = path_segments[-1]
        
        # Pokud je cesta prázdná (kořen '/') nebo explicitně končí na index.html
        if not last_segment or last_segment.lower() == 'index.html':
            # Vynutíme Content-Type: text/html, aby se stránka zobrazila, ne stáhla
            self.send_header('Content-type', 'text/html; charset=utf-8')
        
        # 2. Pro ostatní soubory s diakritikou (CSS/JS)
        elif self.path.endswith(('.css', '.js')):
            mime_type = self.guess_type(self.path)
            self.send_header('Content-type', f'{mime_type}; charset=utf-8')
            
        # Standardní ukončení hlaviček
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    # Navíc: Přepis metody translate_path, aby fungovala správně
    def translate_path(self, path):
        # Překládá URL cestu na souborovou cestu (zajišťuje, že se najde index.html)
        path = http.server.SimpleHTTPRequestHandler.translate_path(self, path)
        relpath = os.path.relpath(path, os.getcwd())
        
        # Pokud je cesta adresář, pokusíme se najít index.html
        if os.path.isdir(path):
            index = os.path.join(path, 'index.html')
            if os.path.exists(index):
                return index
        return path


# --- HLAVNÍ BLOK ---
if __name__ == "__main__":
    
    # ... (zbytek kódu pro spuštění) ...
    
    print("-" * 50)
    print(f"Kořenový adresář: {DIRECTORY}")
    print(f"Interní adresa: http://<IP_NASU>:{PORT}")
    print("-" * 50)
    
    with socketserver.TCPServer(("", PORT), StaticFileHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer byl zastaven.")
            httpd.server_close()
        except Exception as e:
            print(f"Došlo k chybě: {e}")
            sys.exit(1)
