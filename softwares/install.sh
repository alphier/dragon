#! /bin/sh

echo "Installing node v4.0.0..."
cp -R node-v4.0.0-linux-x64/lib/node_modules/ /usr/lib/
cp node-v4.0.0-linux-x64/bin/node /usr/bin/
chmod -R 777 /usr/bin/node
ln -s /usr/lib/node_modules/npm/bin/npm-cli.js /usr/bin/npm

echo "Installing MongoDB..."
yum install -y mongodb
cp mongod /usr/bin/
