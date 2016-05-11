var dgram = require('dgram'),
	client = dgram.createSocket('udp4'),
	iconv = require('iconv-lite'),
	PORT = 1000,
	HOST = '107.183.146.221';

function dtstr(){
    var dt = new Date();
	var dtstr = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate() +
				' ' + dt.getHours() + ':' + dt.getMinutes() + ':' + dt.getSeconds() + ' ';
	return dtstr;
};

function heartbeatInst(){
	var inst = new Buffer(3);
	inst.writeUInt8(0x55, 0);
	//deviceId: 1230
	inst.writeUInt8(0x04, 1);
	inst.writeUInt8(0xce, 2);
	return inst;
};

function start(){
	var cMsg = heartbeatInst();	
	setInterval(function(){
		client.send(cMsg, 0, cMsg.length, PORT, HOST, function(err, bytes) {
			if (err) throw err;
			console.log(dtstr() + 'Connecting!!!' + HOST + ':' + PORT);
		});
	}, 5000);
};

client.on('message', function (msg, remote) {
	var buffer = new Buffer(msg).toJSON(),		
		data = new Buffer(buffer);
	if(data[0] === 0xaa && data[1] == 0xc1){	//接收数据
		//receive message
		var msgId = data.readUInt8(6),
			msgLen = data.readUInt8(5)-3,	
			msgBuffer = new Buffer(msgLen);
		data.copy(msgBuffer, 0, 8, 8+msgLen);
		var msg = iconv.decode(msgBuffer, 'GBK');
		console.log(dtstr() + ' receive message from ' + remote.address + ':' + remote.port + ' msg length:' + msgLen + ' msgId:' + msgId);
		console.log('message:' + msg);
		console.log('buffer:' + JSON.stringify(buffer));
		var inst = new Buffer(2);
		inst.writeUInt8(msgId, 0);
		inst.writeUInt8(0, 1);
		client.send(inst, 0, inst.length, PORT, HOST, function(err, bytes) {
			if (err) throw err;
			console.log(dtstr() + 'sending message answer!!!' + HOST + ':' + PORT);
		});
	}
	if(data[0] === 0xaa && data[1] === 0x5b){	//心跳回复
		console.log(dtstr() + 'receive hearbeat answer!!!',buffer);
	}
	if(data[0] === 0xaa && data[1] === 0xc0){	//设置ID
		console.log(dtstr() + 'receive set id message!!!',buffer);
		var inst = new Buffer(2);
		inst.writeUInt8(0xc0, 0);
		inst.writeUInt8(0x01, 1);
		client.send(inst, 0, inst.length, PORT, HOST, function(err, bytes) {
			if (err) throw err;
			console.log(dtstr() + 'sending set id answer!!!' + HOST + ':' + PORT);
		});
	}
	if(data[0] === 0xaa && data[1] === 0x7a){	//远程删除
		console.log(dtstr() + 'receive remote delete message!!!',buffer);
		var inst = new Buffer(2);
		inst.writeUInt8(0x7a, 0);
		inst.writeUInt8(0x01, 1);
		client.send(inst, 0, inst.length, PORT, HOST, function(err, bytes) {
			if (err) throw err;
			console.log(dtstr() + 'sending remote delete answer!!!' + HOST + ':' + PORT);
		});
	}
});

start();