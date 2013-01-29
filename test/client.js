var ns = require('../lib/NodeSoul');

var client  = new ns.Client({
	login: 'paul_p',
	password: '',
	debug: true
}, function(err){
	client.auth(function(err){
		console.log('auth?', err);
		if (err) {
			process.exit(1);
		} else {
			client.status('actif');

			//client.sendTo('paul_p', 'bidou bidou');
			// client.who('paul_p', function(data){
			// 	console.log('who loic', data)
			// });
		}
	});
});

client.on('msg', function(data){
	console.log('new mess : ', data);

	console.log('===');
	console.log(data.user.login, data.msg)
})