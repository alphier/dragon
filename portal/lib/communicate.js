exports.communicate = function (spec) {
	"use strict";
	
	var dgram = require('dgram'),
		db = require('./dataBase'),
		iconv = require('iconv-lite'),
		MAX_INDEX = 255,
		INTERVAL_TIME_KEEPALIVE = 500,
		TIMEOUT_SENDING = 10000,
		READY = 0,
		SENDING = 1,
		RECEIVE_ANSWER = 2,
		RECEIVE_DEL_ANSWER = 3,
		DELETING = 4,
		SETTING = 5,
		RECEIVE_SET_ANSWER = 6,
		server = dgram.createSocket('udp4'),
		DIS_TIME = 60 * 60 * 1000,	//断线时长设置为1小时
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
			var gbkbuf = iconv.encode(msg, 'GBK');
			var len = gbkbuf.length;
			var msgbuffer = new Buffer(len + 9);
			msgbuffer.writeUInt8(0xaa, 0);					//报文头
			msgbuffer.writeUInt8(0xc1, 1);					//指令，表明是数据
			msgbuffer.writeUInt8(parseInt(ch), 2);			//频道号
			msgbuffer.writeUInt16BE(parseInt(uid), 3);		//用户ID
			var offset = 0;
			if(idx >= 0 && idx < 256){
				msgbuffer.writeUInt8(len+3, 5);			//数据长度+编号(1字节)+开始位(1字节)+校验和(1字节)
				msgbuffer.writeUInt8(idx, 6);			//数据编号
				offset = 7;
			} else {
				msgbuffer.writeUInt8(len+4, 5);			//数据长度+编号(2字节)+开始位(1字节)+校验和(1字节)
				msgbuffer.writeUInt16BE(idx, 6);		//数据编号
				offset = 8;
			}
			msgbuffer.writeUInt8(0x00, offset);			//开始位
			offset += 1;
			for(var i=0;i<gbkbuf.length;i++){
    			msgbuffer.writeUInt8(gbkbuf[i], offset+i);
			}

			var sum = 0,
				nbuf = new Buffer(msgbuffer).toJSON(),
                data = new Buffer(nbuf);
			for (var i=0;i<data.length-1;i++){
				sum += data[i];
			}
			var tmp = new Buffer(2);
			tmp.writeUInt16BE(sum, 0);
			msgbuffer.writeUInt8(tmp[1], offset+len);		//校验和
			
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
			setbuffer.writeUInt8(parseInt(id), 8);			//未知位，待确认
			var sum = 0,
                nbuf = new Buffer(setbuffer).toJSON(),
				data = new Buffer(nbuf);
			for (var i=0;i<data.length-1;i++){
                sum += data[i];
            }
			var tmp = new Buffer(2);
			tmp.writeUInt16BE(sum, 0);
			setbuffer.writeUInt8(tmp[1], 9);				//校验和
			
			logger.debug('SET ID...buffer:',setbuffer.toJSON());
			
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
			dbuf.writeUInt8(parseInt(id), 8);			//未知位，待确认
			var sum = 0,
                nbuf = new Buffer(dbuf).toJSON(),
                data = new Buffer(nbuf);
            for (var i=0;i<data.length-1;i++){
                sum += data[i];
            }

			var tmp = new Buffer(2);
			tmp.writeUInt16BE(sum, 0);
			dbuf.writeUInt8(tmp[1], 9);			//校验和
			
			logger.debug('Remote delete...buffer:',dbuf.toJSON());
			
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

	that.setId = function (deviceId, userId, channel, callback){
		"use strict";
		
		if(hashMap.hasOwnProperty(deviceId)){
			var buf = assembleSetInst(channel, userId, 0);
			server.send(buf, 0, buf.length, hashMap[deviceId].port, hashMap[deviceId].ip, 
				function (err, bytes){
					if(bytes > 0){
						hashMap[deviceId].state = SETTING;
            			hashMap[deviceId].sendTs = new Date();
						logger.info('Send setId success...');
						var intervalId = setInterval(function (){
							//收到设备应答
							if(hashMap[deviceId].state === RECEIVE_SET_ANSWER){
								hashMap[deviceId].state = READY;
								clearInterval(intervalId);
								callback('answer', bytes);
							}
							//10s没有收到answer，认为无应答
							if(new Date() - hashMap[deviceId].sendTs > TIMEOUT_SENDING){
								logger.debug('!!!!!!!!!!!!!setID answer timeout...');
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
	
	that.remoteDel = function (deviceId, userId, channel, callback){
		"use strict";
		
		if(hashMap.hasOwnProperty(deviceId)){
			var buf = assembleDelInst(channel, userId, 0);
			server.send(buf, 0, buf.length, hashMap[deviceId].port, hashMap[deviceId].ip, 
				function (err, bytes){
					if(bytes > 0){
						logger.info('Send remoteDel success...');
						hashMap[deviceId].state = DELETING;
						hashMap[deviceId].sendTs = new Date();
						var intervalId = setInterval(function (){
							//收到设备应答
							if(hashMap[deviceId].state === RECEIVE_DEL_ANSWER){
								hashMap[deviceId].state = READY;
								clearInterval(intervalId);
								callback('answer', bytes);
							}
							//10s没有收到answer，认为无应答
							if(new Date() - hashMap[deviceId].sendTs > TIMEOUT_SENDING){
								logger.debug('!!!!!!!!!!!!!RemoteDel answer  timeout...');
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
	
	that.send = function(deviceId, userId, channel, sendIdx, msg, callback) {
		"use strict";
		
		if(hashMap.hasOwnProperty(deviceId)){
			var buf = assembleMsgPacket(msg, channel, userId, sendIdx);
			server.send(buf, 0, buf.length, hashMap[deviceId].port, hashMap[deviceId].ip, 
				function (err, bytes){
					logger.info('sending ' + bytes +  ' bytes to ' + hashMap[deviceId].ip + ':' + hashMap[deviceId].port);
					if(bytes > 0){
						hashMap[deviceId].state = SENDING;						
						hashMap[deviceId].sendTs = new Date();
						hashMap[deviceId].sendIdx = sendIdx;
						var intervalId = setInterval(function (){
							//收到设备应答
							if(hashMap[deviceId].state === RECEIVE_ANSWER){
								hashMap[deviceId].state = READY;
								clearInterval(intervalId);
								callback('answer', bytes);
							}
							
							//10s没有收到answer，认为无应答
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
		    //loading hashMap from database
		    db.getAllUsers(function(users){
		    	for(var i in users){
		    		if(users[i].state === '在线'){
		    			hashMap[users[i].deviceId] = {timestamp:new Date(users[i].timestamp),
		    									ip:users[i].ip,port:users[i].port,
		    									state:READY,sendIdx:users[i].sendIndex};
		    		}
		    	}
		    });
		});
		
		server.on('message', function (message, remote) {
			var buf = new Buffer(message).toJSON(),
				buffer = new Buffer(buf);
			if(buffer[0] !== 85)	//0x55
				logger.info('receiving message:',buffer,' ip:',remote.address,' port:',remote.port);
			if (buffer[0] === 70 && buffer[1] === 76 && buffer.length === 2){	//连接指令 04 CE
				answerDevice(remote.address, remote.port, function (err, bytes){
                });
			}
		    else if (buffer[0] === 85 && buffer.length === 3){  //means a heartbeat packet 55 04 CE
		    	var deviceId = buffer.readUInt16BE(1).toString();
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
		    		});
		    	}
		    	else {
		    		db.authticateDevice(deviceId, function (result){
		    			if(result){
			    			hashMap[deviceId] = {timestamp:new Date(),ip:remote.address,port:remote.port,state:READY,sendIdx:0};
				    		var evt = new channelEvent({type:'channel-connect'});
				    		dispatchEventListener(evt,deviceId);
				    		answerDevice(remote.address, remote.port, function (err, bytes){
				    		});
		    			} else {
		    				logger.info('Unregistered device heartbeat incoming!!! From device ' + deviceId + ' [' + remote.address + ':' + remote.port + ']');
		    			}
		    		});
		    	}
		    } else if (buffer.length === 2 && 
		    		buffer[1] === 0x00){ 	//收到发送数据应答
		    	for(var idx in hashMap){
			    	if(hashMap.hasOwnProperty(idx) && 
			    		hashMap[idx].ip === remote.address && 
			    		hashMap[idx].port === remote.port){
				    	var answerId = buffer[0];
						logger.debug('receive device ' + idx + ' answer, answerId:' + answerId + ' sendId:' + hashMap[idx].sendIdx);
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
							logger.info('receive remoteDel answer...');
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
							logger.info('receive setID answer...');
				    		hashMap[idx].state = RECEIVE_SET_ANSWER;
							break;
				    	}
			    	}
			    }
		    } 
		    else {	//未知指令，回复0xaa5b
			    for(var idx in hashMap){
			    	if(hashMap.hasOwnProperty(idx) && 
			    		hashMap[idx].ip === remote.address && 
			    		hashMap[idx].port === remote.port){
			    		logger.info('receive unknown instruction...');
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
