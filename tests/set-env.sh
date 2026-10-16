#!/bin/bash
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
else
  set -a
  source .env.example
  set +a
fi
