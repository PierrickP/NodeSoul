var net = require('net'),
crypto = require('crypto'),
querystring = require('querystring'),
colors = require('colors'),
EventEmitter = require( "events" ).EventEmitter,
util = require('util');

function parseAnswer(d) {
	var data = d.toString();
	var raw = data.substr(0, data.length - 1);
	data = raw.split(" ");
	console.log(data);
	return {raw: raw, parsed: data};
}

function parseUser(d) {
	d = d.split(":");
	var u = d[3].split('@');
	return {
		socket: d[0],
		intern: (d[2] === '3/1') ? true : false,
		login: u[0],
		ip: u[1],
		workstation_type: d[4],
		location: d[5],
		promo: d[6]
	};
}

var Client = function(user, cb) {
	var client = this;

	this.login = user.login;
	this.password = user.password;
	this.location = user.location || 'NodeSoul';
	this.userdata = user.userdata || 'none';
	this.debug = user.debug || false;

	this.socketNumber, this.hash,
	this.clientHost, this.clientPort,
	this.timestamp, this.cbAuth,
	this.socket, this.authStep = 0,
	this.authError = null, this.cbWho;

	this.socket = net.connect({
		host: /*'localhost'*/'ns-server.epita.fr',
		port: 4242
	});

	this.socket.on('connect', function () {
		client._debug('Established connection');
		cb(null);
	});

	this.socket.on('data', function(data){
		var answer = parseAnswer(data);

		if (answer.parsed[0] === 'ping') {
			client._debug('ping');
			client.send('ping', answer.parsed[1]);
		}
		if (answer.parsed[0] === 'salut') {
			// salut <numéro de socket> <hash md5 aléatoire> <host Client> <port Client> <timestamp server>
			client.socketNumber = answer.parsed[1];
			client.hash = answer.parsed[2];
			client.clientHost = answer.parsed[3];
			client.clientPort = answer.parsed[4];
			client.timestamp = answer.parsed[5];
			cb(null);
		}
		if (answer.raw === 'rep 002 -- cmd end') {
			console.log('auth step', Client.authStep);
			//this.authStep++;
			client.auth();
		}

		if (answer.parsed[0] === 'rep' && answer.parsed[1] === '033') {
			client.authStep++;
			client.authError = "identification fail";
			client.auth();
		}

		if (answer.parsed[0] === 'user_cmd') {
			/*
			| msg
			| who
			| dotnetsoul	
			*/

			switch (answer.parsed[3]) {
				case 'who':
					cb(answer.raw);
				break;
				case 'msg':
					console.log('new message'.green);
					client.emit('msg', {user: parseUser(answer.parsed[1]), msg: querystring.unescape(answer.parsed[4])});
				break;

			}
		}
	});
};

Client.prototype = Object.create(require('events').EventEmitter.prototype);

Client.prototype._debug = function (msg) {
	if (this.debug) {
		var d = new Date();
		var formatedDate = d.getHours()+":"+d.getMinutes()+":"+d.getSeconds();
		console.log("[".grey+formatedDate.blue+"] ".grey+msg.green);
	}
};

Client.prototype.send = function (cmd, data){
	this._debug('send : '+cmd+" "+data);
	this.socket.write(cmd+" "+data+'\n');
};

Client.prototype.auth = function (cb) {
	if (this.authStep === 0) {
		this.cbAuth = cb;
		this.authStep++;
		this.send('auth_ag', 'ext_user none none');
	} else if (this.authStep === 1) {
		// ext_user_log <login user> <chaîne md5 de réponse> <user data> <user location>
		// MD5("<hash md5 aléatoire>-<host client>/<port client><pass socks>")
		var hash = crypto.createHash('md5').update(this.hash+'-'+this.clientHost+'/'+this.clientPort+this.password).digest("hex");
		this.send('ext_user_log', this.login+' '+hash+' '+this.userdata+' '+this.location);
		this.authStep++;
	} else if (this.authStep === 2) {
		this.authStep++;
		this.cbAuth(this.authError);
	}
};

Client.prototype.status = function (status) {
	this._debug('Status changed for '+status);
	var timestamp = new Date().getTime();
	this.send('state', status+':'+timestamp);
};

Client.prototype.sendTo = function (login, msg) {
	// user_cmd msg_user rn msg test
	this.send('user_cmd', 'msg_user '+login+' msg '+querystring.escape(msg));
};

Client.prototype.who = function (login, cb) {
	this.cbWho = cb;
	this.send('user_cmd', 'who '+login);
};

exports.Client = Client;

