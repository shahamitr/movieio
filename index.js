var restify = require('restify');
var builder = require('botbuilder');
var env = require('node-env-file');
var https = require('https');
var http = require('http');

env(__dirname + '/.env');

//=========================================================
// Bot Setup
//=========================================================
// Setup Restify Server
var server = restify.createServer();

console.log(server);

var os = require("os");
var hostname = os.hostname();

console.log(os);


server.listen(3900, function () {
   console.log('%s listening to %s', server.name, server.url); 
});

// server.listen(process.env.port || process.env.PORT || 3978, function () {
   // console.log('%s listening to %s', server.name, server.url); 
// });


// Create chat bot
// var connector = new builder.ChatConnector({
    // appId: "c230e4e1-42b9-4a35-b30e-e024908950a5",
    // appPassword: "n7YkXwbnn5hp59WKESPe0em"
// });

var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

server.post('/api/messages', connector.listen());

// var bot = new builder.UniversalBot(connector, function(session){
	// session.send("Welcome to the Movie.io bot, I can help you with finding lots of things about following!!");
	// session.beginDialog('selectOption');
// });

var bot = new builder.UniversalBot(connector);


var optionData = {
    "Movies": {
        id: 1,
        category: "Movie"
    },
    "TV Shows": {
        id: 2,
        category: "TV Show"
    },
    "Celebrity": {
        id: 3,
        category: "Celebrity"
    }
};

bot.dialog('/', [
    function (session, args, next) {
        if (!session.userData.name) {
            session.beginDialog('/profile');
        } else {
            next();
        }
    },
    function (session, results) {
        session.send('Hello %s!', session.userData.name);
		session.send("Welcome to the Movie.io bot, I can help you with finding detail on following!!");
		session.beginDialog('selectOption');
    }
]);

bot.dialog('/profile', [
    function (session) {
        builder.Prompts.text(session, 'Hi! What is your name?');
    },
    function (session, results) {
        session.userData.name = results.response;
        session.endDialog();
    }
]);


