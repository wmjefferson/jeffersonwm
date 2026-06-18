<div align="center">
  <img src="./git-banner.jpeg" alt="Perihelion Banner" width="800" />
</div>

# Perihelion Backend

`perihelion/backend` is the backend image server and API service for the Perihelion archive.

## Description

The backend is served via a Python service running [E:\scripts\perihelion_images_api.py](file:///E:/scripts/perihelion_images_api.py), exposing endpoints on port `8010` and routing through a Cloudflare tunnel.

This folder contains the active shared data, shares metadata, and SQLite database for the Perihelion service.
