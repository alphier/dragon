var collections = ["users", "devices", "history"],
	databaseUrl = "localhost/devicedb",
	BSON = require('mongodb').BSONPure,
	db = require("mongojs").connect(databaseUrl, collections),
	moment = require('moment');

////////////////////////user table//////////////////////////////
exports.getUser = function (name, callback) {
	"use strict";
	
	db.users.findOne({username: name}, function (err, user) {
        callback(user);
    });
};

exports.authenticate = function (name, pwd, callback){
	"use strict";
	
	db.users.findOne({username: name, password: pwd}, function (err, user) {
        callback(user);
    });
};

exports.getAllUsers = function (callback) {
	"use strict";
	
	db.users.find({level: 'normal'}).toArray(function (err, users) {
        callback(users);
    });
};

exports.getUsersCount = function (callback) {
	"use strict";
	
	db.users.find({}).count(function (err, count){
		callback(count);
	});
	
};

exports.getUsersByPage = function (page, rows, callback) {
	"use strict";	
	
	db.users.find({level: 'normal'}).skip((page-1)*rows).limit(rows).toArray(function (err, users){
		callback(users);
	});
};

exports.getUserById = function (id, callback) {
	"use strict";
	
	db.users.findOne({_id: new BSON.ObjectID(id)}, function (err, user) {
        callback(user);
    });
};

exports.getUserSendIdx = function (devId, callback){
	"use strict";
	
	db.users.findOne({deviceId: devId}, function (err, user) {
		if(user)
			callback(user.sendIndex);
		else
			callback(null);
    });
};

exports.authticateDevice = function (devId, callback) {
	"use strict";
	
	db.users.findOne({deviceId: devId}, function (err, user) {
		if(user !== undefined && user !== null){
			callback(true);
		}
		else {
			callback(false);
		}        
    });
};

exports.addUser = function (user, callback) {
    "use strict";
    db.users.findOne({username: user.username}, function (err, u) {
    	if (u !== undefined && u !== null){
    		callback('Repeated user');
    	}
    	else {
    		db.users.findOne({deviceId: user.deviceId}, function (err, s) {
    	    	if (s !== undefined && s !== null){
    	    		callback('Repeated device');
    	    	}
    	    	else {
    	    		db.users.save(user, function (error, saved) {
    	    	        callback(saved);
    	    	    });
    	    	}
    	    });
    	}
    });    
    
};

exports.updateUserPass = function (id, val) {
    "use strict";

    db.users.update({_id: new BSON.ObjectID(id)}, {$set:{password:val}});
};

exports.updateUserPassByName = function (name, val) {
    "use strict";

    db.users.update({username: name}, {$set:{password:val}});
};

exports.updateUserStatus = function (uid, status, ip, port, ts){
	"use strict";
	
	if(ip && port && ts)
		db.users.update({deviceId: uid}, {$set:{state:status, ip:ip, port:port, timestamp:ts}});
	else
		db.users.update({deviceId: uid}, {$set:{state:status}});
};

exports.updateUserSendIndex = function (uid){
	"use strict";
		
	db.users.findOne({deviceId: uid}, function (err, user) {
        if(user){
        	var idx = parseInt(user.sendIndex) + 1;
        	if(idx > 255) idx = 0;
        	db.users.update({deviceId: uid}, {$set:{sendIndex:idx}});
        }
    });
};

exports.updateHistorySendIndex = function (id, idx){
	"use strict";
		
	db.history.update({_id: new BSON.ObjectID(id)}, {$set:{sendIndex:idx}});
};

exports.updateHistoryTime = function (id){
	"use strict";
		
	db.history.update({_id: new BSON.ObjectID(id)}, {$set:{time:moment().format("YYYY-MM-DD HH:mm:ss")}});
};

exports.updateHistoryAnswer = function (id,ans){
	"use strict";
		
	db.history.update({_id: new BSON.ObjectID(id)}, {$set:{answer:ans}});
};

