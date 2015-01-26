#! /bin/sh
export DRAGON_HOME=/mnt/dragon

USER_ID=`id -u`
DB_DIR=/mnt/mongodb
LOG_DIR=$DB_DIR
PROCESS_NAME="bootstrap.js $DRAGON_HOME"

if [ ! "$USER_ID" = "0" ]; then
    echo "Please re-run this program as the super user."
    exit 0
fi

#go to home
cd $DRAGON_HOME

#start server
start_server(){
	if [ -f "$DRAGON_HOME/dragon.lock" ]; then
        echo "dragon service has started, Please execute [dragon stop] command to stop service."
        exit 0       
    fi
	
	touch $DRAGON_HOME/dragon.lock
	
	if [ ! -d "$LOG_DIR" ]; then
	      mkdir -p "$LOG_DIR"
	fi
	
	if [ -z "`ps -ef | grep "mongod" | grep -v "grep"`" ]; then
		if [ ! -d "$DB_DIR" ]; then
			mkdir -p "$DB_DIR"
		fi
	
		mongod --repair --dbpath $DB_DIR
		mongod --journal --dbpath $DB_DIR --logpath $LOG_DIR/mongo.log --logappend --fork &
		sleep 5
	fi
		
	ulimit -n 40960
	ulimit -c unlimited
	
	nohup node $PROCESS_NAME >/dev/null 2>&1 &
	sleep 5
}

kill_process(){
	PIS=`ps -efww | grep "$PROCESS_NAME" | grep -v "grep" | awk '{print $2}'`
	if [ ! -z ${PIS} ]; then
		echo ${PIS} | xargs kill
		sleep 1
	fi
}

#stop server
stop_server(){
    rm -f $DRAGON_HOME/dragon.lock
	kill_process
	sleep 2
}

YESNO=$2
case "$1" in
start)
    echo "Starting dragon services ..."
    start_server
    echo "Server started."
    ;;
stop)
    echo "Stopping dragon services ...."
    stop_server
    echo "Server stopped"
    ;;
version)
    if [ -f "$DRAGON_HOME/version" ]; then
        while read VLINE
        do
            echo $VLINE
        done<$DRAGON_HOME/version
    else
        echo "Unknow version"
    fi
    ;;
*)
    echo "Unknow command:dragon $1"
    echo "Command usage:"
    echo "dragon [start|stop|version]"
    ;;
esac

exit 0
