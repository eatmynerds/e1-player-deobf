#!/bin/bash

node js/deobfuscate.js

if [ -d "key" ]; then
  rm -rf "key"
fi

# Clone the repository with authentication token included in the URL
git clone --single-branch --branch e1 "https://$AUTH_TOKEN@github.com/eatmynerds/key.git"

cd key
mv "../key.txt" key.txt

if [[ -z "$(git diff --exit-code)" ]]; then
  echo "No changes; exiting."
  cd ..
else
  git config user.email $GIT_EMAIL
  git config user.name $GIT_USER
  git checkout --orphan temp-branch
  git add -A
  git commit -am "Updated key"
  git branch -D e1
  git branch -m e1
  git push --force origin "e1"
  cd ..
fi

