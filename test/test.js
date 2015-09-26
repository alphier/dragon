var dgram = require('dgram'),
	client = dgram.createSocket('udp4'),
	PORT = 1000,
	HOST = 'localhost';

function dtstr(){
    var dt = new Date();
	var dtstr = dt.getFullYear() + '-' + (dt.getMonth() + 1) + '-' + dt.getDate() +
				' ' + dt.getHours() + ':' + dt.getMinutes() + ':' + dt.getSeconds() + ' ';
	return dtstr;
};

function heartbeatInst(){
	var inst = new Buffer(3);
	inst.writeUInt8(0x55, 0);
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
	
	console.log(dtstr() + ' receive from ' + remote.address + ':' + remote.port + ' reply ' + data);
});

start();