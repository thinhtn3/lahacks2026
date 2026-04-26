#!/bin/bash
cd "$(dirname "$0")"
.venv/bin/uvicorn app.main:app --reload
