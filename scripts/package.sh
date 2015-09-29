#! /bin/sh

T_DIR="/tmp/dragon_build"
B_DIR=$T_DIR/dragon
C_DIR=`pwd`
VERSION=$1

if [ "$1" = "" ]; then
    echo "usage:package.sh [version]"
    exit 0
fi

if [ -d "$T_DIR" ]; then
   rm -rf $T_DIR
fi

mkdir -p $B_DIR
echo "Copy files..."
cp -f ../bootstrap.js $B_DIR
cp -f ../server_control.sh $B_DIR
cp -rf ../node_modules $B_DIR
cp -rf ../portal $B_DIR
cp -f ../softwares/dependencies.tar.gz $T_DIR
cp -f ./install.sh $T_DIR
echo "Dragon $1" > $B_DIR/version

echo "Packing..."
cd $T_DIR
tar zcf site.tar.gz dragon
tar zcf temp.tar.gz *.gz
cat install.sh temp.tar.gz > dragon.bin
chmod +x *.bin
tar zcf dragon.tar.gz *.bin 
rm -f temp.tar.gz

if [ ! -d "$C_DIR/x86_64_package" ]; then
    mkdir $C_DIR/x86_64_package
fi

alias mv='mv -f'
mv dragon.tar.gz $C_DIR/x86_64_package

rm -rf $T_DIR
echo "Packing Dragon_$1 succeed"
exit 0 

