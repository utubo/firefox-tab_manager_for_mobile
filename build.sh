#!/usr/bin/sh

CURRENT_DIR=$(pwd)
SCRIPT_DIR=$(cd $(dirname $0); pwd)
cd $SCRIPT_DIR/src
zip -r ../tab_manager.zip *
cd ..
mv -f tab_manager.zip tab_manager.xpi
cd $CURRENT_DIR

