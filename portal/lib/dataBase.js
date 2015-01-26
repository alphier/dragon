var collections = ["users", "devices", "history"],
	databaseUrl = "localhost/devicedb",
	BSON = require('mongodb').BSONPure,
	db = require("mongojs").connect(databaseUrl, collections);

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

exports.getAllUsers = function (name, callback) {
	"use strict";
	
	var res = db.users.find();
	res.toArray(function (err, users) {
        callback(users);
    });
};

exports.getUserById = function (id, callback) {
	"use strict";
	
	db.users.findOne({_id: new BSON.ObjectID(id)}, function (err, user) {
        callback(user);
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

    db.users.findOne({username: user.username}, function (err, user) {
    	if (user !== undefined && user !== null){
    		callback('Repeated user');    		
    	}
    	else {
    		db.users.findOne({deviceId: user.deviceId}, function (err, user) {
    	    	if (user !== undefined && user !== null){
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

exports.updateUserStatus = function (uid, status){
	"use strict";
	
	db.users.update({deviceId: uid}, {$set:{connected:status}});
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
	
	db.devices.find({relateid: uid}).limit(page*rows).skip((page-1)*rows).toArray(function (err, devs){
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
	
	db.history.find({accoutid: accid}).limit(page*rows).skip((page-1)*rows).toArray(function (err, history){
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