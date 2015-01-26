var db = require('../lib/dataBase'),
	moment = require('moment'),
	server = require('../lib/communicate'),
	log4js = require('log4js');

log4js.configure({
    appenders: [
        {
            type: "file",
            filename: "./log/server.log",
            category: 'server',
			maxLogSize: 20 * 1024 * 1024,
			backup: 5
        },        
        {
        	type: "console"
        }
    ],
    replaceConsole: true
});
var logger = log4js.getLogger('server');

var udpServer = new server.communicate({logger: logger});
udpServer.addEventListener("channel-connect", function (data, id){
	var device = udpServer.getDeviceInfo(id);
	logger.info("device " + id + " connected! Device is " + JSON.stringify(device));
	//db.updateUserStatus(id, true);
});

udpServer.addEventListener("channel-disconnect", function (data, id){
	var device = udpServer.getDeviceInfo(id);
	logger.info("device " + id + " disconnect! Device is " + JSON.stringify(device));
	//db.updateUserStatus(id, false);
});

udpServer.addEventListener("channel-heartbeat", function (data, id){
	var device = udpServer.getDeviceInfo(id);
	logger.info("device " + id + " heartbeat! Device is " + JSON.stringify(device));
	//db.updateUserStatus(id, true);
});

udpServer.addEventListener("channel-receive", function (data, id){
	var device = udpServer.getDeviceInfo(id);
	logger.info("device " + id + " receive [" + data + "]! Device is " + JSON.stringify(device));
	//db.updateUserStatus(id, true);
});

udpServer.start();

exports.login = function(req, res){
	"use strict";
	
	res.render('login', { title: 'Login' });
};

exports.doLogin = function(req, res){
	"use strict";
	
	var name = req.body.username,
		pwd = req.body.password;
	
	logger.info('doLogin...name:' + name + ' password:' + pwd);
	db.authenticate(name, pwd, function (user){
		if(user !== undefined && user !== null){			
			if (user.level === 'normal'){
				req.session.user=user;
				return res.redirect('/home');
			} 
			else if(user.level === 'super'){
				req.session.user=user;
				return res.redirect('/admin');
			}
			else{
				req.session.error="未授权用户";
				return res.redirect('/');
			}
		}
		else {
			req.session.error="用户名密码错误，请重新输入！";
			return res.redirect('/');
		}
	});	
};

exports.doModifyPwd = function (req, res){
	"use strict";
	
	if(!req.session.user){
		res.send('session expired');
		return;
	}
	var oldpwd = req.body.oldpwd,
		newpwd = req.body.newpwd;
	
	logger.info('doModifyPwd...old pwd:' + oldpwd + ' new pwd:' + newpwd);
	db.getUserById(req.session.user._id.toString(), function (user){
		if(user !== undefined && user !== null){
			if(user.password === oldpwd){
				db.updateUserPass(req.session.user._id.toString(), newpwd);
				res.send('success');
			}
			else{
				res.send('密码错误！');
			}
		}
	});	
	
};

exports.doAddUser = function (req, res){
	"use strict";	

	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var name = req.body.username,
		channel = req.body.channel;	
		
	logger.info('doAddUser...user name:' + name + ' channel:' + channel);
	var user = {relateid: req.session.user._id.toString(), userid: name, channel: channel};
	db.addDevice(user, function (saved){
		if (saved === 'Repeated'){
			res.send('用户ID重复，请重新输入');
		}
		else {
			res.send('success');
		}
		
	});
};

exports.doRemoteDel = function (req, res) {
	"use strict";
	
	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var uid = req.body.userid,
	ch = req.body.channel,
	accid = req.session.user._id.toString();

	db.getDeviceByUserId(accid, uid, function(device){
		if(device !== undefined && device !== null){
			udpServer.remoteDel(req.session.user.deviceId, uid, ch, function (err, bytes){
				if(bytes > 0){
					if(err == 'answer'){
						answer = "Y";
						res.send('success');
					}
					else
						res.send('删除失败');
				}
				else {
					logger.info('doRemoteDel failed, caused by [' + err + ']');
					res.send(err);
				}
			});
		} else {
			logger.info('doRemoteDel failed, caused by [' + uid + ':' + ch + '] not found!');
			res.send("设备 [" + uid + ":" + ch + "] 未找到，请重新添加！");
		}
	});	
	logger.info('doRemoteDel...use id:' + uid);
};

exports.doSend = function (req, res){
	"use strict";
	
	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var msg = req.body.message,
		uid = req.body.userid,
		ch = req.body.channel,
		accid = req.session.user._id.toString(),
		datetime = moment().format("YYYY-MM-DD HH:mm:ss");
	
	logger.info('doSend...userid:' + uid + ' channel:' + ch + ' message:' + msg);
	db.getDeviceByUserId(accid, uid, function(device){
		if(device !== undefined && device !== null){
			udpServer.send(req.session.user.deviceId, uid, ch, 0, msg, function (err, bytes){
				if(bytes > 0){
					var answer = "N";
					if(err == 'answer'){
						answer = "Y";
					}
					db.getHistoryNumber(accid, function (num){
						db.addToHistory({accoutid: accid, 	// user表_id
										userid: uid,		// device表userid
										channel: ch,		// device表channel
										index: num+1, 		// 编号
										time: datetime, 	// 发送时间戳
										answer: answer, 	// 设备是否有应答
										message: msg},		// 发送数据
										function (saved){
											logger.info('doSend success');
											res.send('success');
										});	
					});
				}
				else {
					logger.info('doSend failed, caused by [' + err + ']');
					res.send(err);
				}
			});
		} else {
			logger.info('doSend failed, caused by [' + uid + ':' + ch + '] not found!');
			res.send("设备 [" + uid + ":" + ch + "] 未找到，请重新添加！");
		}
	});
	
};

exports.doDeleteUser = function (req, res) {
	"use strict";
	
	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var id = req.body.id;
	logger.info('doDeleteUser...use id:' + id);
	db.removeDevice(id, function (data){
		res.send(data);
	});
	
};

exports.getUserIds = function (req, res){
	"use strict";
	
	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var _id = req.session.user._id.toString(),
		page = req.query.page,
		rows = req.query.rows;
	
	logger.info('getUserIds...page:' + page + ' rows:' + rows);
	db.getDevicesCount(_id, function (count){
		db.getDevicesByPage(_id, page, rows, function (users){			
			res.send({total:count, rows:users});
		});
	});
	
};

exports.getHistory = function (req, res){
	"use strict";
	
	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var accid = req.session.user._id.toString(),
		page = req.query.page,
		rows = req.query.rows;
	
	logger.info('getHistory...page:' + page + ' rows:' + rows);
	db.getHistoryCount(accid, function (count){
		db.getHistoryByPage(accid, page, rows, function (his){
			res.send({total:count, rows:his});
		});
	});	
};

exports.doClearHistory = function (req, res){
	"use strict";
	
	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var _id = req.session.user._id.toString();
	logger.info('doClearHistory..._id:' + _id);
	db.removeHistory(_id, function (data){
		res.send(data);
	});	
};

exports.logout = function(req, res){
	"use strict";
	
	req.session.user=null;
	res.redirect('/');
};

exports.home = function(req, res){
	"use strict";
	
  	res.render('home', { title: 'Home'});
};

exports.admin = function(req, res){
	"use strict";
	
  	res.render('admin', { title: 'Adminstrator'});
};