exports.updateUserMsg = function (uid, msg){
	"use strict";
	
	db.users.update({deviceId: uid}, {$set:{message:msg}});
};

exports.removeUserByName = function (name, callback) {
	"use strict";
	
	db.users.findOne({username: name}, function (err, user) {
        if (user !== undefined && user !== null){
        	db.users.remove({username: name});
        	db.devices.remove({relateid: user._id.toString()});
        	callback('success');
        } else {
        	callback('failed');
        }
    });
};

exports.removeUser = function (id, callback) {
	"use strict";
	
	db.users.findOne({_id: new BSON.ObjectID(id)}, function (err, user) {
        if (user !== undefined){
        	db.users.remove({_id: new BSON.ObjectID(id)});
        	db.devices.remove({relateid: user._id.toString()});
        	callback('success');
        }
        else {
        	callback('failed');
        }
    });
};

//////////////////device table//////////////////////////
exports.removeDevice = function (id, callback) {
	"use strict";
	
	db.devices.findOne({_id: new BSON.ObjectID(id)}, function (err, user) {
        if (user !== undefined){
        	db.devices.remove({_id: new BSON.ObjectID(id)});
        	callback('success');
        }
        else {
        	callback('failed');
        }
    });
};

exports.removeUserByDeviceId = function (id, callback) {
	"use strict";
	
	db.devices.findOne({deviceId: id}, function (err, user) {
        if (user !== undefined){
        	db.devices.remove({deviceId: id});
        	callback('success');
        }
        else {
        	callback('failed');
        }
    });
};

exports.getDevices = function (uid, callback) {
	"use strict";
	
	db.devices.find({relateid: uid}, function (err, devs) {
		callback(devs);
	});
};

exports.getDeviceByUserId = function (accid, uid, callback){
	"use strict";
	
	db.devices.findOne({relateid:accid, userid: uid}, function (err, device) {
		callback(device);
	});
};

exports.getDevicesCount = function (uid, callback) {
	"use strict";
	
	db.devices.find({relateid: uid}).count(function (err, count){
		callback(count);
	});
	
};

exports.getDevicesByPage = function (uid, page, rows, callback) {
	"use strict";	
		
	db.devices.find({relateid: uid}).skip((page-1)*rows).limit(rows).toArray(function (err, devs){
		callback(devs);
	});
};

exports.addDevice = function (device, callback) {
	"use strict";
	
	db.devices.findOne({relateid: device.relateid,userid: device.userid}, function (err, user) {
    	if (user !== undefined && user !== null){
    		callback('Repeated');
    	}
    	else {
    		db.devices.save(device, function (error, saved) {
    	        callback(saved);
    	    });
    	}
    });	
};

////////////////////////history table//////////////////////////////
exports.getHistory = function (accid, callback) {
	"use strict";
	
	db.history.find({accoutid: accid}, function (err, history){
		callback(history);
	});
};

exports.getHistoryByPage = function (accid, page, rows, callback) {
	"use strict";	
		
	db.history.find({accoutid: accid}).sort({index:1}).skip((page-1)*rows).limit(rows).toArray(function (err, history){
		callback(history);
	});
};

exports.getHistoryCount = function (accid, callback) {
	"use strict";
	
	db.history.find({accoutid: accid}).count(function (err, count){
		callback(count);
	});
	
};

exports.addToHistory = function (hitem, callback) {
	"use strict";
	
	db.history.save(hitem, function (error, saved) {
        callback(saved);
    });
};

exports.getHistoryNumber = function (accid, callback) {
	"use strict";
	
	db.history.find({accoutid: accid}, function (err, history){
		if(history !== undefined && history !== null){
			callback(history.length);
		} else {
			callback(0);
		}
	});
};

exports.removeHistory = function (accid, callback) {
	"use strict";
	
	db.history.remove({accoutid: accid});
	callback('success');
};