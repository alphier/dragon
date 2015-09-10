exports.communicate = function (spec) {
	"use strict";
	
	var dgram = require('dgram'),
		db = require('./dataBase'),
		INTERVAL_TIME_KEEPALIVE = 500,
		TIMEOUT_SENDING = 2000,
		READY = 0,
		SENDING = 1,
		RECEIVE_ANSWER = 2,
		RECEIVE_DEL_ANSWER = 3,
		DELETING = 4,
		SETTING = 5,
		RECEIVE_SET_ANSWER = 6,
		server = dgram.createSocket('udp4'),
		DIS_TIME = 5 * 60 * 1000,	//断线时长设置为1小时
		INTERVAL_TIME = 5000,
		ANSWER = 0xaa5b,
		that = {},
		eventListeners = {},
		hashMap = {},
		logger = spec.logger,
		channelEvent  = function (spec) {
			"use strict";
			
			var that = {};
			that.data = "";
			that.type = "";
			if(spec.hasOwnProperty('type'))
				that.type = spec.type;
			if(spec.hasOwnProperty('data'))
				that.data = spec.data;		
			return that;
		},
		dispatchEventListener = function (event,index) {
			if (eventListeners.hasOwnProperty(event.type)) {
				for (var listener in eventListeners[event.type]) {
		    		if (eventListeners[event.type].hasOwnProperty(listener)) {
		        		eventListeners[event.type][listener](event.data,index);
		    		}
				}
			}
		},
		interval = setInterval(function(){
			//清理长时间未收到心跳的设备
			for(var index in hashMap){
				if(new Date() - hashMap[index].timestamp > DIS_TIME){					
					var evt = new channelEvent({type:'channel-disconnect'});
					dispatchEventListener(evt,index);
					delete hashMap[index];
					break;
				}
			}
		}, INTERVAL_TIME),
		answerDevice = function (address, port, callback){
			//回复设备
			var answer = new Buffer(2);
			answer.writeUInt16BE(ANSWER, 0);
			server.send(answer, 0, answer.length, port, address, function (err, bytes){				
				callback(err, bytes);
			});
		},
		assembleMsgPacket = function (msg, ch, uid, idx) {
			var msgbuffer = new Buffer(msg.length + 9);
			msgbuffer.writeUInt8(0xaa, 0);					//报文头
			msgbuffer.writeUInt8(0xc1, 1);					//指令，表明是数据
			msgbuffer.writeUInt8(parseInt(ch), 2);			//频道号
			msgbuffer.writeUInt16BE(parseInt(uid), 3);		//用户ID
			msgbuffer.writeUInt8(msg.length+2, 5);			//数据长度+开始位+校验和
			msgbuffer.writeUInt8(idx, 6);			//数据编号
			msgbuffer.writeUInt8(0x00, 7);			//开始位
			msgbuffer.write(msg, 8);				//发送数据

			var sum = 0;
			for (var i in msgbuffer.toJSON()){
				if(i == msgbuffer.length-1 )
					break;
				sum += msgbuffer[i];
			}

			var tmp = new Buffer(2);
			tmp.writeUInt16BE(sum, 0);

			msgbuffer.writeUInt8(tmp[1], 8+msg.length);		//校验和
			
			return msgbuffer;
		},
		assembleSetInst = function (ch, uid, id) {
			var setbuffer = new Buffer(10);
			setbuffer.writeUInt8(0xaa, 0);					//报文头
			setbuffer.writeUInt8(0xc0, 1);					//指令，表明是设置
			setbuffer.writeUInt8(parseInt(ch), 2);			//频道号
			setbuffer.writeUInt16BE(parseInt(uid), 3);		//用户ID
			setbuffer.writeUInt8(0x04, 5);					//2+1+1
			setbuffer.writeUInt8(0xc0, 6);
			setbuffer.writeUInt8(0x01, 7);
			setbuffer.writeUInt8(parseInt(id), 8);			//设置id
			var sum = 0;
			for (var i in setbuffer.toJSON()){
				if(i == setbuffer.length-1 )
					break;
				sum += setbuffer[i];
			}
			var tmp = new Buffer(2);
			tmp.writeUInt16BE(sum, 0);
			setbuffer.writeUInt8(tmp[1], 9);				//校验和
			
			return setbuffer;
		},
		assembleDelInst = function (ch, uid, id) {
			var dbuf = new Buffer(10);
			dbuf.writeUInt8(0xaa, 0);					//报文头
			dbuf.writeUInt8(0x7a, 1);					//指令，表明是删除
			dbuf.writeUInt8(parseInt(ch), 2);			//频道号
			dbuf.writeUInt16BE(parseInt(uid), 3);		//用户ID
			dbuf.writeUInt8(0x04, 5);					//长度：2+1+1
			dbuf.writeUInt8(0x7a, 6);
			dbuf.writeUInt8(0x01, 7);
			dbuf.writeUInt8(parseInt(id), 8);			//设置id
			var sum = 0;
			for (var i in dbuf.toJSON()){
				if(i == dbuf.length-1 )
					break;
				sum += dbuf[i];
			}
			var tmp = new Buffer(2);
			tmp.writeUInt16BE(sum, 0);
			setbuffer.writeUInt8(tmp[1], 9);			//校验和
			
			return dbuf;
		};
		
	
	that.addEventListener = function (eventType, listener) {
		"use strict";

		if (!eventListeners.hasOwnProperty(eventType)) {
	    	eventListeners[eventType] = [];
		}
		eventListeners[eventType].push(listener);
	};
	
	that.removeEventListener = function (eventType, listener) {
		"use strict";

		if (eventListeners.hasOwnProperty(eventType)) {	    	
			var index = eventListeners[eventType].indexOf(listener);
			if (index !== -1) {
	    		eventListeners[eventType].splice(index, 1);
			}
		}
	};
	
	that.getDeviceInfo = function(deviceId) {
		"use strict";
		
		if(hashMap.hasOwnProperty(deviceId)){
			return hashMap[deviceId];
		}
		return null;
	};
	
	that.remoteDel = function (deviceId, userId, channel, callback){
		"use strict";
		
		if(hashMap.hasOwnProperty(deviceId)){
			var buf = assembleDelInst(channel, userId);
			logger.info('deleting device ' + deviceId + ' channel:' + channel + ' userId:' + userId);
			server.send(buf, 0, buf.length, hashMap[deviceId].port, hashMap[deviceId].ip, 
				function (err, bytes){
					logger.info('sending ' + bytes +  ' bytes to ' + hashMap[deviceId].ip + ':' + hashMap[deviceId].port);
					if(bytes > 0){
						hashMap[deviceId].state = DELETING;
						hashMap[deviceId].sendTs = new Date();
						var intervalId = setInterval(function (){
							//收到设备应答
							if(hashMap[deviceId].state === RECEIVE_DEL_ANSWER){
								hashMap[deviceId].state = READY;
								clearInterval(intervalId);
								callback('answer', bytes);
							}
							//2s没有收到answer，认为无应答
							if(new Date() - hashMap[deviceId].sendTs > TIMEOUT_SENDING){
								hashMap[deviceId].state = READY;
								clearInterval(intervalId);
								callback('no answer', bytes);
							}							
						}, INTERVAL_TIME_KEEPALIVE);
					}
					else {
						callback('发送出错', -1);
					}
			});
		} else {
			callback('设备未上线', -1);
		}
	};
	
	that.send = function(deviceId, userId, channel, type, msg, callback) {
		"use strict";
		
		if(hashMap.hasOwnProperty(deviceId)){			
			hashMap[deviceId].sendIdx += 1;
			if(hashMap[deviceId].sendIdx >= 255)
				hashMap[deviceId].sendIdx = 0;
			var buf = assembleMsgPacket(msg, channel, userId, hashMap[deviceId].sendIdx);
			logger.info('sending message to device ' + deviceId + ' channel:' + channel + ' userId:' + userId);			
			server.send(buf, 0, buf.length, hashMap[deviceId].port, hashMap[deviceId].ip, 
				function (err, bytes){
					logger.info('sending ' + bytes +  ' bytes to ' + hashMap[deviceId].ip + ':' + hashMap[deviceId].port);
					if(bytes > 0){
						hashMap[deviceId].state = SENDING;						
						hashMap[deviceId].sendTs = new Date();
						var intervalId = setInterval(function (){
							//收到设备应答
							if(hashMap[deviceId].state === RECEIVE_ANSWER){
								hashMap[deviceId].state = READY;
								clearInterval(intervalId);
								callback('answer', bytes);
							}
							
							//2s没有收到answer，认为无应答
							if(new Date() - hashMap[deviceId].sendTs > TIMEOUT_SENDING){
								hashMap[deviceId].state = READY;
								clearInterval(intervalId);
								callback('no answer', bytes);
							}
							
						}, INTERVAL_TIME_KEEPALIVE);
					}
					else {
						callback('发送出错', -1);
					}
			});
		}
		else{
			callback('设备未上线', -1);
		}
	};
	
	that.start = function () {
		"use strict";
	
		server.on("error", function (err) {
			logger.info("server error:\n" + err.stack);
			clearInterval(interval);
		  	server.close();
		});
		
		server.on('listening', function () {
		    var address = server.address();
		    logger.info('UDP Server listening on ' + address.address + ":" + address.port);
		});
		
		server.on('message', function (message, remote) {
			
			var buffer = new Buffer(message).toJSON();
		    if (buffer[0] === 85 && buffer.length === 3){  //means a heartbeat packet		    	
		    	buffer.splice(0, 1);
		    	var copy = new Buffer(buffer);
		    	var deviceId = copy.readUInt16BE(0).toString();
		    	if(hashMap.hasOwnProperty(deviceId)){
		    		//设备已存在
		    		var tmp = hashMap[deviceId];
		    		tmp.timestamp = new Date();
		    		tmp.ip = remote.address;
		    		tmp.port = remote.port;
		    		hashMap[deviceId] = tmp;
		    		var evt = new channelEvent({type:'channel-heartbeat'});
		    		dispatchEventListener(evt,deviceId);		    		
		    		answerDevice(remote.address, remote.port, function (err, bytes){
		    			logger.info('Heartbeat answer!!! sending ' + bytes +  ' bytes');
		    		});
		    	}
		    	else {
		    		db.authticateDevice(deviceId, function (result){
		    			if(result){
			    			hashMap[deviceId] = {timestamp:new Date(),ip:remote.address,port:remote.port,state:READY,sendIdx:0};
				    		var evt = new channelEvent({type:'channel-connect'});
				    		dispatchEventListener(evt,deviceId);				    		
				    		answerDevice(remote.address, remote.port, function (err, bytes){
				    			logger.info('New connection answer!!! sending ' + bytes +  ' bytes');
				    		});
		    			} else {
		    				logger.info('Unregistered device heartbeat incoming!!! From device ' + deviceId + ' [' + remote.address + ':' + remote.port + ']');
		    			}
		    		});
		    	}
		    } else if (buffer.length === 2 && buffer[1] === 0x00){ //收到发送数据应答
		    	for(var idx in hashMap){
			    	if(hashMap.hasOwnProperty(idx) && 
			    		hashMap[idx].ip === remote.address && 
			    		hashMap[idx].port === remote.port){
					    buffer.splice(0, 2);
					    var copy = new Buffer(buffer);
				    	var answerId = copy.readUInt16LE(0);
				    	//该设备的发送编号和应答编号一致且该设备处于发送状态
				    	if(answerId === hashMap[idx].sendIdx && 
				    		hashMap[idx].state === SENDING ){
				    		//将该设备状态置为应答状态
				    		hashMap[idx].state = RECEIVE_ANSWER;
							break;
				    	}
			    	}
			    }
		    } else if (buffer.length === 2 && 
		    		buffer[0] === 0x7a && 
		    		buffer[1] === 0x01) {//收到远程删除应答
		    	for(var idx in hashMap){
			    	if(hashMap.hasOwnProperty(idx) && 
			    		hashMap[idx].ip === remote.address && 
			    		hashMap[idx].port === remote.port){
				    	if(hashMap[idx].state === DELETING ){
				    		hashMap[idx].state = RECEIVE_DEL_ANSWER;
							break;
				    	}
			    	}
			    }
		    } else if(buffer.length === 2 && 
		    		buffer[0] === 0xc0 && 
		    		buffer[1] === 0x01){	//收到设置id应答
		    	for(var idx in hashMap){
			    	if(hashMap.hasOwnProperty(idx) && 
			    		hashMap[idx].ip === remote.address && 
			    		hashMap[idx].port === remote.port){
				    	if(hashMap[idx].state === SETTING ){
				    		hashMap[idx].state = RECEIVE_SET_ANSWER;
							break;
				    	}
			    	}
			    }
		    } 
		    else {
			    for(var idx in hashMap){
			    	if(hashMap.hasOwnProperty(idx) && 
			    		hashMap[idx].ip === remote.address && 
			    		hashMap[idx].port === remote.port){
					    var evt = new channelEvent({type:'channel-receive',data:message});
			    		dispatchEventListener(evt,idx);			    		
			    		answerDevice(remote.address, remote.port, function (err, bytes){
			    			logger.info('Receive message answer!!! sending ' + bytes +  ' bytes');
			    		});
						break;
			    	}
			    }
		    }
		});
		
		server.on('close', function () {
			logger.info('udp server closed...');
		});
		
		server.bind(1000);
	};
	
	return that;
};