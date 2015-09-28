var db = require('../lib/dataBase'),
	moment = require('moment'),
	server = require('../lib/communicate'),
	log4js = require('log4js'),
	MAX_LENGTH = 80;

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
	var device = udpServer.getDeviceInfo(id),
		datetime = moment().format("YYYY-MM-DD HH:mm:ss");
	db.updateUserStatus(id, '在线', datetime);
	logger.info("device " + id + " connected! Device is " + JSON.stringify(device));
});

udpServer.addEventListener("channel-disconnect", function (data, id){
	var device = udpServer.getDeviceInfo(id);
	db.updateUserStatus(id, '不在线');
	logger.info("device " + id + " disconnect! Device is " + JSON.stringify(device));
});

udpServer.addEventListener("channel-heartbeat", function (data, id){
	var datetime = moment().format("YYYY-MM-DD HH:mm:ss");
	db.updateUserStatus(id, '在线', datetime);
	logger.info("device " + id + " heartbeat! Device is " + id);
});

udpServer.addEventListener("channel-receive", function (data, id){
	var device = udpServer.getDeviceInfo(id);
	logger.info("device " + id + " receive [" + data + "]! Device is " + JSON.stringify(device));
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

exports.doModifyPwd1 = function (req, res){
	"use strict";
	
	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var name = req.body.username,
		pwd = req.body.password;
	
	logger.info('doModifyPwd...name:' + name);
	db.getUser(name, function(user){
		if(user !== undefined && user !== null){
			db.updateUserPassByName(name, pwd);
			res.send('success');
		}
		else {
			res.send('未找到该用户');
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
		password = req.body.password,
		deviceid = req.body.deviceid;
		
	logger.info('doAddUser...user name:' + name);
	var user = {username: name, password: password, deviceId: deviceid, state:'不在线', level: 'normal'};
	db.addUser(user, function (saved){
		if (saved === 'Repeated user'){
			res.send('用户名重复，请重新输入');
		} 
		else if(saved === 'Repeated device'){
			res.send('设备编号重复，请重新输入');
		} 
		else {
			res.send('success');
		}
		
	});
};

exports.doAddDevice = function (req, res){
	"use strict";	

	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var name = req.body.username,
		channel = req.body.channel;	
		
	logger.info('doAddUser...user name:' + name + ' channel:' + channel);
	var dev = {relateid: req.session.user._id.toString(), userid: name, channel: channel};
	db.addDevice(dev, function (saved){
		if (saved === 'Repeated'){
			res.send('用户ID重复，请重新输入');
		}
		else {
			res.send('success');
		}
		
	});
};

exports.doSetID = function (req, res) {
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
            udpServer.setId(req.session.user.deviceId, uid, ch, function (err, bytes){
                if(bytes > 0){  
                    if(err == 'answer'){
						logger.info('setID success');
                        res.send('success');    
                    }                   
                    else                
                        res.send('设置失败');   
                }               
                else {          
                    logger.info('doSetID failed, caused by [' + err + ']');
                    res.send(err);      
                }               
            });         
        } else {
            logger.info('doSetID failed, caused by [' + uid + ':' + ch + '] not found!');
            res.send("设备 [" + uid + ":" + ch + "] 未找到，请重新添加！");
        }       
    }); 
    logger.info('doSetID...use id:' + uid);
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
						logger.info('remoteDel success');
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

function splitMsg(msg, max){
    var iconv = require('iconv-lite'),
        len = 0,
        n = 0,
        msgArr = [];
    for(var i=0;i<msg.length;i++){
        var buf = iconv.encode(msg[i], 'GBK');
		len += buf.length;
        if(len >= max){
			var sub = '';
			if(len > max){
				sub = msg.substring(n, i);
				n = i;
				len = 2;
			}
			else{
				sub = msg.substring(n, i+1);				
				n = i+1;
				len = 0;
			}
            msgArr.push(sub);
        }        
    }
	if(n < msg.length)	
		msgArr.push(msg.substring(n,msg.length));
	logger.info('Message split to ', msgArr);
	return msgArr;
};

function send(devId, uId, chId, msgarr, callback){
	var msg = msgarr[0];
	if(!msg) {
		logger.info('send over!!!');
		callback('success');
		return;
	}
	logger.info('send ', msg);
	udpServer.send(devId, uId, chId, 0, msg, function (err, bytes){
		if(err === 'answer'){
			logger.info('send succeed!!!');
			msgarr.splice(0,1);
			send(devId, uId, chId, msgarr, callback);
		}else {
			logger.error('send failed...', err);
			callback(err);
			return;
		}
	});
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
			var msgArray = splitMsg(msg, MAX_LENGTH);
			send(req.session.user.deviceId, uid, ch, msgArray, function(result){
				var answer = "N";
				if(result === 'success'){
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
										if(result === 'success')
											res.send('success');
										else{
											res.send(result);
										}
									});	
				});				
			});
		} else {
			logger.info('doSend failed, caused by [' + uid + ':' + ch + '] not found!');
			res.send("设备 [" + uid + ":" + ch + "] 未找到，请重新添加！");
		}
	});
	
};

exports.doDeleteDevice = function (req, res) {
	"use strict";
	
	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var id = req.body.id;
	logger.info('doDeleteDevice...use id:' + id);
	db.removeDevice(id, function (data){
		res.send(data);
	});
	
};

exports.doDeleteUser = function (req, res) {
	"use strict";
	
	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var name = req.body.name;
	logger.info('doDeleteUser...name:' + name);
	db.removeUserByName(name, function (data){
		res.send(data);
	});
	
};

exports.getUsers = function (req, res){
	"use strict";
	
	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var	page = req.query.page,
		rows = req.query.rows;
	
	logger.info('getUsers...page:' + page + ' rows:' + rows);
	db.getUsersCount(function(count){
		db.getUsersByPage(page, rows, function (users){
			res.send({total:count, rows:users});
		});		
	});
};

exports.getDevices = function (req, res){
	"use strict";
	
	if(!req.session.user){
		res.send('session expired');
		return;
	}
	
	var _id = req.session.user._id.toString(),
		page = req.query.page,
		rows = req.query.rows;
	
	logger.info('getDevices...page:' + page + ' rows:' + rows);
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
