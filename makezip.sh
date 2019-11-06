#!/usr/bin/env bash

if [ -z "$1" ]; then
  echo "usage: makezip.sh <version>"
else
  zip -9 -r --exclude=*.zip --exclude=*.git* --exclude=readme.md --exclude=makezip.sh kinesis-to-rds-"$1".zip .
fi
