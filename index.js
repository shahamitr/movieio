var restify = require('restify');
var builder = require('botbuilder');

//=========================================================
// Bot Setup
//=========================================================
// Setup Restify Server
var server = restify.createServer();
server.listen(3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// server.listen(process.env.port || process.env.PORT || 3978, function () {
   // console.log('%s listening to %s', server.name, server.url); 
// });


// Create chat bot
var connector = new builder.ChatConnector({
    appId: "c230e4e1-42b9-4a35-b30e-e024908950a5",
    appPassword: "n7YkXwbnn5hp59WKESPe0em"
});

var bot = new builder.UniversalBot(connector);

server.post('/api/messages', connector.listen());

var optionData = {
    "Movies": {
        id: 1,
        category: "Movies"
    },
    "TV Shows": {
        id: 2,
        category: "TV Shows"
    },
    "Celebrity": {
        id: 3,
        category: "Celebrity"
    }
};

bot.dialog('/', [
	function(session)  
	{  
		session.send("Hey there, I can help you with finding lots of things about following!!");
		builder.Prompts.choice(session, "What would you like to search for?", optionData);
	},
	function (session, results) {
        if (results.response) {
            var selectedOption = optionData[results.response.entity];
            session.send("Which %(category)s, you would like to know about.", selectedOption);
        } else {
            session.send("ok");
        }
    }
]);