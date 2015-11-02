#!/bin/bash

INSTALL_PATH="/mnt"
DRAGON_HOME="$INSTALL_PATH/dragon"
dbURL=localhost/devicedb
DB_DIR="$INSTALL_PATH/mongodb"
LOG_DIR="$DB_DIR"
TMP_PATH="/tmp/dragon_install"
USER_ID=`id -u`
C_DIR=`pwd`
BIN_NAME=$0
STOP_SERVICE=""
REMOVE_DRAGON=""
CV=""
UNPACK=""

if [ ! "$USER_ID" = "0" ]; then
	echo "Please re-run this program as the super user."
    exit -1
fi

if [ -d "$TMP_PATH" ]; then
    rm -rf $TMP_PATH
fi

echo "Running installation program ..."
mkdir -p "$TMP_PATH"
alias cp='cp -Rf'

read_version(){
	if [ -f "$DRAGON_HOME/version" ]; then
    	read CV < $DRAGON_HOME/version
	fi
}

stop_service(){
	if [ ! -z "`ps -ef | grep "bootstrap.js" | grep -v "grep"`" ]; then
		read -p "Service is running, shutdown or not?(y/n default n)" STOP_SERVICE
		if [ ! "$STOP_SERVICE" = "y" ]; then
        	return 0
    	fi
		dragon stop
	fi
}

run_mong(){
    if [ ! -d "$DB_DIR" ]; then
        mkdir -p "$DB_DIR"/db
    fi

    if [ ! -d "$LOG_DIR" ]; then
        mkdir -p "$LOG_DIR"
    fi

    if [ -z "`ps -ef | grep "mongod" | grep -v "grep"`" ]; then
        mongod --repair --dbpath $DB_DIR
        mongod --journal --dbpath $DB_DIR --logpath $LOG_DIR/mongo.log --logappend --fork &
        sleep 5
    fi
}

add_admin(){
	USEROBJ=`mongo $dbURL --quiet --eval "db.users.findOne({username:'admin'})"`
	if [ "$USEROBJ" = "null" ]; then
		ADDOBJ=`mongo $dbURL --quiet --eval "db.users.save({username:'admin',password:'123',level:'super'})"`
		CHECKADMIN=`mongo $dbURL --quiet --eval "db.users.findOne({username:'admin'})"`
		if [ ! "$CHECKADMIN" = "null" ]; then
			echo 'add admin succeed!'
		fi
	fi
}

unpack_package(){
	if [ ! -z "$UNPACK" ]; then
	    cd $TMP_PATH
		return 0
	fi
	
	cd $C_DIR
	echo "Unpack the installation package ..."
	EXIT0_LINE=`sed -n '/^exit 0$/=' $BIN_NAME`
	sed "1,${EXIT0_LINE}d" $BIN_NAME >"${TMP_PATH}/dragon.tar.gz"
	cd $TMP_PATH
	tar zxf dragon.tar.gz
	UNPACK="yes"
}

remove_dragon(){
	if [ -d "$DRAGON_HOME" ]; then
		read -p "Do you uninstall dragon service?(y/n default n)" REMOVE_DRAGON
	fi
	if [ ! "$REMOVE_DRAGON" = "y" ]; then
        return 0
	fi
	rm -f /usr/bin/dragon
	rm -rf $DRAGON_HOME
	echo "Uninstall Dragon Service successful"
}

install_runtime(){
	cd $TMP_PATH
	tar zxf dependencies.tar.gz
	cd install/
	bash install.sh
}

install_dragon(){
	cd $TMP_PATH
	tar zxf site.tar.gz
	cp -R dragon $INSTALL_PATH
	cd /usr/bin
	if [ -f /usr/bin/dragon ]; then
    	rm -f /usr/bin/dragon
    fi
	ln -s $DRAGON_HOME/server_control.sh dragon
	cd - >/dev/null
}

menu(){
    cd $TMP_PATH
    echo "  Welcome to use Dragon"
    echo "  --------------------"
    echo "    1.Install Runtime"
    echo "    2.Install Dragon"
    echo "    0.Exit"
    echo
}

clear
while :
do
	menu
	echo "  ~~~~~~~~Installed Information~~~~~~~~"
	if [ -f "/usr/bin/node" ]; then
		echo "  Runtime: Installed"
	else
		echo "  Runtime: Not installed"
	fi
	if [ -d "$DRAGON_HOME" ]; then
		read_version
		echo "  Dragon: $CV Installed"
	else
		echo "  Dragon: Not installed"
	fi
	echo "  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"	
	echo ""
	read -p "Please enter a installation opetion. Press '0' to exit:" MID
	case ${MID} in
		0)
			rm -rf $TMP_PATH
            echo "Bye."
            exit 0
            ;;
		1)
			stop_service
			echo "Installing Dragon Runtime ..."
			unpack_package
			install_runtime
			STOP_SERVICE=""
			REMOVE_DRAGON=""
			echo "Runtime Install Done"
            echo 
			;;
		2)
			stop_service
			echo "Installing Dragon ..."
			unpack_package
			remove_dragon
			run_mong
			install_dragon
			add_admin
			STOP_SERVICE=""
			REMOVE_DRAGON=""
			echo "Dragon Install Done"
			echo 
            ;;
		*)
			echo
            echo "No option '${MID}'"
            echo "Press any key and [enter] to return."
            read
            clear
            ;;
		esac
done

rm -rf $TMP_PATH
echo "Install the end."

exit 0
