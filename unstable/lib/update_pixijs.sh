#!/bin/bash

clear

# Update PIXI.js to the latest version
# Uses the official PIXI's GitHub repository: https://github.com/pixijs/pixijs

# Steps:
# - Compare the local version and the online version
# - Ask to update if online version is different than local one
# - Download *.mjs, *.min.mjs and *.map files

# Display current local version
latest_local=$(cat latest_version)
echo Local PIXI.js version: $latest_local

# Get the list of latest tags from GitHub API
latest_release=$(curl -s https://api.github.com/repos/pixijs/pixijs/releases | jq '.[0]' | grep -v '^$')

# Get the latest version from file
latest_changes=$(echo $latest_release | jq '.body')
latest_version=$(echo $latest_release | jq '.tag_name' | tr -d '"')
echo Latest online PIXI.js version on GitHub: $latest_version
echo 

if [ "$latest_version" != "$latest_local" ] ;then
    echo $latest_version changes:
    echo $latest_changes
    echo

    echo "Do you want to update PIXI.js from GitHub ? (y/n)"
    read answer
    if [ "$answer" != "${answer#[Yy]}" ] ;then
        # Download the latest version
        curl -s -OL https://github.com/pixijs/pixijs/releases/download/$latest_version/pixi.mjs
        curl -s -OL https://github.com/pixijs/pixijs/releases/download/$latest_version/pixi.mjs.map
        curl -s -OL https://github.com/pixijs/pixijs/releases/download/$latest_version/pixi.min.mjs
        curl -s -OL https://github.com/pixijs/pixijs/releases/download/$latest_version/pixi.min.mjs.map

        echo Files succesfully updated.
        echo

        echo $latest_version > latest_version
    else
        echo Update aborted.
        echo
    fi
else
    echo Local version is already up-to-date.
    echo
fi