bot.dialog('selectOption', [
	function(session)  
	{  
		builder.Prompts.choice(session, "What would you like to search for? (please enter option e.g. 1/2/3)", optionData, {
            maxRetries: 2,
            retryPrompt: 'Ooops, what you wrote is not a valid option, please try again'
        });
	},
	function (session, results) {
        if (results.response) {
			if(optionData[results.response.entity]){
				var selectedOption = optionData[results.response.entity];
				session.dialogData.selectedOption = selectedOption;
				session.send('Please type %(category)s name, you would like to know about.',selectedOption);
				builder.Prompts.text(session, '');
			} else {
				session.send("ok");
			}
        } else {
            session.send("ok");
        }
    },
	function (session, results) {
		var apiKey = process.env.API_KEY_MOVIEDB;
		var selectedOption = session.dialogData.selectedOption.category;
		var url = "";
		
		if(selectedOption == 'Celebrity'){
			url = process.env.MOVIE_DB_URL+"search/person?api_key="+apiKey+"&query="+results.response;
		} else {
			url = process.env.MOVIE_DB_URL+"search/movie?api_key="+apiKey+"&query="+results.response;
		}
		
		session.sendTyping();
		
		https.get(url, function(res) {
		  //console.log(res);
		  var body = '';
		  res.on('data', function(data){
			body += data;
		  });
		  // After the response is completed, parse it
		  res.on('end', function() {
			var parsed = JSON.parse(body);
			console.log(parsed.results);
			var isDataPresent = false;
			var result_lenth = parsed.results.length;
			
			if(result_lenth >= 1){
				isDataPresent = true;
			}
			
			if(result_lenth > 1){
				session.send("Found %d results.",result_lenth);
			} else if(result_lenth == 0){
				session.send("Result not found for *%s* :(.",results.response);
			}
			
			if(isDataPresent == true) {
				var id;
				var name;
				var desc;
				var release_date;
				var poster;
				
				if(selectedOption != 'Celebrity'){
					var knowMore = process.env.KNOW_MORE_URL;
					if(result_lenth == 1) {
						var i = 0;
						id = parsed.results[i].id;
						name = parsed.results[i].original_title;
						desc = parsed.results[i].overview;
						release_date = parsed.results[i].release_date;
						if(parsed.results[i].poster_path!=null){
							poster = "https://image.tmdb.org/t/p/w640"+parsed.results[i].poster_path;
						} else {
							poster = process.env.NO_IMAGE_URL;
						}
						
						var msg = new builder.Message(session)
						.textFormat(builder.TextFormat.xml)
						.attachments([
							new builder.HeroCard(session)
								.title(name)
								.subtitle("Release Date: "+release_date)
								.text(desc)
								.images([
									builder.CardImage.create(session,poster)
								])
								.tap(builder.CardAction.openUrl(session, knowMore+id))
								.buttons([
									builder.CardAction.openUrl(session, knowMore+id, 'Know More')
								])
						]);
						session.send(msg);
					} else {
						var arrayOfResult = [];
						for(var i=0;i<result_lenth;i++) {
							id = parsed.results[i].id;
							name = parsed.results[i].original_title;
							desc = parsed.results[i].overview;
							release_date = parsed.results[i].release_date;
							if(parsed.results[i].poster_path!=null){
								poster = "https://image.tmdb.org/t/p/w640"+parsed.results[i].poster_path;
							} else {
								poster = process.env.NO_IMAGE_URL;
							}
							
							 arrayOfResult.push(
								new builder.ThumbnailCard(session)
									.title(name)
									.subtitle("Release Date: "+release_date)
									.text(desc.substr(0,200))
									.images([
										builder.CardImage.create(session,poster)
									])
									.tap(builder.CardAction.openUrl(session, knowMore+id))
									.buttons([
										builder.CardAction.openUrl(session, knowMore+id, 'Know More')
									])
							);
							//session.send(msg);
						}
						
						 // create reply with Carousel AttachmentLayout
						var reply = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments(arrayOfResult);
						session.send(reply);
					}
				} else {
					var knowMore = process.env.KNOW_MORE_PERSON_URL;
					if(result_lenth == 1) {
						var i = 0;
						id = parsed.results[i].id;
						name = parsed.results[i].name;
						if(parsed.results[i].profile_path!=null){
							poster = "https://image.tmdb.org/t/p/w640"+parsed.results[i].profile_path;
						} else {
							poster = process.env.NO_IMAGE_URL;
						}
						
						var msg = new builder.Message(session)
						.textFormat(builder.TextFormat.xml)
						.attachments([
							new builder.HeroCard(session)
								.title(name)
								.images([
									builder.CardImage.create(session,poster)
								])
								.tap(builder.CardAction.openUrl(session, knowMore+id))
								.buttons([
									builder.CardAction.openUrl(session, knowMore+id, 'Know More')
								])
						]);
						session.send(msg);
					} else {
						var arrayOfResult = [];
						for(var i=0;i<result_lenth;i++) {
							id = parsed.results[i].id;
							name = parsed.results[i].name;
							if(parsed.results[i].profile_path!=null){
								poster = "https://image.tmdb.org/t/p/w640"+parsed.results[i].profile_path;
							} else {
								poster = process.env.NO_IMAGE_URL;
							}

							 arrayOfResult.push(
								new builder.HeroCard(session)
									.title(name)
									.images([
										builder.CardImage.create(session,poster)
									])
									.tap(builder.CardAction.openUrl(session, knowMore+id))
									.buttons([
										builder.CardAction.openUrl(session, knowMore+id, 'Know More')
									])
							);
							//session.send(msg);
						}
						
						 // create reply with Carousel AttachmentLayout
						var reply = new builder.Message(session)
						.attachmentLayout(builder.AttachmentLayout.carousel)
						.attachments(arrayOfResult);
						session.send(reply);
					}
				}
			}
		  });
		})
		//send error to user
		.on('error', function(e) {
		  session.send(e.message);
		});
    }
]);