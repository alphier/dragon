/************
 *bootstrap
 */

var spawn = require('child_process').spawn,
	fs = require('fs'),
	path = require("path"),
	net = require("net"),
	server = net.createServer(),
	DRAGON_HOME = '/mnt/dragon',
	app = {name:'app.js' ,home:'portal',log:'server.log', wait:3000},
	EXIT_FLAG = 0;

var dtstr = function(){
    var dt = new Date();
	var dtstr = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate() +
				' ' + dt.getHours() + ':' + dt.getMinutes() + ':' + dt.getSeconds() + ' ';

	return dtstr;
};

var mongolog = function(){
    "use strict";

	var dblog = '/mnt/mongodb/mongo.log';

	if(!fs.existsSync(dblog)){
		return;
	}

	var stats = fs.statSync(dblog);

	if(stats.size < (100 * 1024 * 1024)){
		return;
	}

	try{
		fs.writeFile(dblog, '', function(err){
			if(err){
		        log(DRAGON_HOME + '/portal/log/dragon.log', dtstr() + ' clear log file failure for mongodb.\n');
			}
		});
	}catch(err){
		log(DRAGON_HOME + '/portal/log/dragon.log', dtstr() + ' clear log file. ' + err + '\n');
	}

    setTimeout(function(){ mongolog(); }, (60 * 60 * 1000));
};

var log = function(file, content, callback){
    "use strict";
	
	var c = '' + content;
	try{
		fs.appendFile(file, c, 'utf8', function(err){
			if(typeof(callback) === 'function'){
			    callback();
			}
		});
	}catch(err){
		console.log(err);
	}
};

//load....
var startChild = function(st, callback){
  "use strict";
	var opt = {
		env: process.env,
		cwd: process.cwd,
		detached: true
	}, child;

	try{
		process.chdir(st.home);
		delete st.process;

		child = spawn('node', [st.name], opt);
		child.stinfo = st;
		child.unref();

		child.stdout.on('data', function (data) {
			log(DRAGON_HOME + '/portal/log/' + child.stinfo.log, data);
		});

		child.stderr.on('data', function (data) {
			log(DRAGON_HOME + '/portal/log/' + child.stinfo.log, data);
		});

		child.on('exit', function (code, signal) {
			if(EXIT_FLAG !== 1){
				startChild(child.stinfo, function(cpp){
			        log(DRAGON_HOME + '/portal/log/dragon.log', dtstr() + cpp.stinfo.name + ' exit, restart it.\n');
				});
			}
		});

		child.on('error', function (code, signal) {
			log(DRAGON_HOME + '/portal/log/dragon.log', dtstr() + child.stinfo.name + ' error:' + code + '\n');
		});

		child.on('SIGTERM', function(){
			child.kill('SIGINT');
		});

		child.on('uncaughtException', function (err) {
			log(DRAGON_HOME + '/portal/log/' + child.stinfo.log, dtstr() + child.stinfo.name + ' exception:' + err + '\n');
		});

		process.chdir(DRAGON_HOME);
		st.process = child;
		callback(child);
	}catch(err){
		log(DRAGON_HOME + '/portal/log/dragon.log', dtstr() + 'err:' + err + '\n');
		callback(undefined);
	}
};

var bootstrap = function(){
	"use strict";
	
	startChild(app, function(child){
		if(child === undefined){
			log(DRAGON_HOME + '/portal/log/dragon.log', dtstr() + app.name + ' start failed\n');
			return;
		}
		log(DRAGON_HOME + '/portal/log/dragon.log', dtstr() + app.name + ' start\n');
	});
};


var exit = function(callback){	
	
	EXIT_FLAG = 1;

	try{
		if(app.process !== undefined){
			app.process.kill('SIGTERM');
			log(DRAGON_HOME + '/portal/log/dragon.log', dtstr() + app.name + ' stop\n',function(){
				callback();
			});
		} else {
			callback();
		}
	}catch(err){
		console.log(err);
		log(DRAGON_HOME + '/portal/log/dragon.log', dtstr() + err + '\n');
	}

};

process.on('SIGINT', function(){
	if(EXIT_FLAG !== 1){
	    log(DRAGON_HOME + '/portal/log/dragon.log', dtstr() + 'stop server\n');
	    exit(function(){
			process.exit(0);
		});
	}
});

process.on('SIGTERM', function(){
	if(EXIT_FLAG !== 1){
	    log(DRAGON_HOME + '/portal/log/dragon.log', dtstr() + 'stop server\n');
	    exit(function(){
			process.exit(0);
		});
	}
});

server.listen(6666, function(){
	EXIT_FLAG = 0;
    log(DRAGON_HOME + '/portal/log/dragon.log', dtstr() + 'server starting.\n');
	bootstrap();
	mongolog();
});

